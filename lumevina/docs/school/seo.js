/* Lumevina Skin School: structured data for search, from the curriculum itself
 * (window.SCHOOL), so the lesson count, the hours and the prices never go stale.
 * One Course with its three levels as parts, the tiers as offers, the two free
 * lessons marked; inlined by build.py after the curriculum. */
(function () {
  "use strict";
  var S = window.SCHOOL;
  if (!S || !S.levels) return;
  var base = location.origin + location.pathname;
  var mins = 0, lessons = 0, free = [];
  S.levels.forEach(function (l) { l.modules.forEach(function (m) { m.lessons.forEach(function (x) { mins += x.min || 0; lessons++; if (x.free) free.push(x); }); }); });
  var provider = { "@type": "Organization", name: "Lumevina Aesthetics Spa", sameAs: "https://www.instagram.com/lumevina" };
  var hours = Math.round(mins / 60 * 10) / 10;
  var course = {
    "@context": "https://schema.org", "@type": "Course",
    name: "Lumevina Skin School", url: base,
    description: (document.querySelector('meta[name="description"]') || {}).content || "",
    provider: provider,
    instructor: { "@type": "Person", name: "Evelyn Romero", jobTitle: "Licensed esthetician" },
    educationalLevel: "Beginner to advanced",
    numberOfCredits: undefined,
    hasPart: S.levels.map(function (l) {
      return { "@type": "Course", name: l.name, description: l.blurb, educationalLevel: l.tag, provider: provider,
        teaches: l.modules.map(function (m) { return m.name; }).join(", "),
        numberOfLessons: l.modules.reduce(function (n, m) { return n + m.lessons.length; }, 0) };
    }),
    hasCourseInstance: [{ "@type": "CourseInstance", courseMode: "Online", courseWorkload: "PT" + hours + "H", description: lessons + " lessons, " + hours + " hours, at your own pace" }],
    offers: (S.tiers || []).map(function (t) {
      return { "@type": "Offer", name: t.name, price: Number(t.price).toFixed(2), priceCurrency: "USD", category: "Paid", availability: "https://schema.org/InStock", url: base + "#tiers" };
    }).concat(S.starter ? [{ "@type": "Offer", name: S.starter.name, price: Number(S.starter.price).toFixed(2), priceCurrency: "USD", category: "Paid", availability: "https://schema.org/InStock", url: base + "#tiers" }] : []),
    isAccessibleForFree: false,
    // the free lessons, so a search for "free skincare lesson" has something to land on
    workExample: free.map(function (x) { return { "@type": "LearningResource", name: x.t, isAccessibleForFree: true, timeRequired: "PT" + x.min + "M", url: base + "#learn-" + x.id }; })
  };
  var el = document.createElement("script");
  el.type = "application/ld+json"; el.id = "ld-course";
  el.textContent = JSON.stringify(course, function (k, v) { return v === undefined ? undefined : v; });
  document.head.appendChild(el);
})();
