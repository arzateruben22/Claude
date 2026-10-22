/* Lumevina Skin Intelligence — a progress report (report.html?id=…)
 *
 * Exactly the content the practitioner approved (frozen at approval), with
 * fresh short-lived links to its photos. Prints cleanly; "Save as PDF" in
 * the print dialog gives the client a file. ?studio=1 previews a draft from
 * the studio with the staff sign-in.
 */

import { createSession } from "./session.js";
import { createApi, explain } from "./api.js";
import { esc, day, shortDay } from "./ui.js";
import { regionLabel } from "./core/regions.js";

const params = new URLSearchParams(location.search);
const studio = params.has("studio");
const api = createApi(studio ? "studio-skin" : "skin", createSession(studio ? "staff" : "client"));
const main = document.getElementById("sk-main");

try {
  const { report, urls } = await api.call("report", { id: params.get("id") });
  const c = report.content;
  const byName = new Map();
  for (const m of c.measurements) (byName.get(`${m.name}|${m.region}`) ?? byName.set(`${m.name}|${m.region}`, []).get(`${m.name}|${m.region}`)).push(m);
  const regions = [...new Set(c.images.map((i) => i.region))];
  document.title = `${report.title} · Lumevina`;
  main.innerHTML = `<article class="sk-section">
    ${report.status !== "approved" ? `<div class="sk-banner"><b>Draft preview.</b> The client sees this only after you approve it.</div>` : ""}
    <p class="sk-kicker">Lumevina · progress report</p><h1 class="sk-h1">${esc(report.title)}</h1>
    <p class="sk-lede">${esc(c.client?.name || "")}${c.period ? ` · ${c.period.from ? esc(day(c.period.from)) + " – " : ""}${esc(day(c.period.to))}` : ""}${report.approved_at ? ` · approved ${esc(day(report.approved_at))}` : ""}</p>
    ${c.summary ? `<div class="sk-card"><h2 class="sk-h3">From your practitioner</h2><p style="white-space:pre-line;margin:0;line-height:1.6">${esc(c.summary)}</p></div>` : ""}
    ${regions.map((r) => `<section class="sk-card" style="margin-top:1rem"><h2 class="sk-h3">${esc(regionLabel(r))}</h2><div class="sk-gallery">${c.images.filter((i) => i.region === r).map((i) => `<figure><img src="${esc(urls[i.capture_id] || "")}" alt="${esc(`${regionLabel(r)}, ${day(i.date)}`)}"><figcaption>${esc(i.label || "")} · ${esc(shortDay(i.date))}</figcaption></figure>`).join("")}</div></section>`).join("")}
    ${c.changes.length ? `<section class="sk-card" style="margin-top:1rem"><h2 class="sk-h3">What changed</h2>${c.changes.map((x) => `<p class="sk-change sk-change--${esc(x.verdict)}">${esc(x.text)}</p>`).join("")}</section>` : ""}
    ${c.measurements.length ? `<section class="sk-card" style="margin-top:1rem"><h2 class="sk-h3">Measurements your practitioner checked</h2><div class="sk-table-wrap"><table class="sk-table"><thead><tr><th>Measurement</th><th>Area</th><th>Date</th><th>Value</th><th></th></tr></thead><tbody>
      ${c.measurements.map((m) => `<tr><td>${esc(m.label)}</td><td>${esc(m.regionLabel)}</td><td>${esc(m.date ? shortDay(m.date) : "")}</td><td>${esc(m.display)}</td><td>${m.experimental ? `<span class="sk-badge sk-badge--exp">Experimental</span>` : ""}</td></tr>`).join("")}</tbody></table></div>
      <p class="sk-fine">Experimental measurements are shown for interest; they are not used to decide whether skin has changed.</p></section>` : ""}
    ${c.treatments.length ? `<section class="sk-card" style="margin-top:1rem"><h2 class="sk-h3">Treatments</h2><ul class="sk-list">${c.treatments.map((t) => `<li><span>${esc(t.summary || t.treatment_type)}${t.recovery_guidance ? `<br><small class="sk-fine">${esc(t.recovery_guidance)}</small>` : ""}</span><span class="sk-fine">${esc(day(t.treated_at))}</span></li>`).join("")}</ul></section>` : ""}
    ${c.routine.length ? `<section class="sk-card" style="margin-top:1rem"><h2 class="sk-h3">Your routine</h2><ul class="sk-list">${c.routine.map((r) => `<li><span>${esc(r.product_name)}${r.how ? ` <small class="sk-fine">· ${esc(r.how)}</small>` : ""}</span><span class="sk-fine">${esc(r.slot === "am" ? "Morning" : r.slot === "pm" ? "Night" : "Weekly")}</span></li>`).join("")}</ul></section>` : ""}
    <footer class="sk-fine" style="margin-top:1.5rem">${c.notes.map((n) => `<p>${esc(n)}</p>`).join("")}<p>Lumevina Aesthetics Spa · Woodland Hills</p></footer>
  </article>`;
} catch (e) {
  main.innerHTML = `<p class="sk-section sk-empty">${esc(explain(e))}</p>`;
}
