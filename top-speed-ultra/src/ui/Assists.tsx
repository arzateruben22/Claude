// The Ultra skin's ABS | TCS bar (owner, 2026-11-23, the Ultra HUD design): a pill under the speed card with two
// labelled switches. They are real: each sets the car's own system (Settings.abs / .tcs, which Game.ts copies to the
// Physics object's `abs` / `tc` flags), saved with the settings (both on by default), and the cockpit display's TCS and
// ABS chips follow them (Game.ts passes phys.tc / phys.abs to the dash). Buttons with role="switch", so the keyboard
// reaches them by Tab and a screen reader hears on/off. hud-ultra.css draws them (the amber lit track when on, a dark
// track when off, a knurled steel knob that slides); the Retro design has no bar, so App passes them on Ultra only.

export interface AssistsProps { abs: boolean; tcs: boolean; onChange: (k: 'abs' | 'tcs', on: boolean) => void }

function Switch({ k, label, on, onChange, title }: { k: 'abs' | 'tcs'; label: string; on: boolean; onChange: AssistsProps['onChange']; title: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={'asw ' + k + (on ? ' on' : '')} title={title}
      onClick={(e) => { onChange(k, !on); if (e.detail > 0) e.currentTarget.blur(); /* a tap: Space (the handbrake) mustn't flip it again */ }}>
      <b>{label}</b>
      <span className="asw-track" aria-hidden="true"><i className="asw-knob" /></span>
    </button>
  );
}

export function Assists({ abs, tcs, onChange }: AssistsProps) {
  return (
    <div className="hud-assists" role="group" aria-label="Driver assists">
      <Switch k="abs" label="ABS" on={abs} onChange={onChange} title="Anti-lock brakes" />
      <i className="asw-sep" aria-hidden="true" />
      <Switch k="tcs" label="TCS" on={tcs} onChange={onChange} title="Traction control" />
    </div>
  );
}
