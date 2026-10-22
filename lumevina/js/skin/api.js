/* Lumevina Skin Intelligence — talking to the functions (or the demo)
 *
 * call(action, body) posts to functions/skin or functions/studio-skin with
 * the signed-in person's token. In demo mode the same calls go to
 * demo-backend.js, which answers from the synthetic record, so every screen
 * can be tried without a server.
 *
 * upload(blob, uploadInfo) sends an original straight to the private bucket
 * with the one-time signed upload URL the function returned: the image never
 * passes through the website's own server.
 */

import { LIVE } from "./session.js";

const CFG = (window.LUMEVINA_CONFIG && window.LUMEVINA_CONFIG.shop) || {};

export class ApiError extends Error {
  constructor(status, body) { super(body?.reason || `HTTP ${status}`); this.status = status; this.body = body || {}; this.reason = body?.reason || "failed"; }
}

export function createApi(fn, session) {
  let demo = null;
  const demoBackend = async () => (demo ??= (await import("./demo-backend.js")).demoBackend(fn));

  async function call(action, body = {}) {
    if (!LIVE) return (await demoBackend()).call(action, body);
    const token = await session.token();
    if (!token) throw new ApiError(401, { reason: "sign_in" });
    const r = await fetch(CFG.supabase.replace(/\/$/, "") + "/functions/v1/" + fn, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: CFG.key, Authorization: "Bearer " + token },
      body: JSON.stringify({ action, ...body }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new ApiError(r.status, j);
    return j;
  }

  async function upload(blob, info, onProgress) {
    if (!LIVE) return (await demoBackend()).upload(blob, info);
    // XHR for upload progress; fetch can't report it
    await new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open("PUT", info.url);
      x.setRequestHeader("Content-Type", info.content_type || blob.type || "application/octet-stream");
      x.setRequestHeader("x-upsert", "false");
      x.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
      x.onload = () => (x.status < 300 ? resolve() : reject(new ApiError(x.status, { reason: "upload_failed" })));
      x.onerror = () => reject(new ApiError(0, { reason: "offline" }));
      x.send(blob);
    });
  }

  return { call, upload, live: LIVE };
}

/** Plain words for the reasons the functions give. */
export function explain(e) {
  const r = e?.reason || e?.body?.reason || "";
  const msg = {
    sign_in: "Please sign in again.",
    not_enrolled: "You haven't started your skin record yet.",
    consent_required: e?.body?.message || "This needs the client's consent first.",
    not_staff: "This account isn't set up as studio staff.",
    mfa_required: "Confirm with your authenticator app code to continue.",
    not_assigned: "This client isn't assigned to you.",
    admin_only: "Only an admin can do that.",
    slow_down: "That's a lot in a short time. Wait a minute and try again.",
    text_changed: "The wording of this consent has just been updated. Please read it again.",
    not_uploaded: "The photo didn't finish uploading. Try again.",
    too_large: "That file is too large (25 MB at most).",
    invalid: "Some of this needs another look.",
    wording: "Some of the wording needs changing before this can go to the client.",
    booking_not_this_client: "That appointment belongs to someone else.",
    offline: "You're offline. Try again when you're connected.",
    upload_failed: "The upload didn't go through. Try again.",
    no_account: e?.body?.message || "Ask them to sign in once first.",
  }[r];
  return msg || "Something went wrong. Please try again.";
}
