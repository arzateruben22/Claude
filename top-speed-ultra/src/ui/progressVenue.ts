// The passport card inside a venue (progress.ts): a small pill that opens to the venue's ladder, stamps, time and today's
// caps. Plain DOM with inline styles, because the game's stylesheets are switched off while a venue's page is up (they
// share class names). Honest labels: the crowd is simulated, and progress is saved on this device.
import { Progress, passportVenue, LADDER, REGULAR_SECS, LEGEND_SECS, MEMBERSHIPS, VENUE_POINTS, MARKETER } from '../game/progress';

export interface VenueCard { update(active: boolean): void; say(text: string): void; dispose(): void }

const css = (el: HTMLElement, s: Partial<CSSStyleDeclaration>) => { Object.assign(el.style, s); return el; };
const mk = (tag: string, s: Partial<CSSStyleDeclaration>, text = '') => { const e = document.createElement(tag); css(e, s); if (text) e.textContent = text; return e; };
const fmtMin = (secs: number) => { const m = Math.floor(secs / 60); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };

export function mountVenueCard(host: HTMLElement, id: string, pr: Progress): VenueCard {
  const v = passportVenue(id)!;
  const font = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const root = mk('div', { position: 'fixed', top: 'max(8px, env(safe-area-inset-top))', left: 'max(8px, env(safe-area-inset-left))', zIndex: '2147483000', fontFamily: font, color: '#eaf2ff', maxWidth: 'min(300px, calc(100vw - 16px))', pointerEvents: 'none' });
  root.dataset.passport = id;
  const pill = mk('button', { pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', gap: '8px', minHeight: '40px', padding: '6px 12px', border: '1px solid rgba(160,200,255,.45)', borderRadius: '20px', background: 'rgba(8,14,28,.82)', color: '#eaf2ff', font: `600 13px/1.2 ${font}`, cursor: 'pointer', backdropFilter: 'blur(6px)' });
  (pill as HTMLButtonElement).type = 'button'; pill.setAttribute('aria-expanded', 'false'); pill.dataset.passportPill = '';
  const panel = mk('div', { pointerEvents: 'auto', display: 'none', marginTop: '6px', padding: '12px', border: '1px solid rgba(160,200,255,.35)', borderRadius: '12px', background: 'rgba(8,14,28,.9)', backdropFilter: 'blur(8px)', font: `400 12.5px/1.45 ${font}` });
  panel.dataset.passportPanel = '';
  const msg = mk('div', { pointerEvents: 'none', marginTop: '6px', padding: '7px 11px', borderRadius: '10px', background: 'rgba(30,111,216,.92)', color: '#fff', font: `600 12.5px/1.35 ${font}`, display: 'none' });
  msg.dataset.passportMsg = ''; msg.setAttribute('role', 'status');
  root.append(pill, panel, msg);
  host.appendChild(root);
  // a tap on the card is not a tap on the venue behind it
  for (const t of ['pointerdown', 'pointerup', 'touchstart', 'mousedown', 'click', 'keydown']) root.addEventListener(t, (e) => e.stopPropagation());
  let open = false, idle = false, msgT = 0;
  pill.onclick = () => { open = !open; render(); };

  function render() {
    const p = pr.pass(id), st = pr.stampList(id), rung = p.rung;
    const found = st.spots.filter((x) => x.found).length + st.actions.filter((x) => x.found).length + (st.visit ? 1 : 0), total = st.spots.length + st.actions.length + 1;
    pill.textContent = '';
    const dot = mk('span', { width: '9px', height: '9px', borderRadius: '50%', background: idle ? '#8a96aa' : '#5eb8ff', boxShadow: idle ? 'none' : '0 0 8px #5eb8ff' });
    pill.append(dot, mk('span', {}, `Passport · ${LADDER[rung]}`), mk('span', { opacity: '.75', fontWeight: '500' }, `${found}/${total}`));
    pill.setAttribute('aria-expanded', String(open));
    panel.style.display = open ? 'block' : 'none';
    if (!open) return;
    panel.textContent = '';
    panel.append(mk('div', { font: `700 14px/1.3 ${font}`, marginBottom: '2px' }, v.name), mk('div', { opacity: '.7', marginBottom: '8px' }, `${v.note} · simulated crowd`));
    // the ladder
    const ladder = mk('div', { display: 'flex', gap: '4px', marginBottom: '8px' });
    for (let i = 1; i <= 3; i++) ladder.append(mk('div', { flex: '1', textAlign: 'center', padding: '5px 2px', borderRadius: '8px', font: `600 11px/1.2 ${font}`, background: rung >= i ? '#1e6fd8' : 'rgba(255,255,255,.08)', color: rung >= i ? '#fff' : '#9fb0c9' }, LADDER[i]));
    panel.append(ladder);
    // stamps
    const grid = mk('div', { display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' });
    const stamp = (label: string, on: boolean) => mk('span', { padding: '3px 8px', borderRadius: '12px', border: `1px solid ${on ? '#5eb8ff' : 'rgba(255,255,255,.2)'}`, background: on ? 'rgba(94,184,255,.18)' : 'transparent', color: on ? '#eaf2ff' : '#8a96aa', font: `500 11.5px/1.3 ${font}` }, (on ? '✓ ' : '') + label);
    grid.append(stamp('First visit', st.visit));
    for (const x of st.spots) grid.append(stamp(x.label, x.found));
    for (const x of st.actions) grid.append(stamp(x.label, x.found));
    panel.append(grid);
    // time and the next rung
    const secs = p.seconds, goal = rung < 2 ? REGULAR_SECS : LEGEND_SECS, left = st.spots.filter((x) => !x.found).length;
    const next = rung >= 3 ? 'Local legend reached: the ' + v.legend.name + ' paint is yours' : rung < 2 ? `Regular: ${left ? `${left} more spot${left === 1 ? '' : 's'} and ` : ''}${fmtMin(Math.max(0, REGULAR_SECS - secs))} more here` : `Local legend: ${fmtMin(Math.max(0, LEGEND_SECS - secs))} more here`;
    panel.append(mk('div', { marginBottom: '4px' }, `Active time here: ${fmtMin(secs)}${rung < 3 ? ` of ${fmtMin(goal)}` : ''}`));
    const bar = mk('div', { height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,.12)', overflow: 'hidden', marginBottom: '6px' });
    bar.append(mk('div', { height: '100%', width: `${Math.min(100, (secs / goal) * 100)}%`, background: '#5eb8ff' }));
    panel.append(bar, mk('div', { marginBottom: '8px' }, next));
    const t = pr.venueToday();
    panel.append(mk('div', { opacity: '.85' }, `Road Points from venues today: ${t.points.toFixed(1)} / ${VENUE_POINTS.perDay}`));
    if (id === 'stoppage' && pr.hasAccess('stoppage')) panel.append(mk('div', { opacity: '.85' }, `Marketer cash today: ${Math.floor(t.cash)} / ${MARKETER.perDay}`));
    if (MEMBERSHIPS[id] && !pr.hasAccess(id)) panel.append(mk('div', { opacity: '.85' }, 'Not a member yet'));
    panel.append(mk('div', { opacity: '.6', marginTop: '8px', fontSize: '11.5px' }, 'Only active time counts: walking, sitting, ordering, talking. Paused or idle time does not. Saved on this device.'));
  }
  render();
  return {
    update(active) { if (idle === !active && !open) return; idle = !active; render(); },
    say(text) { msg.textContent = text; msg.style.display = 'block'; clearTimeout(msgT); msgT = window.setTimeout(() => { msg.style.display = 'none'; }, 4200); render(); },
    dispose() { clearTimeout(msgT); root.remove(); },
  };
}
