/* Lumevina Skin Intelligence — small UI helpers shared by the pages
 *
 * esc() for every value put into HTML, a few formatters, a toast, and one
 * sheet (dialog / bottom sheet on phones) with focus trapping, Escape to
 * close and focus returned to the opener. Two-tap confirmation for anything
 * destructive, like the rest of the site.
 */

import { regionLabel } from "./core/regions.js";

export const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const day = (iso, opts = { month: "short", day: "numeric", year: "numeric" }) => (iso ? new Date(String(iso).length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("en-US", opts) : "");
export const shortDay = (iso) => day(iso, { month: "short", day: "numeric" });
export const time = (iso) => (iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "");
export const minsToTime = (m) => { const h = Math.floor(m / 60), mm = m % 60; return `${h % 12 || 12}:${String(mm).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };
export const money = (c) => "$" + (Number(c || 0) / 100).toFixed(Number(c) % 100 ? 2 : 0);
export const region = regionLabel;
export const prefersReducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

let toastTimer;
export function toast(msg, kind = "") {
  let el = document.getElementById("sk-toast");
  if (!el) { el = document.createElement("div"); el.id = "sk-toast"; el.className = "sk-toast"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite"); document.body.appendChild(el); }
  el.textContent = msg;
  el.dataset.kind = kind;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3600);
}

/** A sheet: returns { el, body, close }. html is the body; title is required for the label. */
export function openSheet({ title, html = "", wide = false, onClose } = {}) {
  const opener = document.activeElement;
  const wrap = document.createElement("div");
  wrap.className = "sk-sheet-wrap";
  wrap.innerHTML = `<div class="sk-sheet-scrim" data-close></div>
    <div class="sk-sheet${wide ? " sk-sheet--wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="sk-sheet-title" tabindex="-1">
      <div class="sk-sheet-handle" aria-hidden="true"></div>
      <header class="sk-sheet-head"><h2 id="sk-sheet-title">${esc(title)}</h2><button type="button" class="sk-icon-btn" data-close aria-label="Close">×</button></header>
      <div class="sk-sheet-body">${html}</div>
    </div>`;
  document.body.appendChild(wrap);
  document.documentElement.classList.add("sk-sheet-open");
  const sheet = wrap.querySelector(".sk-sheet");
  const body = wrap.querySelector(".sk-sheet-body");
  const focusables = () => [...sheet.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
  const onKey = (e) => {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    if (e.key === "Tab") {
      const f = focusables(); if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  };
  function close() {
    document.removeEventListener("keydown", onKey);
    wrap.remove();
    if (!document.querySelector(".sk-sheet-wrap")) document.documentElement.classList.remove("sk-sheet-open");
    if (opener && opener.focus) opener.focus();
    onClose?.();
  }
  wrap.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
  document.addEventListener("keydown", onKey);
  requestAnimationFrame(() => (focusables()[1] || sheet).focus());
  return { el: sheet, body, close };
}

/** First tap arms, second tap within 4 s does it. */
export function twoTap(btn, label, fn) {
  btn.addEventListener("click", () => {
    if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = btn.dataset.label; fn(); return; }
    btn.dataset.label = btn.textContent;
    btn.dataset.armed = "1";
    btn.textContent = label;
    setTimeout(() => { if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = btn.dataset.label; } }, 4000);
  });
}

/** Form values as an object (checkbox groups as arrays). */
export function formValues(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === "checkbox") { if (form.querySelectorAll(`[name="${el.name}"]`).length > 1) { (out[el.name] ??= []); if (el.checked) out[el.name].push(el.value); } else out[el.name] = el.checked; }
    else if (el.type === "radio") { if (el.checked) out[el.name] = el.value; }
    else out[el.name] = el.value;
  }
  return out;
}

/** Shows field errors from a cleaner or a function's { errors }. */
export function showErrors(form, errors = {}) {
  for (const el of form.querySelectorAll(".sk-field-err")) el.remove();
  for (const el of form.querySelectorAll("[aria-invalid]")) el.removeAttribute("aria-invalid");
  for (const [k, msg] of Object.entries(errors)) {
    if (!msg) continue;
    const field = form.querySelector(`[name="${k}"]`);
    const p = document.createElement("p");
    p.className = "sk-field-err"; p.textContent = msg;
    if (field) { field.setAttribute("aria-invalid", "true"); field.closest("label, .sk-field, fieldset")?.appendChild(p); }
    else form.prepend(p);
  }
}

/** Loading text while a promise runs; restores the button after. */
export async function busy(btn, label, fn) {
  const old = btn.textContent; btn.disabled = true; btn.textContent = label;
  try { return await fn(); } finally { btn.disabled = false; btn.textContent = old; }
}
