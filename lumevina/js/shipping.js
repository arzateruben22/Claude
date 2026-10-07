/* Lumevina — shipping
 *
 * One list for everything that goes out in the mail: shelf orders from the
 * shop, Glow Routine boxes and Skin School kits. The website adds to it at
 * checkout; the owner dashboard works from it: what to pack and in which
 * mailer or box, a packing slip, a file Pirate Ship turns into labels, and
 * what each label really cost, which then replaces the estimate in the books.
 *
 *   LumevinaShip.readAddress(root, prefix)  street / apt / city / state / ZIP
 *                                           fields → { address, ok, problems, bad }
 *   LumevinaShip.fillAddress(root, prefix, a)
 *   LumevinaShip.lastAddress(email)         the address they used last time
 *   LumevinaShip.add(order)                 → the shipment, with package,
 *                                           weight and estimated postage
 *   LumevinaShip.bookEntry(rec, paid)       its line for the books (sales log)
 *   LumevinaShip.list() / update(id, patch) / markShipped(id, info) / unship(id)
 *   LumevinaShip.estimate(rec)              → { service, postage, supplies, total, zone }
 *   LumevinaShip.csv(list)                  the Pirate Ship spreadsheet
 *   LumevinaShip.slip(rec)                  a 4 × 6 in packing slip (HTML)
 *   LumevinaShip.trackUrl(number)
 *
 * Runs on localStorage in the demo. Live, it's the `shipments` table
 * (server/schema.sql) and the Stripe webhook adds the rows.
 *
 * Postage here is an estimate for planning, from USPS commercial prices
 * (July 2026). Pirate Ship shows the exact price before a label is bought,
 * and the price entered when an order is marked shipped is what the books
 * keep. See SHIPPING.md.
 */
