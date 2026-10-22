/* Lumevina Skin Intelligence — guided capture
 *
 * Walks through the areas to photograph (the standard set, or one chosen
 * area), with:
 *   • a positioning guide: the face landmark model outlines the exact area
 *     that will be measured and says how to line up; without it, a plain oval
 *   • live checks on each frame: sharpness against the sharpest frame of the
 *     last two seconds (autofocus-assist style), exposure by clipping, colour
 *     cast beyond the natural range of skin (fair to every skin tone)
 *   • a review of each photo before it is kept, with a retake prompt
 *   • file upload for photos from another device, a USB microscope's or a
 *     dermatoscope's own app, or a professional system's export
 * The original goes straight to the private bucket through a one-time signed
 * URL. Full-resolution stills come from ImageCapture where the browser has it.
 */

import { REGIONS, STANDARD_SET, regionLabel, framingAdvice } from "./core/regions.js";
import { assessFrame, sharpness } from "./core/quality.js";
import { MIME_OK, MAX_BYTES } from "./core/validate.js";
import { loadFaceTracker } from "./face.js";
import { openSheet, esc, toast } from "./ui.js";
import { explain } from "./api.js";

const SOURCES = { camera: "This camera", upload: "A photo from another device", microscope: "USB microscope (its app's export)", dermatoscope: "Dermatoscope (its export)", pro_export: "Professional imaging export" };

/**
 * @param {object} o
 *   api          createApi(...) for 'skin' or 'studio-skin'
 *   mode         'client' | 'studio'
 *   sessionId    studio: the open imaging session
 *   regions      ids to walk through (default: the standard set)
 *   onCaptured   (captureId, region) after each kept photo
 *   onDone       () when the sheet closes
 */
