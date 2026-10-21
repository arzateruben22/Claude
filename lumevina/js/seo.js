/* Lumevina — structured data for search (STOREFRONT.md step 3, "get found")
 *
 * Writes two JSON-LD blocks into the page from what the site already knows,
 * so nothing here goes stale:
 *   BeautySalon   the studio: name, Woodland Hills, the email and Instagram,
 *                 this week's hours (js/hours.js; the street address stays
 *                 in the confirmation email, as the Contact section says)
 *   ItemList      every product on the shelf (js/inventory.js: confirmed,
 *                 not hidden, not the online consult) with its brand, photo,
 *                 the label's line, price and whether it's in stock, each
 *                 linking to its own address (?product=<id>#shop, the same
 *                 link the Google and Meta feeds use)
 * Google reads JSON-LD a script adds; the Merchant Center feed
 * (feed/google.xml) stays the source for Shopping listings. */
(function () {
  "use strict";

  var CAT = window.LUMEVINA_CATALOG, INV = window.LumevinaInventory, HRS = window.LumevinaHours;
  if (!CAT || !INV) return;
  var base = location.origin + location.pathname.replace(/[^/]*$/, "");
  var abs = function (rel) { return rel ? base + String(rel).replace(/^\//, "") : undefined; };
  var hhmm = function (m) { return (m < 600 ? "0" : "") + Math.floor(m / 60) + ":" + (m % 60 < 10 ? "0" : "") + (m % 60); };
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  var hours = [];
  try {
    (HRS && HRS.week ? HRS.week() : []).forEach(function (h, i) {
      if (h) hours.push({ "@type": "OpeningHoursSpecification", dayOfWeek: DAYS[i], opens: hhmm(h.open), closes: hhmm(h.close) });
    });
  } catch (e) { /* hours unavailable */ }

  var studio = {
    "@context": "https://schema.org", "@type": "BeautySalon",
    name: "Lumevina Aesthetics Spa", url: base,
    description: document.querySelector('meta[name="description"]') ? document.querySelector('meta[name="description"]').content : undefined,
    image: abs("img/logo-full.png"), logo: abs("img/logo-mark.png"),
    email: "Lumevina.aesthetics@gmail.com",
    address: { "@type": "PostalAddress", addressLocality: "Woodland Hills", addressRegion: "CA", addressCountry: "US" },
    areaServed: ["Woodland Hills", "San Fernando Valley", "Los Angeles"],
    founder: { "@type": "Person", name: "Evelyn Romero", jobTitle: "Licensed esthetician" },
    sameAs: ["https://www.instagram.com/lumevina"],
    openingHoursSpecification: hours.length ? hours : undefined
  };

  var brandName = function (p) { return (CAT.brands && CAT.brands[p.brandId] && CAT.brands[p.brandId].name) || p.brand || "Lumevina"; };
  var products = INV.live().filter(function (p) { return p.kind !== "consult"; }).map(function (p, i) {
    var s = INV.status(p);
    return {
      "@type": "ListItem", position: i + 1,
      item: {
        "@type": "Product", name: (p.brand ? p.brand + " " : "") + p.name, sku: p.id,
        brand: { "@type": "Brand", name: brandName(p) },
        image: abs(p.photo),
        description: [p.about, p.size ? p.size + "." : ""].filter(Boolean).join(" ") || undefined,
        url: base + "?product=" + encodeURIComponent(p.id) + "#shop",
        offers: {
          "@type": "Offer", priceCurrency: "USD", price: Number(p.price).toFixed(2), url: base + "?product=" + encodeURIComponent(p.id) + "#shop",
          availability: "https://schema.org/" + (s === "out" ? "OutOfStock" : "InStock"),
          seller: { "@type": "Organization", name: "Lumevina Aesthetics Spa" },
          shippingDetails: { "@type": "OfferShippingDetails", shippingDestination: { "@type": "DefinedRegion", addressCountry: "US" },
            shippingRate: { "@type": "MonetaryAmount", value: Number(p.price) >= 75 ? "0.00" : "8.00", currency: "USD" } },
          hasMerchantReturnPolicy: { "@type": "MerchantReturnPolicy", applicableCountry: "US", returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
            merchantReturnDays: 14, returnMethod: "https://schema.org/ReturnByMail", returnFees: "https://schema.org/ReturnFeesCustomerResponsibility" }
        }
      }
    };
  });
  var shelf = { "@context": "https://schema.org", "@type": "ItemList", name: "The shelf at Lumevina", numberOfItems: products.length, itemListElement: products };

  var put = function (id, data) {
    var el = document.getElementById(id);
    if (!el) { el = document.createElement("script"); el.type = "application/ld+json"; el.id = id; document.head.appendChild(el); }
    el.textContent = JSON.stringify(data, function (k, v) { return v === undefined ? undefined : v; });
  };
  put("ld-studio", studio);
  put("ld-shelf", shelf);
})();
