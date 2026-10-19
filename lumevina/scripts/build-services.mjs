// Writes Evelyn's menu (js/services.js) into the places that list services:
//   index.html                          the featured cards, the gift
//                                       certificate, and the full menu (between the
//                                       MENU:START / MENU:END markers)
//   server/functions/_shared/catalog.ts the server's prices, times and deposits
//
//   node scripts/build-services.mjs      (from lumevina/)
//
// Change a price, a time or a deposit in js/services.js, run this, done.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
globalThis.window = globalThis;
await import(path.join(root, "js/services.js"));
const S = globalThis.LUMEVINA_SERVICES;

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (n) => "$" + n.toLocaleString("en-US");
const priceLabel = (s) => (s.from ? "from " : "") + money(s.price);
const meta = (s) => [s.min ? s.min + " min" : "", s.deposit ? money(s.deposit) + " deposit" : ""].filter(Boolean).join(" · ");

// ── one row of the full menu ──
const row = (s) => {
  const note = s.note ? `<span class="wax-note">${esc(s.note)}</span>` : "";
  const desc = s.desc ? `<span class="wax-desc">${esc(s.desc)}</span>` : "";
  const m = meta(s) ? `<span class="wax-meta">${esc(meta(s))}</span>` : "";
  const btn = s.ask
    ? `<button class="wax-book wax-ask" type="button" data-ask-service="${s.id}" data-name="${esc(s.name)}" aria-label="Message Evelyn about ${esc(s.name)}"><span class="wax-book-label">Ask</span></button>`
    : `<button class="wax-add add-to-cart" type="button" data-id="${s.id}" data-name="${esc(s.name)}" data-price="${s.price}" data-dur="${s.block}" data-deposit="${s.deposit}"${s.from ? ' data-from="1"' : ""}${s.addon ? ' data-addon="1"' : ""} aria-label="Add ${esc(s.name)} to cart">+</button>`;
  const price = s.addon && s.id === "after-hours-facial" ? "+" + money(s.price) : priceLabel(s);
  const label = s.short ? `<strong class="wax-opt">${esc(s.short)}</strong>` : `<strong>${esc(s.name)}</strong>`;
  return `                <li class="wax-row"><span class="wax-item">${label}${note}${desc}${m}</span><span class="dots"></span><span class="wax-price">${price}</span>${btn}</li>`;
};
/* a service with options: its own line (name, description, deposit), then a
   bookable line per option, each at its own price and time */
const parentRow = (s) => {
  const note = s.note ? `<span class="wax-note">${esc(s.note)}</span>` : "";
  const desc = s.desc ? `<span class="wax-desc">${esc(s.desc)}</span>` : "";
  const m = s.deposit ? `<span class="wax-meta">${esc(money(s.deposit) + " deposit")}</span>` : "";
  return `                <li class="wax-row wax-row--parent"><span class="wax-item"><strong>${esc(s.name)}</strong>${note}${desc}${m}</span></li>`;
};
const optionRow = (o) => row({ ...o, desc: "", note: "", deposit: 0 }).replace('class="wax-row"', 'class="wax-row wax-row--option"')
  .replace(/data-deposit="0"/, `data-deposit="${o.deposit}"`);
const rows = (items) => items.flatMap((s) => s.options ? [parentRow(s), ...s.options.map(optionRow)] : [row(s)]);
const group = (title, items) => `            <div class="wax-group">
              <h4 class="wax-group-title">${esc(title)}</h4>
              <ul class="wax-list" role="list">
${rows(items).join("\n")}
              </ul>
            </div>`;

const TINTS = { facials: 1, procell: 4, peels: 3, acne: 7, consult: 2, waxing: 8 };
const count = (g) => (g.subs ? g.subs.flatMap((x) => x.items) : g.items).filter((s) => !s.addon || g.key === "waxing");
/* GIFTS and FEATURED name bookable ids; a parent with options shows its "from" price */
const sectorBtn = (g) => {
  const list = count(g), n = list.length;
  const low = Math.min(...list.map((s) => s.price));
  const word = g.key === "waxing" || g.key === "facials" ? "services" : g.key === "consult" ? "options" : "treatments";
  return `            <button class="sector-btn panel-tint-${TINTS[g.key] || 1}" type="button" data-sector="${g.key}" aria-expanded="false">
              <span class="sector-name">${esc(g.group)}</span>
              <span class="sector-sub">${n} ${n === 1 ? word.replace(/s$/, "") : word} · from ${money(low)}</span>
              <svg class="sector-chev" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 5l5 5 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>`;
};
const panel = (g) => g.subs
  ? `            <!-- waxing keeps its own subsectors -->
            <div class="sector-panel" data-sector="${g.key}" hidden>
            <div class="wax-groups">
${g.subs.map((sg) => group(sg.group, sg.items)).join("\n\n")}
            </div>
            </div>`
  : `            <div class="sector-panel" data-sector="${g.key}" hidden>
${group(g.group, g.items)}
            </div>`;

