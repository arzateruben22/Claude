// The Rossini GT's instruments, drawn in code: a round analogue tachometer of our own design (graphite face with
// fine concentric graining, off-white backlit numerals 0-10, a red line from 8,500, a digital gear and speed window)
// and two small displays either side (drive data on the left, navigation on the right). Each comes as a colour map
// (what the face looks like by day) and an emissive map (what the backlight lights up).
import * as THREE from 'three';
import { once, canvas } from './car-tex';

export const TACH = { start: (225 * Math.PI) / 180, sweep: (270 * Math.PI) / 180, max: 10000, red: 8500 };
// the needle's angle (radians, counter-clockwise from 3 o'clock) for an rpm
export const tachAngle = (rpm: number) => TACH.start - (Math.min(TACH.max, Math.max(0, rpm)) / TACH.max) * TACH.sweep;
const FONT = 'Arial, Helvetica, sans-serif';

function tex(c: HTMLCanvasElement) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }

export function tachTextures(n = 1024) {
  return once('tach' + n, () => {
    const [c, g] = canvas(n, n), [ce, ge] = canvas(n, n);
    const cx = n / 2, cy = n / 2, R = n * 0.48;
    // face: graphite, a lighter chapter ring, concentric graining
    const bg = g.createRadialGradient(cx, cy * 0.85, R * 0.05, cx, cy, R);
    bg.addColorStop(0, '#26292e'); bg.addColorStop(0.6, '#15171a'); bg.addColorStop(1, '#0b0c0e');
    g.fillStyle = bg; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    for (let r = R * 0.1; r < R * 0.86; r += 1.5) { g.strokeStyle = `rgba(255,255,255,${0.012 + 0.012 * Math.sin(r * 0.7)})`; g.lineWidth = 0.8; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); }
    g.strokeStyle = '#2b2e33'; g.lineWidth = R * 0.1; g.beginPath(); g.arc(cx, cy, R * 0.93, 0, Math.PI * 2); g.stroke();
    ge.fillStyle = '#000'; ge.fillRect(0, 0, n, n);
    const both = (f: (k: CanvasRenderingContext2D, lit: boolean) => void) => { f(g, false); f(ge, true); };
    const P = (a: number, r: number): [number, number] => [cx + Math.cos(a) * r, cy - Math.sin(a) * r];
    // red line: a band from 8,500 to 10,000
    both((k, lit) => { k.strokeStyle = lit ? '#ff1a10' : '#c8161b'; k.lineWidth = R * 0.055; k.beginPath(); k.arc(cx, cy, R * 0.86, -tachAngle(TACH.red), -tachAngle(TACH.max)); k.stroke(); });
    // ticks: every 250, longer at 500 and 1,000
    for (let v = 0; v <= TACH.max; v += 250) {
      const a = tachAngle(v), major = v % 1000 === 0, half = v % 500 === 0, red = v >= TACH.red;
      const r0 = R * (major ? 0.76 : half ? 0.8 : 0.83), r1 = R * 0.89;
      both((k, lit) => {
        k.strokeStyle = red ? (lit ? '#ff3a30' : '#ff4a40') : lit ? '#fff4e4' : '#ecebe6';
        k.lineWidth = n * (major ? 0.009 : half ? 0.005 : 0.003);
        const [x0, y0] = P(a, r0), [x1, y1] = P(a, r1); k.beginPath(); k.moveTo(x0, y0); k.lineTo(x1, y1); k.stroke();
      });
      if (major) both((k, lit) => {
        k.fillStyle = red ? (lit ? '#ff3a30' : '#ff4a40') : lit ? '#fff4e4' : '#f0efea';
        k.font = `600 ${R * 0.15}px ${FONT}`; k.textAlign = 'center'; k.textBaseline = 'middle';
        const [x, y] = P(a, R * 0.6); k.fillText(String(v / 1000), x, y + R * 0.01);
      });
    }
    // labels and the wordmark
    both((k, lit) => {
      k.fillStyle = lit ? 'rgba(255,240,220,0.55)' : '#9da2a8'; k.textAlign = 'center'; k.textBaseline = 'middle';
      k.font = `500 ${R * 0.055}px ${FONT}`; k.fillText('x1000 r/min', cx, cy + R * 0.21);
      k.font = `600 ${R * 0.06}px ${FONT}`;
      const word = 'R O S S I N I'; k.fillText(word, cx, cy - R * 0.3);
    });
    // the digital window: gear and speed
    const wx = cx - R * 0.2, wy = cy + R * 0.34, ww = R * 0.4, wh = R * 0.3;
    g.fillStyle = '#050607'; g.beginPath(); g.roundRect(wx, wy, ww, wh, R * 0.03); g.fill();
    g.strokeStyle = '#3a3e44'; g.lineWidth = 3; g.stroke();
    both((k, lit) => {
      k.fillStyle = lit ? '#ffb04a' : '#e89a3c'; k.textAlign = 'center'; k.textBaseline = 'middle';
      k.font = `700 ${R * 0.16}px ${FONT}`; k.fillText('6', cx, wy + wh * 0.38);
      k.fillStyle = lit ? '#f4f1ea' : '#d8d6d0'; k.font = `600 ${R * 0.07}px ${FONT}`; k.fillText('64 mph', cx, wy + wh * 0.8);
    });
    return { map: tex(c), emissiveMap: tex(ce) };
  });
}