export function openCapture(o) {
  const regions = (o.regions?.length ? o.regions : STANDARD_SET).filter((r) => REGIONS.some((x) => x.id === r));
  const st = { i: 0, done: new Set(), stream: null, facing: o.mode === "client" ? "user" : "environment", tracker: null, raf: 0, recent: [], shot: null, source: "camera", lastHint: "", hintAt: 0 };
  const sheet = openSheet({
    title: o.mode === "client" ? "Add photos of your skin" : "Capture",
    wide: true,
    onClose: () => { stop(); o.onDone?.(); },
    html: `
      <ol class="sk-steps" aria-label="Areas">${regions.map((r, k) => `<li data-k="${k}"><button type="button" data-step="${k}">${esc(regionLabel(r))}</button></li>`).join("")}</ol>
      <div class="sk-cap">
        <div class="sk-cap-live">
          <div class="sk-cap-frame" data-facing="${st.facing}">
            <video playsinline muted autoplay aria-label="Camera preview"></video>
            <canvas class="sk-cap-overlay" aria-hidden="true"></canvas>
            <svg class="sk-cap-guide" viewBox="0 0 100 133" aria-hidden="true" preserveAspectRatio="xMidYMid meet"></svg>
          </div>
          <p class="sk-cap-hint" role="status" aria-live="polite"></p>
          <div class="sk-cap-checks" aria-hidden="true"></div>
          <div class="sk-cap-ctrls">
            <button type="button" class="sk-icon-btn" data-flip aria-label="Switch camera">⇆</button>
            <button type="button" class="sk-shutter" data-shoot aria-label="Take the photo"><span></span></button>
            <label class="sk-icon-btn sk-file" aria-label="Add a file"><input type="file" accept="image/*,.heic,.heif,.tif,.tiff" hidden>⤒</label>
          </div>
          ${o.mode === "studio" ? `<label class="sk-field sk-cap-src"><span>Source</span><select data-source>${Object.entries(SOURCES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("")}</select></label>` : ""}
          <p class="sk-fine">${o.mode === "client" ? "Face a window or soft light, no filter, no makeup if you can. Hold the phone at arm's length, the same way each time." : "Fixed mount, studio LED on, same distance each visit. A grey card in the frame lets the analysis correct colour."}</p>
        </div>
        <div class="sk-cap-review" hidden>
          <img alt="The photo you just took">
          <div class="sk-cap-verdict" role="status"></div>
          <div class="sk-cap-progress" hidden><span></span></div>
          <div class="sk-row">
            <button type="button" class="sk-btn sk-btn-ghost" data-retake>Retake</button>
            <button type="button" class="sk-btn" data-keep>Keep this photo</button>
          </div>
        </div>
      </div>`,
  });
  const $ = (s) => sheet.body.querySelector(s);
  const video = $("video"), overlay = $(".sk-cap-overlay"), guide = $(".sk-cap-guide"), hint = $(".sk-cap-hint"), checksEl = $(".sk-cap-checks");
  const live = $(".sk-cap-live"), review = $(".sk-cap-review"), frame = $(".sk-cap-frame");
  const small = document.createElement("canvas");

  const region = () => regions[st.i];
  function paintSteps() {
    sheet.body.querySelectorAll(".sk-steps li").forEach((li, k) => {
      li.classList.toggle("is-on", k === st.i); li.classList.toggle("is-done", st.done.has(regions[k]));
      li.querySelector("button").setAttribute("aria-current", k === st.i ? "step" : "false");
    });
    const def = REGIONS.find((r) => r.id === region());
    guide.innerHTML = def.guide === "macro"
      ? `<rect x="14" y="30" width="72" height="72" rx="6" class="g"/><text x="50" y="118" text-anchor="middle">Fill the square with the spot</text>`
      : def.guide === "profile"
        ? `<ellipse cx="${region() === "left_profile" ? 56 : 44}" cy="62" rx="27" ry="38" class="g"/><text x="50" y="118" text-anchor="middle">Turn to show your ${region() === "left_profile" ? "left" : "right"} side</text>`
        : `<ellipse cx="50" cy="62" rx="30" ry="40" class="g"/>${areaHint(region())}<text x="50" y="118" text-anchor="middle">${esc(regionLabel(region()))}</text>`;
  }
  const areaHint = (r) => ({ forehead: `<ellipse cx="50" cy="38" rx="18" ry="7" class="a"/>`, nose: `<ellipse cx="50" cy="63" rx="6" ry="11" class="a"/>`, chin: `<ellipse cx="50" cy="94" rx="11" ry="6" class="a"/>`,
    left_cheek: `<ellipse cx="65" cy="68" rx="9" ry="11" class="a"/>`, right_cheek: `<ellipse cx="35" cy="68" rx="9" ry="11" class="a"/>` })[r] || "";

  async function start() {
    stop();
    if (!navigator.mediaDevices?.getUserMedia) { hint.textContent = "This browser can't use the camera here. Add a photo from your files instead."; return; }
    try {
      st.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: st.facing, width: { ideal: 3840 }, height: { ideal: 2160 } }, audio: false });
      video.srcObject = st.stream;
      frame.dataset.facing = st.facing;
      await video.play().catch(() => {});
      loop();
    } catch (e) {
      hint.textContent = e?.name === "NotAllowedError" ? "Camera permission was declined. You can allow it in your browser's settings, or add a photo from your files." : "The camera isn't available. Add a photo from your files instead.";
    }
  }
  function stop() { cancelAnimationFrame(st.raf); st.stream?.getTracks().forEach((t) => t.stop()); st.stream = null; }

  let lastCheck = 0;
  function loop() {
    st.raf = requestAnimationFrame(loop);
    const t = performance.now();
    if (!video.videoWidth || t - lastCheck < 220) return;
    lastCheck = t;
    const w = 512, h = Math.round((512 * video.videoHeight) / video.videoWidth);
    small.width = w; small.height = h;
    const ctx = small.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const s = sharpness(img);
    st.recent = st.recent.filter((x) => t - x.t < 2000).concat({ t, s });
    const ref = Math.max(...st.recent.map((x) => x.s));
    const q = assessFrame(img, undefined, { referenceSharpness: st.recent.length > 4 ? ref : null });
    let tips = [...q.tips];
    const face = st.tracker ? st.tracker.detect(video, t) : null;
    drawOverlay(face);
    const def = REGIONS.find((r) => r.id === region());
    if (st.tracker && def.guide !== "macro") {
      const adv = framingAdvice(region(), face?.pose, face?.box);
      tips = adv.hints.concat(tips);
    }
    const ok = tips.length === 0;
    frame.classList.toggle("is-ok", ok);
    const msg = ok ? "Looks good. Hold still and take the photo." : tips[0];
    if (msg !== st.lastHint && t - st.hintAt > 900) { hint.textContent = msg; st.lastHint = msg; st.hintAt = t; }
    checksEl.innerHTML = [["Focus", !q.flags.includes("blur")], ["Light", !q.flags.some((f) => f.endsWith("exposed"))], ["Colour", !q.flags.includes("color_cast")], ...(st.tracker && def.guide !== "macro" ? [["Position", face && framingAdvice(region(), face.pose, face.box).ok]] : [])]
      .map(([k, good]) => `<span class="${good ? "ok" : "no"}">${k}</span>`).join("");
    st.lastChecks = { ...q.metrics, flags: q.flags };
    st.lastPose = face?.pose ?? null;
  }

  function drawOverlay(face) {
    const r = frame.getBoundingClientRect();
    overlay.width = r.width * devicePixelRatio; overlay.height = r.height * devicePixelRatio;
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    guide.style.opacity = face ? "0.25" : "1";
    if (!face) return;
    // video is object-fit: cover; map normalized landmarks to the visible box
    const vw = video.videoWidth, vh = video.videoHeight, sc = Math.max(overlay.width / vw, overlay.height / vh);
    const ox = (overlay.width - vw * sc) / 2, oy = (overlay.height - vh * sc) / 2;
    const P = (p) => [ox + p.x * vw * sc, oy + p.y * vh * sc];
    const regs = region() === "front" ? ["forehead", "left_cheek", "right_cheek", "nose", "chin"] : [region()];
    ctx.lineWidth = 2 * devicePixelRatio;
    ctx.strokeStyle = getComputedStyle(frame).getPropertyValue("--sk-guide-ok") || "#fff";
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    for (const reg of regs) {
      const poly = face.polygon(reg); if (!poly) continue;
      ctx.beginPath(); poly.forEach((p, k) => { const [x, y] = P(p); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }

  async function shoot() {
    if (!st.stream) return;
    const track = st.stream.getVideoTracks()[0];
    let blob = null;
    if ("ImageCapture" in window) {
      try { blob = await new window.ImageCapture(track).takePhoto(); } catch { blob = null; }
    }
    if (!blob) {
      const c = document.createElement("canvas");
      c.width = video.videoWidth; c.height = video.videoHeight;
      c.getContext("2d").drawImage(video, 0, 0);
      blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.95));
    }
    const settings = track.getSettings ? track.getSettings() : {};
    await showReview(blob, { guide: st.tracker ? "face-landmarks" : (REGIONS.find((r) => r.id === region()).guide === "macro" ? "macro" : "oval"), pose: st.lastPose, camera_label: track.label?.slice(0, 120), facing: settings.facingMode || st.facing }, "camera");
  }

  async function fromFile(file) {
    if (!file) return;
    const mime = (file.type || (/\.heic$/i.test(file.name) ? "image/heic" : /\.tiff?$/i.test(file.name) ? "image/tiff" : "")).toLowerCase();
    if (!MIME_OK.includes(mime)) { toast("JPEG, PNG, HEIC, TIFF or WebP only."); return; }
    if (file.size > MAX_BYTES) { toast("That file is larger than 25 MB."); return; }
    const source = o.mode === "studio" ? ($("[data-source]")?.value === "camera" ? "upload" : $("[data-source]")?.value || "upload") : "upload";
    await showReview(file, { guide: "none", file_name: file.name.slice(0, 120) }, source, mime);
  }

  async function showReview(blob, meta, source, mime = blob.type || "image/jpeg") {
    live.hidden = true; review.hidden = false;
    const img = review.querySelector("img");
    img.src = URL.createObjectURL(blob);
    const verdict = review.querySelector(".sk-cap-verdict");
    let checks = null;
    try {
      const bmp = await createImageBitmap(blob);
      const w = 640, h = Math.round((640 * bmp.height) / bmp.width);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const ctx = c.getContext("2d", { willReadFrequently: true }); ctx.drawImage(bmp, 0, 0, w, h);
      const ref = st.recent.length ? Math.max(...st.recent.map((x) => x.s)) : null;
      const q = assessFrame(ctx.getImageData(0, 0, w, h), undefined, { referenceSharpness: source === "camera" ? ref : null });
      checks = { ...q.metrics, flags: q.flags };
      meta.width = bmp.width; meta.height = bmp.height;
      verdict.innerHTML = q.ok ? `<p class="ok">Sharp, well lit, natural colour. Keep it, or retake.</p>` : `<p class="no">${esc(q.tips.join(". "))}.</p><p class="sk-fine">You can keep it anyway; the analysis checks every photo again and Evelyn reviews it.</p>`;
    } catch {
      verdict.innerHTML = `<p class="sk-fine">This file type can't be previewed here (HEIC or TIFF on some browsers). It will be checked after upload.</p>`;
    }
    st.shot = { blob, mime, source, meta: { ...meta, checks } };
  }

  async function keep() {
    const s = st.shot; if (!s) return;
    const bar = review.querySelector(".sk-cap-progress"), keepBtn = review.querySelector("[data-keep]");
    keepBtn.disabled = true; bar.hidden = false;
    try {
      const begin = await o.api.call("capture_begin", { session_id: o.sessionId, region: region(), mime: s.mime, bytes: s.blob.size, source: s.source, capture_meta: s.meta });
      await o.api.upload(s.blob, begin.upload, (f) => (bar.firstElementChild.style.width = `${Math.round(f * 100)}%`));
      await o.api.call("capture_commit", { capture_id: begin.capture_id });
      st.done.add(region());
      o.onCaptured?.(begin.capture_id, region());
      toast(`${regionLabel(region())} saved privately.`);
      st.shot = null; review.hidden = true; live.hidden = false; bar.hidden = true; bar.firstElementChild.style.width = "0";
      const next = regions.findIndex((r, k) => k > st.i && !st.done.has(r));
      if (next >= 0) { st.i = next; paintSteps(); } else if (st.done.size === regions.length) { toast("All done. Thank you."); sheet.close(); }
    } catch (e) {
      toast(explain(e));
      if (e.reason === "consent_required") sheet.close();
    } finally { keepBtn.disabled = false; }
  }

  sheet.body.addEventListener("click", (e) => {
    const step = e.target.closest("[data-step]"); if (step) { st.i = Number(step.dataset.step); paintSteps(); return; }
    if (e.target.closest("[data-shoot]")) shoot();
    if (e.target.closest("[data-flip]")) { st.facing = st.facing === "user" ? "environment" : "user"; start(); }
    if (e.target.closest("[data-retake]")) { st.shot = null; review.hidden = true; live.hidden = false; }
    if (e.target.closest("[data-keep]")) keep();
  });
  sheet.body.querySelector('input[type="file"]').addEventListener("change", (e) => { fromFile(e.target.files[0]); e.target.value = ""; });
  sheet.body.addEventListener("keydown", (e) => { if (e.key === " " && !live.hidden && e.target === sheet.el) { e.preventDefault(); shoot(); } });

  paintSteps();
  start();
  loadFaceTracker().then((t) => { st.tracker = t; if (t) hint.textContent = "Line up with the outline."; });
  return sheet;
}
