// The OC wordmark's letterform, traced once from src/ui/assets/oc-mask.png (960 x 343, the letterform in its alpha)
// by pixel-edge following and Douglas-Peucker (1.6 px), so the car draws it in code without loading an image.
// Coordinates are the mask's own pixels (x right, y down). Fill with the nonzero rule: outer outlines and holes
// wind opposite ways. Never stretch it: drawOcMark keeps the aspect (the rule in src/ui/Mark.tsx).
export const OC_MARK_BOX = { x0: 19, y0: 20, x1: 937, y1: 314 };
export const OC_MARK: number[][] = [
  [235,20,455,21,471,25,493,39,505,58,507,71,523,56,545,41,568,30,602,21,893,20,846,91,937,92,924,93,923,95,841,98,840,100,919,102,914,109,833,112,893,116,890,122,886,123,748,126,754,128,860,133,830,135,630,136,659,98,638,98,627,103,620,110,573,182,572,193,579,199,651,199,657,192,655,189,859,189,793,292,632,300,820,302,726,305,651,304,658,306,805,312,804,314,721,314,459,307,332,307,572,300,332,296,65,295,49,291,36,284,26,274,21,265,19,243,29,220,123,82,141,61,162,45,182,34,210,24],
  [258,95,243,101,233,114,186,187,183,196,187,202,287,204,299,201,309,192,364,110,366,101,358,95],
];
// draw the mark into a 2D context, fitted (aspect kept) and centred in the box (x, y, w, h)
export function drawOcMark(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string | CanvasGradient) {
  const B = OC_MARK_BOX, bw = B.x1 - B.x0, bh = B.y1 - B.y0, s = Math.min(w / bw, h / bh);
  const ox = x + (w - bw * s) / 2 - B.x0 * s, oy = y + (h - bh * s) / 2 - B.y0 * s;
  g.save(); g.fillStyle = fill; g.beginPath();
  for (const P of OC_MARK) { g.moveTo(ox + P[0] * s, oy + P[1] * s); for (let i = 2; i < P.length; i += 2) g.lineTo(ox + P[i] * s, oy + P[i + 1] * s); g.closePath(); }
  g.fill('nonzero'); g.restore();
}