function screen(w: number, h: number, draw: (g: CanvasRenderingContext2D, lit: boolean) => void) {
  const [c, g] = canvas(w, h);
  draw(g, true);
  return tex(c);
}
// left: drive data (mode, tyres, oil and water, trip)
export function leftScreenTex() {
  return once('scrL', () => screen(512, 320, (g) => {
    g.fillStyle = '#05070a'; g.fillRect(0, 0, 512, 320);
    const gr = g.createLinearGradient(0, 0, 0, 320); gr.addColorStop(0, 'rgba(40,60,90,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 512, 320);
    g.fillStyle = '#e89a3c'; g.font = `700 30px ${FONT}`; g.textAlign = 'left'; g.fillText('SPORT', 24, 46);
    g.fillStyle = '#8f98a3'; g.font = `500 20px ${FONT}`; g.fillText('TYRES  psi / °F', 24, 92);
    // a plan of the car with the four tyres
    g.strokeStyle = '#4b5561'; g.lineWidth = 3; g.beginPath(); g.roundRect(196, 108, 120, 190, 36); g.stroke();
    const tyre = (x: number, y: number, p: string, t: string) => { g.fillStyle = '#2bd17e'; g.beginPath(); g.roundRect(x, y, 22, 46, 6); g.fill(); g.fillStyle = '#e8ecef'; g.font = `600 22px ${FONT}`; g.textAlign = x < 256 ? 'right' : 'left'; g.fillText(p, x < 256 ? x - 10 : x + 32, y + 20); g.fillStyle = '#8f98a3'; g.font = `500 18px ${FONT}`; g.fillText(t, x < 256 ? x - 10 : x + 32, y + 44); };
    tyre(184, 122, '33.5', '172'); tyre(306, 122, '33.5', '175'); tyre(184, 236, '32.0', '181'); tyre(306, 236, '32.0', '183');
    g.textAlign = 'left'; g.fillStyle = '#8f98a3'; g.font = `500 20px ${FONT}`; g.fillText('OIL', 410, 140); g.fillText('WATER', 410, 214);
    g.fillStyle = '#e8ecef'; g.font = `600 26px ${FONT}`; g.fillText('212°', 410, 172); g.fillText('196°', 410, 246);
    g.fillStyle = '#8f98a3'; g.font = `500 18px ${FONT}`; g.fillText('TRIP  38.4 mi', 24, 300);
  }));
}
// right: navigation on a dark map: the 405 north, the next exit, the time and the outside air
export function rightScreenTex() {
  return once('scrR', () => screen(512, 320, (g) => {
    g.fillStyle = '#070a0e'; g.fillRect(0, 0, 512, 320);
    // blocks and streets
    g.strokeStyle = '#1b222b'; g.lineWidth = 10;
    for (let i = -2; i < 9; i++) { g.beginPath(); g.moveTo(i * 70, 320); g.lineTo(i * 70 + 220, 0); g.stroke(); }
    g.strokeStyle = '#141a21'; g.lineWidth = 6;
    for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(0, i * 48); g.lineTo(512, i * 48 - 90); g.stroke(); }
    // the freeway and the route
    g.strokeStyle = '#3a4350'; g.lineWidth = 26; g.beginPath(); g.moveTo(170, 330); g.bezierCurveTo(230, 220, 300, 120, 470, -10); g.stroke();
    g.strokeStyle = '#e89a3c'; g.lineWidth = 9; g.beginPath(); g.moveTo(170, 330); g.bezierCurveTo(230, 220, 300, 120, 470, -10); g.stroke();
    // our position
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(222, 238); g.lineTo(206, 270); g.lineTo(222, 262); g.lineTo(238, 270); g.closePath(); g.fill();
    // shield and next exit
    g.fillStyle = '#1f4fb4'; g.beginPath(); g.moveTo(26, 22); g.lineTo(78, 22); g.lineTo(78, 52); g.quadraticCurveTo(52, 74, 26, 52); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.font = `700 20px ${FONT}`; g.textAlign = 'center'; g.fillText('405', 52, 46);
    g.textAlign = 'left'; g.font = `600 22px ${FONT}`; g.fillText('N', 90, 46);
    g.fillStyle = 'rgba(8,11,15,0.86)'; g.fillRect(0, 248, 512, 72);
    g.fillStyle = '#e8ecef'; g.font = `600 24px ${FONT}`; g.fillText('Exit  Jamboree Rd', 24, 280);
    g.fillStyle = '#e89a3c'; g.font = `700 24px ${FONT}`; g.fillText('0.8 mi', 24, 308);
    g.fillStyle = '#8f98a3'; g.font = `500 20px ${FONT}`; g.textAlign = 'right'; g.fillText('6:12 PM   74°F', 488, 308);
  }));
}