// ── the featured cards ──
const FEATURED = [
  { id: "ageless-grace-facial", img: "ageless", cls: "visual-ageless", hero: true, badge: "Signature" },
  { id: "procell-microchanneling", img: "dermaplane", cls: "visual-dermaplane", badge: "New" },
  { id: "lumevina-custom-facial", img: "custom", cls: "visual-custom", badge: "Returning clients" },
  { id: "brazilian-wax-mini-vajacial", img: "brazilian", cls: "visual-peel", badge: "Waxing · 2 in 1" },
];
const card = (f) => {
  const s = S.get(f.id);
  return `          <article class="product-card${f.hero ? " product-card--hero" : ""}" data-reveal data-spotlight>
            <span class="product-badge">${esc(f.badge)}</span>
            <div class="product-visual ${f.cls}" aria-hidden="true"><img src="img/services/${f.img}.webp" alt="" loading="lazy" decoding="async" width="800" height="600"></div>
            <h3 class="product-name">${esc(s.name)}</h3>
            <p class="product-desc">${esc(s.desc)}</p>
            <div class="product-foot">
              <span class="product-price">${priceLabel(s)}</span>
              <button class="btn btn-solid add-to-cart" type="button"
                data-id="${s.id}" data-name="${esc(s.name)}" data-price="${s.price}" data-dur="${s.block}" data-deposit="${s.deposit}"${s.from ? ' data-from="1"' : ""}>Add to cart</button>
            </div>
          </article>`;
};

// ── the gift certificate: a dollar amount toward any treatment ──
/* preset amounts, or a custom one ($25 to $1,000); js/cart.js keeps the
   button's amount in step with the choice */
const GIFT_AMOUNTS = [50, 100, 200, 400], GIFT_DEFAULT = 100;
const giftHtml = `        <!-- the gift certificate: pick an amount (js/cart.js), then add it to the cart -->
        <div class="gift-zone" id="gift">
          <article class="gift-cert" data-reveal>
            <div class="gift-cert-art" role="img" aria-label="Lumevina Aesthetics Spa"></div>
            <div class="gift-cert-body">
              <p class="gift-cert-k">E-Gift Certificate</p>
              <h3 class="gift-cert-title">The gift of glow</h3>
              <p class="gift-cert-desc">Toward any treatment, sent by email with its own code. It never expires.</p>
              <div class="gift-amounts" role="group" aria-label="Gift amount">
${GIFT_AMOUNTS.map((n) => `                <button class="gift-amt" type="button" data-amount="${n}" aria-pressed="${n === GIFT_DEFAULT}">${money(n)}</button>`).join("\n")}
                <button class="gift-amt" type="button" data-amount="custom" aria-pressed="false" aria-controls="gift-custom">Custom</button>
              </div>
              <div class="gift-custom" id="gift-custom" hidden>
                <label class="gift-custom-label" for="gift-custom-amt">Your amount</label>
                <span class="gift-custom-field"><span aria-hidden="true">$</span><input id="gift-custom-amt" type="number" inputmode="numeric" min="25" max="1000" step="1" placeholder="150" aria-describedby="gift-custom-hint"></span>
                <span class="gift-custom-hint" id="gift-custom-hint">$25 to $1,000</span>
              </div>
              <button class="btn gift-cert-add add-to-cart gift-add" type="button"
                data-id="gift-any-${GIFT_DEFAULT}" data-name="Gift Card · ${money(GIFT_DEFAULT)} value" data-price="${GIFT_DEFAULT}">Add ${money(GIFT_DEFAULT)} gift to cart</button>
              <p class="gift-cert-fine">Used at the visit: anything left stays on it, and you pay only what's over.</p>
              <button class="linklike gift-check-toggle" type="button" aria-expanded="false" aria-controls="gift-check">Check a gift balance</button>
              <form class="gift-check" id="gift-check" hidden>
                <label class="gift-custom-label" for="gift-check-code">Certificate code</label>
                <span class="gift-check-row"><input id="gift-check-code" type="text" placeholder="LUM-XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false"><button class="gift-check-go" type="submit">Check</button></span>
                <p class="gift-check-result" role="status" aria-live="polite"></p>
              </form>
            </div>
          </article>
        </div>
`;

