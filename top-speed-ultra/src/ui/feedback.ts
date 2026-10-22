// The feedback report as text a player can paste to us: the device, the graphics preset, the frame rate and the
// drive. The game never sends it anywhere itself; the player copies or shares it.
import type { Report } from '../game/Game';
import { MODES } from '../game/settings';

const pad2 = (n: number) => String(n).padStart(2, '0');

export function formatReport(r: Report): string {
  const mem = r.memoryGB ? ` · ${r.memoryGB} GB` : '';
  const drive = r.attract ? 'On the menu' : `${MODES[r.mode].label} on ${r.road} at ${r.mph} mph · ${r.density} traffic · ${r.cars} cars · ${pad2(Math.floor(r.runSeconds / 60))}:${pad2(r.runSeconds % 60)} in`;
  return [
    `OC Ultra ${r.version} · feedback report (${r.host})`,
    `Device: ${r.ua}`,
    `Screen: ${r.screen}, ${r.pointer} · ${r.cores || '?'} cores${mem}`,
    `GPU: ${r.gpu}`,
    `Graphics: ${r.quality}, adaptive ${r.adaptive ? 'on' : 'off'}, pixel ratio ${r.pixelRatio}, buffer ${r.buffer}`,
    `Frame rate: ${r.fps} fps · ${r.calls} draw calls · ${Math.round(r.tris / 1000)}k triangles · ${r.textures} textures`,
    `Drive: ${drive}`,
    `Sky: ${r.time}, ${r.weather} · Ultra Realism ${r.ultra ? 'on' : 'off'}`,
    `Live: ${r.live}`,
    'What happened: ',
  ].join('\n');
}

// copy to the clipboard where allowed, else select the text so the player can copy it
export async function copyText(text: string, el: HTMLTextAreaElement | null): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* no permission or no clipboard API */ }
  if (el) { el.focus(); el.select(); try { return document.execCommand('copy'); } catch { return false; } }
  return false;
}
