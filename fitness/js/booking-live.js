/* SchFLR — live availability engine
   ─────────────────────────────────────────────────────────────
   Ported from the Lumevina booking system: the same day-key /
   busy-slot calendar formula, with Supabase as the store instead
   of Lumevina's demo localStorage.

   DORMANT until configured. To go live:

   1. Create a free project at https://supabase.com
   2. In the SQL editor, run:

        create table bookings (
          id uuid primary key default gen_random_uuid(),
          day text not null,          -- "2026-07-22" (dateKey format)
          slot text not null,         -- "6:00 – 7:30 PM"
          plan text not null,         -- "Momentum"
          pay_mode text not null,     -- "full" | "split"
          status text not null default 'pending',  -- pending | confirmed | cancelled
          created_at timestamptz default now(),
          unique (day, slot)
        );
        alter table bookings enable row level security;
        create policy "public can read booked slots"
          on bookings for select using (true);
        create policy "public can request a booking"
          on bookings for insert with check (status = 'pending');

   3. Paste your project URL and anon key below (Settings → API).
   4. Also fill STRIPE_LINKS in main.js — the payment-first flow
      and this live calendar switch on together.

   You confirm/cancel bookings from the Supabase table editor (set
   status). Cancelled slots reopen automatically.
   ───────────────────────────────────────────────────────────── */

(function () {
  "use strict";

  var CONFIG = {
    SUPABASE_URL: "",        // e.g. "https://abcdefgh.supabase.co"
    SUPABASE_ANON_KEY: "",   // the public "anon" key — safe to ship
    TABLE: "bookings"
  };

  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) return; // dormant

  var HEADERS = {
    apikey: CONFIG.SUPABASE_ANON_KEY,
    Authorization: "Bearer " + CONFIG.SUPABASE_ANON_KEY,
    "Content-Type": "application/json"
  };
  var BASE = CONFIG.SUPABASE_URL + "/rest/v1/" + CONFIG.TABLE;

  /* dateKey — same formula as Lumevina */
  function dateKey(d) {
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  /* taken = Set of "day|slot" for pending + confirmed bookings */
  var taken = new Set();

  function refresh() {
    var today = dateKey(new Date());
    return fetch(BASE + "?select=day,slot,status&day=gte." + today +
        "&status=neq.cancelled", { headers: HEADERS })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        taken = new Set(rows.map(function (b) { return b.day + "|" + b.slot; }));
        /* re-mark whatever day is currently rendered */
        var open = document.querySelector(".book-days .chip-day.is-on");
        if (open) {
          window.__bookingLive.markTaken(open.dataset.key,
            document.querySelector(".book-slots"));
        }
      })
      .catch(function () {});
  }

  window.__bookingLive = {
    dateKey: dateKey,

    /* disable slot chips that are already booked for this day */
    markTaken: function (dayKey, slotsEl) {
      if (!dayKey || !slotsEl) return;
      [].forEach.call(slotsEl.querySelectorAll(".chip-slot"), function (chip) {
        var isTaken = taken.has(dayKey + "|" + chip.textContent);
        chip.classList.toggle("is-taken", isTaken);
        chip.disabled = isTaken;
        if (isTaken) chip.classList.remove("is-on");
      });
    },

    /* write a pending booking the moment the client says they've paid */
    record: function (b) {
      taken.add(b.day + "|" + b.slot); // optimistic — slot closes instantly
      return fetch(BASE, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({
          day: b.day, slot: b.slot, plan: b.plan,
          pay_mode: b.mode, status: "pending"
        })
      }).catch(function () {});
    }
  };

  refresh();
  window.setInterval(refresh, 60 * 1000); // stay fresh while the page is open
})();
