// Product feeds for her own store, from the catalog (js/catalog.js):
//
//   node scripts/build-feed.mjs --site https://lumevina.com        (from lumevina/)
//   → feed/google.xml   Google Merchant Center (free Shopping listings, Maps)
//   → feed/meta.csv     Meta Commerce Manager (Instagram and Facebook Shop)
//
// Both link to her website, never to a marketplace (MARKETING.md). Stock
// comes from the catalog's counts; the live site's counts are on the server,
// so rebuild and re-upload the feed whenever the catalog changes, or point
// the feeds' schedule at these files once the site is live. GTINs (the
// barcodes on the boxes) aren't in the catalog yet: add them to
// scripts/gtins.json as { "<product id>": "<barcode>" } and they go in;
// Google shows a product without one only when the brand truly has none.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const site = (args[args.indexOf("--site") + 1] || "").replace(/\/$/, "");
if (!site || !/^https:\/\//.test(site)) { console.error("usage: node scripts/build-feed.mjs --site https://<her domain>"); process.exit(1); }

globalThis.window = {};
await import(path.join(root, "js/catalog.js"));
const CAT = globalThis.window.LUMEVINA_CATALOG;
const gtins = fs.existsSync(path.join(root, "scripts/gtins.json")) ? JSON.parse(fs.readFileSync(path.join(root, "scripts/gtins.json"), "utf8")) : {};
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const csv = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
const CATEGORY = {   // Google product taxonomy ids
  "Cleansers": "567", "Toners & mists": "567", "Serums": "567", "Acne & spot care": "567", "Moisturizers": "567", "Eye care": "567",
  "Sun care": "567", "Masks": "567", "Supplements": "5702", "More": "567"
};
const link = (p) => `${site}/?product=${encodeURIComponent(p.id)}#shop`;
const image = (p) => p.photo ? `${site}/${p.photo}` : "";
const availability = (p) => p.stock == null ? "in_stock" : p.stock > 0 ? "in_stock" : "out_of_stock";
const description = (p) => [p.about, p.size ? `${p.size}.` : "", `Professional skincare from Evelyn Romero's treatment room at Lumevina Aesthetics Spa, Woodland Hills. Free pickup at your visit, or shipped.`].filter(Boolean).join(" ");

const live = CAT.products.filter((p) => !p.draft && !p.hidden && p.kind !== "consult");
const items = live.map((p) => `  <item>
    <g:id>${esc(p.id)}</g:id>
    <g:title>${esc(`${p.name} · ${p.brand}`)}</g:title>
    <g:description>${esc(description(p))}</g:description>
    <g:link>${esc(link(p))}</g:link>
    ${image(p) ? `<g:image_link>${esc(image(p))}</g:image_link>` : ""}
    <g:availability>${availability(p)}</g:availability>
    <g:price>${p.price.toFixed(2)} USD</g:price>
    <g:brand>${esc(p.brand)}</g:brand>
    <g:condition>new</g:condition>
    <g:google_product_category>${CATEGORY[p.cat] ?? "567"}</g:google_product_category>
    <g:product_type>${esc(`Skincare > ${p.cat}`)}</g:product_type>
    ${gtins[p.id] ? `<g:gtin>${esc(gtins[p.id])}</g:gtin>` : `<g:identifier_exists>no</g:identifier_exists>`}
    <g:shipping><g:country>US</g:country><g:service>Standard</g:service><g:price>${p.price > 75 ? "0.00" : "8.00"} USD</g:price></g:shipping>
    <g:pickup_method>buy</g:pickup_method>
    <g:pickup_sla>next_day</g:pickup_sla>
  </item>`).join("\n");
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>Lumevina Aesthetics Spa</title>
  <link>${esc(site)}</link>
  <description>Evelyn Romero's professional skincare shelf, Woodland Hills. Free pickup at your visit, or shipped.</description>
${items}
</channel>
</rss>
`;
const head = ["id", "title", "description", "availability", "condition", "price", "link", "image_link", "brand", "google_product_category", "product_type", "gtin", "fb_product_category"];
const rows = live.map((p) => [p.id, `${p.name} · ${p.brand}`, description(p), availability(p).replace(/_/g, " "), "new", `${p.price.toFixed(2)} USD`, link(p), image(p), p.brand,
  CATEGORY[p.cat] ?? "567", `Skincare > ${p.cat}`, gtins[p.id] ?? "", "health & beauty > personal care > skin care"].map(csv).join(","));

fs.mkdirSync(path.join(root, "feed"), { recursive: true });
fs.writeFileSync(path.join(root, "feed/google.xml"), xml);
fs.writeFileSync(path.join(root, "feed/meta.csv"), head.join(",") + "\n" + rows.join("\n") + "\n");
const withGtin = live.filter((p) => gtins[p.id]).length;
console.log(`feed: ${live.length} products → feed/google.xml, feed/meta.csv (${withGtin} with a GTIN, ${live.filter((p) => availability(p) === "in_stock").length} in stock) for ${site}`);