// the Vela E's displays, one atlas: the top half is the wide driver display (power meter, speed, gear, battery,
// range, the next exit); the bottom right is the centre touchscreen (a map with the route and the climate strip)
export function velaScreenTex() {
  return once('scrV', () => screen(1024, 512, (g) => {
    g.fillStyle = '#04060a'; g.fillRect(0, 0, 1024, 512);
    // ---- driver display (0..1024 x 0..256)
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(50,80,120,0.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 256);
    // power / regen arc
    g.lineCap = 'round';
    g.strokeStyle = '#1d2733'; g.lineWidth = 14; g.beginPath(); g.arc(150, 150, 96, Math.PI * 0.8, Math.PI * 2.2); g.stroke();
    g.strokeStyle = '#4fb3ff'; g.beginPath(); g.arc(150, 150, 96, Math.PI * 1.25, Math.PI * 1.62); g.stroke();
    g.strokeStyle = '#2bd17e'; g.beginPath(); g.arc(150, 150, 96, Math.PI * 1.1, Math.PI * 1.25); g.stroke();
    g.fillStyle = '#8f98a3'; g.font = `500 22px ${FONT}`; g.textAlign = 'center'; g.fillText('kW', 150, 150); g.fillStyle = '#e8ecef'; g.font = `600 34px ${FONT}`; g.fillText('186', 150, 190);
    // speed and gear
    g.fillStyle = '#f2f5f8'; g.font = `300 132px ${FONT}`; g.fillText('68', 470, 168);
    g.fillStyle = '#8f98a3'; g.font = `500 24px ${FONT}`; g.fillText('MPH', 470, 206);
    g.fillStyle = '#4fb3ff'; g.font = `700 30px ${FONT}`; g.fillText('D', 600, 92);
    g.fillStyle = '#5d6672'; g.font = `600 30px ${FONT}`; g.fillText('P  R  N', 600 - 104, 92);
    // battery and range
    g.textAlign = 'left'; g.strokeStyle = '#8f98a3'; g.lineWidth = 3; g.strokeRect(700, 78, 120, 44); g.fillStyle = '#8f98a3'; g.fillRect(822, 92, 7, 16);
    g.fillStyle = '#2bd17e'; g.fillRect(705, 83, 86, 34);
    g.fillStyle = '#e8ecef'; g.font = `600 30px ${FONT}`; g.fillText('78%', 846, 112);
    g.fillStyle = '#8f98a3'; g.font = `500 24px ${FONT}`; g.fillText('241 mi range', 700, 160);
    g.fillStyle = '#e8ecef'; g.font = `600 24px ${FONT}`; g.fillText('Exit Jamboree Rd  0.8 mi', 700, 210);
    g.fillStyle = '#4b5561'; g.fillRect(40, 236, 944, 2);
    // ---- centre touchscreen (716..1024 x 256..512): the map
    const x0 = 716, y0 = 256;
    g.save(); g.beginPath(); g.rect(x0, y0, 308, 256); g.clip();
    g.fillStyle = '#0a0e13'; g.fillRect(x0, y0, 308, 256);
    g.strokeStyle = '#18202a'; g.lineWidth = 8; for (let i = -2; i < 7; i++) { g.beginPath(); g.moveTo(x0 + i * 60, y0 + 256); g.lineTo(x0 + i * 60 + 160, y0); g.stroke(); }
    g.strokeStyle = '#3a4350'; g.lineWidth = 20; g.beginPath(); g.moveTo(x0 + 90, y0 + 270); g.bezierCurveTo(x0 + 140, y0 + 170, x0 + 190, y0 + 90, x0 + 320, y0 - 10); g.stroke();
    g.strokeStyle = '#4fb3ff'; g.lineWidth = 7; g.beginPath(); g.moveTo(x0 + 90, y0 + 270); g.bezierCurveTo(x0 + 140, y0 + 170, x0 + 190, y0 + 90, x0 + 320, y0 - 10); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x0 + 128, y0 + 188); g.lineTo(x0 + 116, y0 + 212); g.lineTo(x0 + 128, y0 + 206); g.lineTo(x0 + 140, y0 + 212); g.closePath(); g.fill();
    g.fillStyle = 'rgba(8,11,15,0.9)'; g.fillRect(x0, y0 + 206, 308, 50);
    g.fillStyle = '#e8ecef'; g.font = `600 22px ${FONT}`; g.textAlign = 'left'; g.fillText('71°F   AUTO', x0 + 16, y0 + 240);
    g.fillStyle = '#8f98a3'; g.textAlign = 'right'; g.fillText('6:12 PM', x0 + 296, y0 + 240);
    g.restore();
  }));
}

