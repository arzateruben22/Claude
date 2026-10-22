/* Lumevina Skin Intelligence — face landmarks in the browser (MediaPipe)
 *
 * During capture, the face landmark model runs on the live camera frames in
 * the browser to tell the person how to line up (closer, turn a little,
 * level your head) and to outline the exact area that will be measured.
 * Nothing about the image leaves the device for this. When the model can't
 * load (old phone, offline, blocked), capture still works with a plain
 * guide; the worker re-checks everything on the original.
 */

import { poseFromLandmarks, faceBox, regionPolygon } from "./core/regions.js";

const MP_VERSION = "1.1.1";
const SKIN = (window.LUMEVINA_CONFIG && window.LUMEVINA_CONFIG.skin) || {};
const BUNDLE = new URL(SKIN.mediapipeBundle || "vendor/mediapipe/vision_bundle.mjs", document.baseURI).href;
const WASM = SKIN.mediapipeWasm || `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const MODEL = SKIN.faceModel || "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";

let loading = null;

/** Resolves to a tracker, or null when the model can't run here. */
export function loadFaceTracker() {
  return (loading ??= (async () => {
    try {
      const { FilesetResolver, FaceLandmarker } = await import(BUNDLE);
      const files = await FilesetResolver.forVisionTasks(new URL(WASM, document.baseURI).href);
      const make = (delegate) => FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: new URL(MODEL, document.baseURI).href, delegate },
        runningMode: "VIDEO", numFaces: 1, minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
      });
      let lm;
      try { lm = await make("GPU"); } catch { lm = await make("CPU"); }
      return {
        /** { landmarks (normalized 0–1), pose, box, polygon(region) } for this video frame, or null when no face. */
        detect(video, ts = performance.now()) {
          const res = lm.detectForVideo(video, ts);
          const pts = res?.faceLandmarks?.[0];
          if (!pts) return null;
          return { landmarks: pts, pose: poseFromLandmarks(pts), box: faceBox(pts), polygon: (region) => regionPolygon(pts, region) };
        },
        close() { try { lm.close(); } catch { /* */ } },
      };
    } catch (e) {
      console.info("Face guide unavailable; using the plain guide.", e?.message || e);
      return null;
    }
  })());
}