const menuHtml = `        <!-- MENU:START (generated by scripts/build-services.mjs from js/services.js; edit those, not this) -->
        <div class="shop-grid">
${FEATURED.map(card).join("\n\n")}
        </div>

${giftHtml}
        <!-- ─── The Full Menu (complete catalog) ─── -->
        <div class="wax-menu">
          <div class="wax-head" data-reveal>
            <h3 class="wax-title">Explore Every Service</h3>
            <p class="wax-sub">Tap a group to open its menu, then <strong>Book</strong> the treatment you
            want and pick a time. Where a service takes a deposit, it's shown beside it and goes toward your total.</p>
          </div>

          <!-- big sectors pop in on scroll; tap to unfold the subsector menu -->
          <div class="sector-grid">
${S.menu.map(sectorBtn).join("\n")}
          </div>

          <div class="sector-panels">
${S.menu.map(panel).join("\n\n")}
          </div>
        </div>
        <!-- MENU:END -->
`;

// ── splice into index.html ──
const file = path.join(root, "index.html");
let html = fs.readFileSync(file, "utf8");
const a = html.indexOf("        <!-- MENU:START");
const z = html.indexOf("        <!-- MENU:END -->");
let start, end;
if (a !== -1 && z !== -1) { start = a; end = z + "        <!-- MENU:END -->\n".length; }
else {
  // first run: the hand-written menu, from the featured cards to the note under it
  start = html.indexOf('        <div class="shop-grid">');
  end = html.indexOf('        <p class="shop-note" data-reveal>');
  if (start === -1 || end === -1 || end < start) throw new Error("couldn't find the menu in index.html");
}
html = html.slice(0, start) + menuHtml + "\n" + html.slice(end);
fs.writeFileSync(file, html);

// ── the server's catalog ──
const RETIRED = {
  "couples-facial": ["Couples Facial", 32500, 60],
  "back-facial-half": ["Back Facial - Half", 14000, 60], "back-facial-full": ["Back Facial - Full", 18500, 60],
  "light-chemical-peel": ["Light Chemical Peel", 22500, 60], "medium-chemical-peel": ["Medium Chemical Peel", 23500, 60],
  "biorepeel-1": ["BioRePeel - 1 Facial Treatment", 27000, 60], "biorepeel-3": ["BioRePeel - 3 Facial Treatments", 67000, 60],
  "first-time-brazilian": ["First Time Brazilian", 8000, 30], "extended-bikini-line": ["Extended Bikini Line", 5500, 30],
  "half-leg-wax": ["Half Leg Wax", 5500, 30], "full-leg-wax": ["Full Leg Wax", 11000, 60], "nose-wax": ["Nose Wax", 900, 30],
  "sideburn-wax": ["Sideburn Wax", 2200, 30], "hairline-wax": ["Hairline Wax", 4300, 30], "full-face-wax": ["Full Face Wax", 3800, 30],
  "full-face-wax-cooling-mask": ["Full Face Wax + Cooling Mask", 5500, 60],
};
const lines = S.all.map((s) => `  "${s.id}": { name: ${JSON.stringify(s.name)}, price_cents: ${s.price * 100}, dur_min: ${s.block}, deposit_cents: ${s.deposit * 100}, offered: ${!s.ask} },`)
  .concat(Object.entries(RETIRED).map(([id, [name, c, d]]) => `  "${id}": { name: ${JSON.stringify(name)}, price_cents: ${c}, dur_min: ${d}, deposit_cents: 0, offered: false },`));
const ts = `// Lumevina — server-side service catalog
// GENERATED by scripts/build-services.mjs from js/services.js (her GlossGenius
// menu, ${S.asOf}). Don't edit: change js/services.js and run the script.
//
// price_cents  the price ("from" prices are the lowest option)
// dur_min      the calendar block, in 30-minute steps
// deposit_cents  due when booking online (her GlossGenius deposit); 0 = none
// offered      false = not bookable online (retired, or "message Evelyn first");
//              kept so older bookings still show their names

export const CATALOG: Record<string, { name: string; price_cents: number; dur_min: number; deposit_cents: number; offered: boolean }> = {
${lines.join("\n")}
};
`;
fs.writeFileSync(path.join(root, "server/functions/_shared/catalog.ts"), ts);
console.log(`menu: ${S.all.length} services in ${S.menu.length} groups → index.html, catalog.ts`);