// small labels for buttons: an atlas of 8 icons, 64 px each, white on black
export function iconAtlas() {
  return once('icons', () => {
    const [c, g] = canvas(512, 64);
    g.fillStyle = '#121315'; g.fillRect(0, 0, 512, 64);
    g.strokeStyle = '#e8e8e4'; g.fillStyle = '#e8e8e4'; g.lineWidth = 4; g.lineCap = 'round';
    const at = (i: number, f: () => void) => { g.save(); g.translate(i * 64, 0); f(); g.restore(); };
    at(0, () => { g.beginPath(); g.moveTo(16, 32); g.lineTo(40, 16); g.lineTo(40, 48); g.closePath(); g.fill(); });                          // left
    at(1, () => { g.beginPath(); g.moveTo(48, 32); g.lineTo(24, 16); g.lineTo(24, 48); g.closePath(); g.fill(); });                          // right
    at(2, () => { g.beginPath(); g.arc(38, 32, 11, -1.6, 1.6); g.stroke(); for (const y of [22, 32, 42]) { g.beginPath(); g.moveTo(12, y); g.lineTo(24, y); g.stroke(); } });   // lights
    at(3, () => { g.beginPath(); g.arc(32, 46, 22, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); g.beginPath(); g.moveTo(32, 46); g.lineTo(44, 24); g.stroke(); });            // wiper
    at(4, () => { g.beginPath(); g.arc(32, 26, 8, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(32, 30, 15, 0.3, Math.PI - 0.3); g.stroke(); g.beginPath(); g.moveTo(32, 45); g.lineTo(32, 52); g.stroke(); });  // voice
    at(5, () => { g.beginPath(); g.moveTo(10, 40); for (let x = 10; x <= 54; x += 11) g.lineTo(x, 40 + (x % 22 ? -9 : 0)); g.stroke(); });       // road
    at(6, () => { g.font = `700 22px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('LC', 32, 33); });
    at(7, () => { g.font = `700 18px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('AUTO', 32, 33); });
    const t = tex(c); return t;
  });
}
// the engine start button's face: white letters on red
export function startTex() {
  return once('start', () => {
    const [c, g] = canvas(128, 128);
    const gr = g.createRadialGradient(56, 50, 4, 64, 64, 64); gr.addColorStop(0, '#e1262c'); gr.addColorStop(1, '#a50f14');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#fff'; g.font = `700 20px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('ENGINE', 64, 42); g.fillText('START', 64, 64); g.fillText('STOP', 64, 86);
    return tex(c);
  });
}
// the drive-mode dial's scale: printed round its ring
export function modeDialTex() {
  return once('modedial', () => {
    const [c, g] = canvas(256, 256);
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = '#e8e8e4'; g.font = `700 20px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    ['WET', 'ROAD', 'SPORT', 'TRACK', 'ESC'].forEach((t, i) => {
      const a = Math.PI * (0.95 - i * 0.225), r = 104;
      g.save(); g.translate(128 + Math.cos(a) * r, 128 - Math.sin(a) * r); g.rotate(Math.PI / 2 - a); g.fillText(t, 0, 0); g.restore();
    });
    return tex(c);
  });
}
