// The small controls the menu, Settings and the panels share: a segmented choice, a switch, a slider, a disclosure and
// the handling control. Plain React, no state of their own beyond a disclosure's open flag.

import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { PROFILES, PROFILE_IDS, profileOf, customLine } from '../game/settings';

// how far along a range input is, for the filled part of its track
export function fill(v: number, min: number, max: number): CSSProperties {
  return { '--v': `${(((v - min) / (max - min || 1)) * 100).toFixed(1)}%` } as CSSProperties;
}
// a segmented control: one rounded track, the chosen segment raised in it. --n sets the columns (styles.css wraps a
// six-way choice into two rows on a phone)
export function Seg<T extends string>({ value, options, labels, onChange, label }: { value: T; options: T[]; labels: (v: T) => string; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="seg" role="group" aria-label={label} data-n={options.length} style={{ '--n': options.length } as CSSProperties}>
      {options.map((o) => <button key={o} type="button" aria-pressed={o === value} onClick={() => onChange(o)}>{labels(o)}</button>)}
    </div>
  );
}
// a switch: a real checkbox drawn as a switch (styles.css), its label to the left and an optional one-line help under it
export function Toggle({ label, value, onChange, help }: { label: string; value: boolean; onChange: (v: boolean) => void; help?: string }) {
  return <label className={'toggle' + (help ? ' has-help' : '')}><input type="checkbox" role="switch" checked={value} onChange={(e) => onChange(e.target.checked)} /><span>{label}{help && <small>{help}</small>}</span></label>;
}
export function Range({ label, min, max, step, value, fmt, onChange, help }: { label: string; min: number; max: number; step: number; value: number; fmt: (v: number) => string; onChange: (v: number) => void; help?: string }) {
  const id = 'r-' + label.replace(/\W+/g, '');
  return <div className="field"><label htmlFor={id}>{label} <output>{fmt(value)}</output></label><input id={id} type="range" min={min} max={max} step={step} value={value} style={fill(value, min, max)} onChange={(e) => onChange(Number(e.target.value))} />{help && <p className="help">{help}</p>}</div>;
}
// a disclosure: a button that opens a block under it ("Compare handling", "Performance details")
export function Disclosure({ label, children, id }: { label: string; children: ReactNode; id: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={'disc' + (open ? ' open' : '')}>
      <button type="button" className="disc-btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <span>{label}</span>
        <svg viewBox="0 0 14 8" width="14" height="8" aria-hidden="true"><path d="M1 1l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      <div id={id} className="disc-body" hidden={!open}>{children}</div>
    </div>
  );
}
// the handling slider (0 arcade .. 1 simulation, the one saved value the physics reads) with its named profiles: each
// button puts the slider on its point (settings.ts PROFILES), anywhere else on the slider reads Custom. The line under it
// says what the current point changes; "Compare handling" opens all three side by side (the Custom line joins them,
// lit, with no profile pressed). The ticks under the track mark the three points.
export function Handling({ value, onChange }: { value: number; onChange: (h: number) => void }) {
  const cur = profileOf(value);
  const name = cur === 'custom' ? 'Custom' : PROFILES[cur].label;
  return (
    <div className="field handling">
      <label htmlFor="handling">Handling <output>{name} · {value.toFixed(2)}</output></label>
      <div className="seg" role="group" aria-label="Handling profile" data-n={3}>
        {PROFILE_IDS.map((id) => <button key={id} type="button" aria-pressed={cur === id} onClick={() => onChange(PROFILES[id].h)}>{PROFILES[id].label}</button>)}
      </div>
      <div className="slider"><span>Arcade</span>
        <div className="htrack">
          <input id="handling" type="range" min={0} max={1} step={0.05} value={value} style={fill(value, 0, 1)} aria-valuetext={`${name}, ${value.toFixed(2)}`} onChange={(e) => onChange(Number(e.target.value))} />
          {PROFILE_IDS.map((id) => <i key={id} aria-hidden="true" className={cur === id ? 'on' : ''} style={{ '--at': PROFILES[id].h } as CSSProperties} />)}
        </div>
        <span>Sim</span></div>
      <p className="help now" aria-live="polite">{cur === 'custom' ? customLine(value) : PROFILES[cur].line}</p>
      <Disclosure label="Compare handling" id="compare-handling">
        <dl className="profiles">
          {PROFILE_IDS.map((id) => <div key={id} className={cur === id ? 'on' : ''}><dt>{PROFILES[id].label}</dt><dd>{PROFILES[id].line}</dd></div>)}
          {cur === 'custom' && <div className="on"><dt>Custom</dt><dd>{customLine(value)}</dd></div>}
        </dl>
      </Disclosure>
    </div>
  );
}