(function () {
  "use strict";

  var KEY = "lumevina_shipments";
  var SALES = "lumevina_retail_sales";

  /* The three packages. Each order goes in the smallest one that fits.
     supplies = the mailer or box, bubble wrap, zip bag, label and tape. */
  var ORDER = ["mailer", "small", "medium"];
  var PACKS = {
    mailer: { name: "Bubble mailer", size: "6 × 10 in", dims: [10, 6, 1], tare: 1, supplies: 0.4,
      fits: "one plastic bottle or tube" },
    small: { name: "Small box", size: "6 × 6 × 4 in", dims: [6, 6, 4], tare: 4, supplies: 1.1,
      fits: "two or three items, or anything glass, with a pump or a dropper" },
    medium: { name: "Medium box", size: "10 × 8 × 4 in", dims: [10, 8, 4], tare: 7, supplies: 1.5,
      fits: "sets, kits, and four items or more" }
  };

  /* What each thing weighs as it ships (product and its bottle, in ounces),
     and whether it needs a box. Weigh the first few and correct these. */
  var ITEMS = {
    "gm-cleanser": { oz: 9 },
    "lm-serum": { oz: 3, fragile: true },          /* dropper serum */
    "spf-30": { oz: 3 },
    "glow-routine": { oz: 14, fragile: true, pack: "small" },
    "school-kit": { oz: 9, pack: "small" }
  };
  var spec = function (it) {
    var id = String(it.id || "").replace(/^retail-/, "");
    return ITEMS[id] || { oz: 6 };
  };

  var suggest = function (items) {
    var oz = 0, n = 0, fragile = false, force = "mailer";
    (items || []).forEach(function (it) {
      var s = spec(it), q = it.qty || 1;
      oz += s.oz * q; n += q;
      if (s.fragile) fragile = true;
      if (s.pack && ORDER.indexOf(s.pack) > ORDER.indexOf(force)) force = s.pack;
    });
    var pack = n >= 4 || oz > 32 ? "medium" : n >= 2 || fragile ? "small" : "mailer";
    if (ORDER.indexOf(force) > ORDER.indexOf(pack)) pack = force;
    return { pack: pack, oz: Math.ceil(oz + PACKS[pack].tare) };
  };

  /* ── Postage estimates ─────────────────────────────────────────
     The zone is how far the package goes from Woodland Hills (ZIP 913),
     roughly, from the first three digits of the ZIP: 1 is the LA area,
     8 is the East Coast, Hawaii and Alaska. */
  var ZONES = [
    [900, 918, 1], [930, 930, 1], [919, 929, 2], [931, 935, 2],
    [936, 939, 3], [952, 953, 3], [889, 891, 3],
    [940, 951, 4], [954, 961, 4], [893, 898, 4], [840, 865, 4],
    [800, 838, 5], [870, 884, 5], [970, 994, 5], [798, 799, 5], [590, 599, 5],
    [730, 797, 6], [660, 693, 6], [570, 588, 6],
    [500, 567, 7], [600, 658, 7], [700, 729, 7], [370, 397, 7], [460, 479, 7]
  ];
  var zone = function (zip) {
    var z3 = parseInt(String(zip || "").slice(0, 3), 10);
    if (!isFinite(z3)) return 4;
    for (var i = 0; i < ZONES.length; i++) if (z3 >= ZONES[i][0] && z3 <= ZONES[i][1]) return ZONES[i][2];
    return 8;
  };
  var ZONE_NAME = ["", "nearby", "nearby", "California", "the West", "the West", "the middle of the country",
    "the Midwest and South", "the East Coast"];

  /* USPS Ground Advantage, commercial price (what Pirate Ship charges), for
     any package under 1 lb, by zone, from July 12, 2026. Zones 1–5 and 8 are
     published prices; 6 and 7 sit between them. */
  var GROUND = [0, 6.93, 6.94, 7.30, 7.46, 7.69, 7.93, 8.16, 8.40];
  /* Priority Mail Cubic, priced by size not weight (up to 20 lb). The small
     box and the mailer are the smallest size (0.1); zones 1 and 8 are
     published 2026 prices, the zones between are estimates. The medium box
     is the next size up, about a fifth more. */
  var CUBIC = [0, 8.39, 8.39, 8.73, 9.48, 10.40, 11.33, 12.17, 14.36];

  var r2 = function (n) { return Math.round(n * 100) / 100; };

  var estimate = function (rec) {
    var p = PACKS[rec.pack] || PACKS.mailer, z = zone(rec.address && rec.address.zip);
    var cubic = CUBIC[z] * (rec.pack === "medium" ? 1.2 : 1);
    var under1 = (rec.oz || 0) < 16;
    var postage = under1 ? Math.min(GROUND[z], cubic) : cubic;
    var service = under1 && GROUND[z] <= cubic ? "USPS Ground Advantage" : "Priority Mail Cubic";
    return { service: service, postage: r2(postage), supplies: p.supplies, total: r2(postage + p.supplies),
      zone: z, where: ZONE_NAME[z] };
  };

  /* ── Addresses ───────────────────────────────────────────────── */
  var STATE_NAMES = {
    alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
    connecticut: "CT", delaware: "DE", "district of columbia": "DC", florida: "FL", georgia: "GA",
    hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY",
    louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
    mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH",
    "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
    ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
    "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
    virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY", "puerto rico": "PR"
  };
  var CODES = Object.keys(STATE_NAMES).map(function (k) { return STATE_NAMES[k]; });
  var stateCode = function (s) {
    s = String(s || "").trim();
    var up = s.toUpperCase().replace(/\./g, "");
    if (CODES.indexOf(up) !== -1) return up;
    return STATE_NAMES[s.toLowerCase()] || up;
  };

  var FIELDS = ["street", "apt", "city", "state", "zip"];
  var SAYS = { street: "a street address", city: "a city", state: "a state", zip: "a 5-digit ZIP" };

  var readAddress = function (root, prefix) {
    var el = function (f) { return root.querySelector("#" + prefix + "-" + f); };
    var a = {}, problems = [], bad = [];
    FIELDS.forEach(function (f) { a[f] = el(f) ? el(f).value.trim().replace(/\s+/g, " ") : ""; });
    a.state = stateCode(a.state);
    if (el("state") && a.state) el("state").value = a.state;
    var wrong = {
      street: a.street.length < 4 || !/\d/.test(a.street),
      city: a.city.length < 2,
      state: CODES.indexOf(a.state) === -1,
      zip: !/^\d{5}(-\d{4})?$/.test(a.zip)
    };
    Object.keys(wrong).forEach(function (f) {
      var e = el(f);
      if (e) { e.classList.toggle("invalid", wrong[f]); e.setAttribute("aria-invalid", String(wrong[f])); }
      if (wrong[f]) { problems.push(SAYS[f]); if (e) bad.push(e); }
    });
    return { address: a, ok: !problems.length, problems: problems, bad: bad };
  };

  var fillAddress = function (root, prefix, a) {
    if (!a) return;
    FIELDS.forEach(function (f) {
      var e = root.querySelector("#" + prefix + "-" + f);
      if (e && !e.value.trim() && a[f]) e.value = a[f];
    });
  };

  var oneLine = function (a) {
    return [a.street + (a.apt ? ", " + a.apt : ""), a.city, a.state + " " + a.zip].join(", ");
  };
  /* the block Pirate Ship's "paste an address" box reads */
  var block = function (rec) {
    var a = rec.address;
    return [rec.name, a.street + (a.apt ? " " + a.apt : ""), a.city + ", " + a.state + " " + a.zip].join("\n");
  };

  /* ── The list ────────────────────────────────────────────────── */
  var load = function () { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  var save = function (list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* private mode */ } };
  var find = function (list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; };
  var norm = function (e) { return String(e || "").trim().toLowerCase(); };

  /* orders go out within two business days */
  var shipBy = function (from) {
    var d = new Date(from || Date.now()), left = 2;
    while (left > 0) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) left--; }
    d.setHours(17, 0, 0, 0);
    return d.toISOString();
  };

  var lastAddress = function (email) {
    var list = load().filter(function (s) { return norm(s.email) === norm(email) && s.address; });
    return list.length ? list[list.length - 1].address : null;
  };

  var add = function (o) {
    var s = suggest(o.items);
    var rec = {
      id: "SHP-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase(),
      order: o.order || "", source: o.source || "shop", at: new Date().toISOString(),
      due: o.due || shipBy(), name: o.name || "", email: o.email || "", address: o.address,
      items: (o.items || []).map(function (it) { return { id: it.id || "", name: it.name, qty: it.qty || 1 }; }),
      pack: s.pack, oz: s.oz, charged: o.charged || 0, note: o.note || "", status: "to-ship"
    };
    rec.est = estimate(rec).total;
    var list = load();
    list.push(rec);
    save(list);
    return rec;
  };

  /* the books: shipping in (what the client paid) and the estimated
     postage and supplies out, until the real label price comes in */
  var bookEntry = function (rec, paid, what) {
    return { id: "shipping", type: "shipping", name: what || "Shipping", price: paid || 0, qty: 1, paid: paid || 0,
      cost: rec.est, at: rec.at, channel: rec.source === "shop" ? "online" : rec.source, order: rec.order, ship: rec.id,
      who: rec.source === "routine" ? "Glow Routine" : rec.source === "school" ? "Skin School" : "Online shop" };
  };

  var setBookCost = function (rec, cost) {
    var log;
    try { log = JSON.parse(localStorage.getItem(SALES)) || []; } catch (e) { return; }
    var hit = false;
    log.forEach(function (x) { if (x.type === "shipping" && x.ship === rec.id) { x.cost = r2(cost); hit = true; } });
    if (hit) try { localStorage.setItem(SALES, JSON.stringify(log)); } catch (e) { /* private mode */ }
  };

  var carrierOf = function (t) { return /^1Z/i.test(String(t || "").trim()) ? "UPS" : "USPS"; };

  /* The changes themselves, on one record (the dashboard's sample orders
     use these directly, so trying the card out never saves anything) */
  var apply = {
    /* a different package or weight before it ships: the estimate follows */
    update: function (rec, patch) {
      if (patch.pack && PACKS[patch.pack]) rec.pack = patch.pack;
      var oz = parseFloat(patch.oz);
      if (isFinite(oz) && oz > 0) rec.oz = Math.ceil(oz);
      if (rec.status !== "shipped") rec.est = estimate(rec).total;
      return rec;
    },
    ship: function (rec, info) {
      info = info || {};
      rec.status = "shipped";
      rec.shippedAt = new Date().toISOString();
      rec.tracking = String(info.tracking || "").replace(/\s+/g, "");
      rec.carrier = carrierOf(rec.tracking);
      return apply.cost(rec, info);
    },
    /* the label's price, now or later */
    cost: function (rec, info) {
      var paid = parseFloat(String(info && info.postage != null ? info.postage : "").replace(/[$,\s]/g, ""));
      rec.postage = isFinite(paid) && paid >= 0 ? r2(paid) : null;
      rec.supplies = (PACKS[rec.pack] || PACKS.mailer).supplies;
      return rec;
    },
    unship: function (rec) {
      rec.status = "to-ship";
      delete rec.shippedAt; delete rec.tracking; delete rec.carrier; delete rec.postage; delete rec.supplies;
      return rec;
    }
  };
  /* what this package costs in the books right now */
  var bookCost = function (rec) {
    return rec.status === "shipped" && rec.postage != null ? rec.postage + rec.supplies : rec.est;
  };
  var change = function (how) {
    return function (id, arg) {
      var list = load(), rec = find(list, id);
      if (!rec) return null;
      apply[how](rec, arg);
      save(list);
      setBookCost(rec, bookCost(rec));
      return rec;
    };
  };
  var update = change("update"), markShipped = change("ship"), unship = change("unship"), setLabelCost = change("cost");

  var trackUrl = function (t) {
    t = String(t || "").replace(/\s+/g, "");
    if (!t) return "";
    return carrierOf(t) === "UPS" ? "https://www.ups.com/track?tracknum=" + encodeURIComponent(t)
      : "https://tools.usps.com/go/TrackConfirmAction?tLabels=" + encodeURIComponent(t);
  };

  /* ── Pirate Ship ───────────────────────────────────────────────
     Pirate Ship imports a spreadsheet of addresses and makes every label
     in one go. These headings are its own field names, so it matches the
     columns by itself; the first time, it asks to confirm and then
     remembers. The order number prints in the label's corner (a "rubber
     stamp"), and the email lets Pirate Ship send the client their tracking. */
  var cell = function (v) {
    v = v == null ? "" : String(v);
    return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  };
  var itemsShort = function (rec) {
    return rec.items.map(function (it) { return (it.qty > 1 ? it.qty + "× " : "") + it.name; }).join(", ");
  };
  var csv = function (list) {
    var head = ["Order ID", "Name", "Company", "Address", "Address Line 2", "City", "State", "Zipcode", "Country",
      "Email", "Ounces", "Length", "Width", "Height", "Rubber Stamp 1", "Rubber Stamp 2"];
    var rows = list.map(function (r) {
      var a = r.address, d = (PACKS[r.pack] || PACKS.mailer).dims;
      return [r.order || r.id, r.name, "", a.street, a.apt, a.city, a.state, a.zip, "US", r.email, r.oz,
        d[0], d[1], d[2], r.order || r.id, itemsShort(r).slice(0, 40)];
    });
    return [head].concat(rows).map(function (row) { return row.map(cell).join(","); }).join("\r\n") + "\r\n";
  };

  /* ── Packing slip: 4 × 6 in, black on white, for the label printer ── */
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var NOTE = {
    shop: "Everything in here was chosen for your skin. Start with the routine Evelyn showed you, and wear SPF every morning.",
    routine: "Here is this month's Glow Routine. Evelyn's note on what's inside and how to use it is in your email.",
    school: "Your Skin School kit. Lesson 1 walks you through each step, at your own pace."
  };
  var slip = function (rec) {
    var first = String(rec.name || "").split(" ")[0] || "you";
    var when = new Date(rec.at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return '<section class="slip">' +
      '<header class="slip-head"><p class="slip-brand">LUMEVINA</p><p class="slip-sub">Aesthetics Spa · Woodland Hills</p></header>' +
      '<p class="slip-meta"><b>Packing slip</b><span>' + esc(rec.order || rec.id) + ' · ' + esc(when) + '</span></p>' +
      '<p class="slip-for">For ' + esc(rec.name) + '</p>' +
      '<ul class="slip-items">' + rec.items.map(function (it) {
        return '<li><span class="slip-box" aria-hidden="true"></span><span class="slip-q">' + esc(it.qty) + ' ×</span> ' + esc(it.name) + '</li>';
      }).join("") + '</ul>' +
      '<div class="slip-note"><p class="slip-thanks">Thank you, ' + esc(first) + '.</p><p>' + esc(NOTE[rec.source] || NOTE.shop) + '</p></div>' +
      '<footer class="slip-foot"><p>Questions? Ask Evelyn any time at lumevina.com</p>' +
      '<p>Your next facial is a tap away there too, and every visit earns Glow Points.</p></footer>' +
      '</section>';
  };

  /* one design for the slip, on screen, printed, and in the saved file */
  var SLIP_CSS =
    ".slip{box-sizing:border-box;width:4in;height:6in;background:#fff;color:#000;padding:.3in .3in .25in;display:flex;flex-direction:column;" +
      "font-family:Inter,-apple-system,'Helvetica Neue',Arial,sans-serif;overflow:hidden;letter-spacing:0}" +
    ".slip p,.slip ul{margin:0}" +
    ".slip-head{text-align:center;border-bottom:2pt solid #000;padding-bottom:.1in}" +
    ".slip-brand{font-weight:800;font-size:22pt;letter-spacing:.18em;line-height:1}" +
    ".slip-sub{font-size:7.5pt;letter-spacing:.22em;text-transform:uppercase;margin-top:4pt}" +
    ".slip-meta{display:flex;justify-content:space-between;gap:8pt;font-size:8.5pt;margin-top:.14in}" +
    ".slip-for{font-size:11pt;font-weight:600;margin-top:.08in}" +
    ".slip-items{list-style:none;padding:0;margin-top:.12in;font-size:10pt;display:grid;gap:5pt}" +
    ".slip-items li{display:flex;align-items:baseline;gap:6pt}" +
    ".slip-box{flex:none;width:9pt;height:9pt;border:1.2pt solid #000;transform:translateY(1pt)}" +
    ".slip-q{font-weight:700}" +
    ".slip-note{margin-top:auto;border-top:1pt dashed #000;padding-top:.12in;font-size:9pt;line-height:1.4}" +
    ".slip-thanks{font-size:13pt;font-weight:700;margin-bottom:3pt}" +
    ".slip-foot{margin-top:.1in;font-size:7.5pt;line-height:1.4}" +
    /* a page of its own size, so printing anything else is left alone */
    "@page slip{size:4in 6in;margin:0}" +
    "@media print{.slip{page:slip;break-after:page;page-break-after:always}}";

  /* the slips as a file of their own: open it and it prints */
  var slipDocument = function (list) {
    return "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>Lumevina packing slips</title>" +
      "<style>@page{size:4in 6in;margin:0}body{margin:0;background:#fff}" + SLIP_CSS + "</style></head><body>" + list.map(slip).join("") +
      "<script>addEventListener('load',function(){setTimeout(function(){print()},300)})<\/script></body></html>";
  };

  window.LumevinaShip = {
    KEY: KEY, PACKS: PACKS, ORDER: ORDER,
    readAddress: readAddress, fillAddress: fillAddress, lastAddress: lastAddress, oneLine: oneLine, block: block,
    stateCode: stateCode, zone: zone, estimate: estimate, suggest: suggest, shipBy: shipBy,
    add: add, bookEntry: bookEntry, list: load, update: update, markShipped: markShipped, unship: unship,
    setLabelCost: setLabelCost, apply: apply,
    csv: csv, slip: slip, SLIP_CSS: SLIP_CSS, slipDocument: slipDocument, trackUrl: trackUrl, itemsShort: itemsShort
  };
})();
