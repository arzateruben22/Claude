// The live server's UI: the account panel (sign up, log in, log out, the server's address) and the small pieces the
// menu and the drive show (the Live section, the chip in the top bar). Honest copy throughout: it is an alpha on
// one small server with a cap, and the other drivers are ghosts.

import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Settings } from '../game/settings';
import { liveApi, liveBase, saveLogin, LiveInfo } from '../live/client';

export const DEFAULT_CAP = 25;      // the server's own default (live/server.mjs MAX_PLAYERS); the real number comes with 'welcome'

export function AccountPanel({ settings, update, name, token, onLogin, onLogout, onClose, toast }: {
  settings: Settings; update: (p: Partial<Settings>) => void; name: string; token: string;
  onLogin: (token: string, name: string) => void; onLogout: () => void; onClose: () => void; toast: (t: string, k?: string) => void;
}) {
  const [mode, setMode] = useState<'login' | 'signup'>(name ? 'login' : 'signup');
  const [user, setUser] = useState(''); const [pw, setPw] = useState(''); const [email, setEmail] = useState(''); const [over13, setOver13] = useState(false);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const base = liveBase(settings.liveUrl);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!base) { setError('Enter the server address first.'); return; }
    setBusy(true); setError('');
    const r = mode === 'signup' ? await liveApi.signup(base, user.trim(), pw, email.trim(), over13) : await liveApi.login(base, user.trim(), pw);
    setBusy(false);
    if (!r.ok) { setError(String(r.data.error || 'That didn\'t work.')); return; }
    const t = String(r.data.token), n = String((r.data.player as { name: string }).name);
    saveLogin(t, n); onLogin(t, n); setPw('');
    toast(mode === 'signup' ? `Welcome, ${n}` : `Signed in as ${n}`, 'good');
  };
  const [pw2, setPw2] = useState(''), [pw3, setPw3] = useState('');
  const changePw = async (e: FormEvent) => {
    e.preventDefault(); if (!base) return;
    setBusy(true); setError('');
    const r = await liveApi.password(base, token, pw, pw2);
    setBusy(false);
    if (!r.ok) { setError(String(r.data.error || 'That didn\'t work.')); return; }
    const t = String(r.data.token); saveLogin(t, name); onLogin(t, name); setPw(''); setPw2('');
    toast('Password changed', 'good');
  };
  const remove = async (e: FormEvent) => {
    e.preventDefault(); if (!base) return;
    setBusy(true); setError('');
    const r = await liveApi.remove(base, token, pw3);
    setBusy(false);
    if (!r.ok) { setError(String(r.data.error || 'That didn\'t work.')); return; }
    saveLogin('', ''); onLogout(); setPw3('');
    toast('Account deleted', 'info');
  };
  const logout = async () => {
    if (base && token) void liveApi.logout(base, token);
    saveLogin('', ''); onLogout(); toast('Signed out', 'info');
  };

  return <>
    <h2>Live account</h2>
    <p className="fine">Live driving is an alpha on one small server. It holds a limited number of drivers at once ({DEFAULT_CAP} to start); past that you wait in line and are let in in order. The server only relays where each car is: scores, credits and progress stay on this device. No chat.</p>
    <div className="field"><label htmlFor="live-url">Server address</label>
      <input id="live-url" className="text" type="url" inputMode="url" autoComplete="off" spellCheck={false} placeholder="https://live.example.com" value={settings.liveUrl} onChange={(e) => update({ liveUrl: e.target.value })} />
      <p className="fine">{settings.liveUrl ? '' : base ? `Using this page's own host (${base}).` : 'Needed when the game is opened from disk or from another host. Ask whoever runs the server.'}</p>
    </div>
    {name ? <>
      <div className="who"><span className="avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span><div className="who-main"><b className="name-static">{name}</b><p>Signed in on this device</p></div></div>
      <div className="row"><button className="btn primary" onClick={onClose}>Done</button><button className="btn" onClick={() => void logout()}>Log out</button></div>
      <details className="acct-more">
        <summary>Change password</summary>
        <form className="stack form" onSubmit={(e) => void changePw(e)}>
          <div className="field"><label htmlFor="live-cur">Current password</label><input id="live-cur" className="text" type="password" autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} /></div>
          <div className="field"><label htmlFor="live-new">New password</label><input id="live-new" className="text" type="password" autoComplete="new-password" minLength={8} required value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
          <div className="row"><button className="btn" type="submit" disabled={busy}>Change password</button></div>
        </form>
      </details>
      <details className="acct-more">
        <summary>Delete account</summary>
        <form className="stack form" onSubmit={(e) => void remove(e)}>
          <p className="fine">This deletes your account from the live server: your name, the optional email and the password. Your progress on this device stays. It can't be undone.</p>
          <div className="field"><label htmlFor="live-del">Password</label><input id="live-del" className="text" type="password" autoComplete="current-password" required value={pw3} onChange={(e) => setPw3(e.target.value)} /></div>
          <div className="row"><button className="btn danger" type="submit" disabled={busy}>Delete my account</button></div>
        </form>
      </details>
      {error && <p className="fine bad" role="alert">{error}</p>}
    </> : <form className="stack form" onSubmit={(e) => void submit(e)}>
      <div className="seg" role="group" aria-label="Sign up or log in" data-n={2} style={{ '--n': 2 } as Record<string, number>}>
        <button type="button" aria-pressed={mode === 'login'} onClick={() => { setMode('login'); setError(''); }}>Log in</button>
        <button type="button" aria-pressed={mode === 'signup'} onClick={() => { setMode('signup'); setError(''); }}>Sign up</button>
      </div>
      <div className="field"><label htmlFor="live-name">Driver name</label><input id="live-name" className="text" autoComplete="username" autoCapitalize="off" maxLength={16} pattern="[A-Za-z0-9_]{3,16}" title="3 to 16 letters, numbers or underscores" required value={user} onChange={(e) => setUser(e.target.value)} /></div>
      <div className="field"><label htmlFor="live-pw">Password</label><input id="live-pw" className="text" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} /></div>
      {mode === 'signup' && <>
        <div className="field"><label htmlFor="live-email">Email <span className="muted">optional</span></label><input id="live-email" className="text" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /><p className="fine">Only for getting back in if you forget the password (password reset isn't built yet). Nothing is sent to it today.</p></div>
        <label className="toggle check"><input type="checkbox" checked={over13} onChange={(e) => setOver13(e.target.checked)} required /><span>I'm 13 or older</span></label>
      </>}
      {error && <p className="fine bad" role="alert">{error}</p>}
      <div className="row"><button className="btn primary" type="submit" disabled={busy}>{busy ? 'One moment' : mode === 'signup' ? 'Create account' : 'Log in'}</button><button className="btn" type="button" onClick={onClose}>Back</button></div>
    </form>}
  </>;
}

// the chip in the top bar while driving live; tapped while online, it lists who's on (names only)
export interface Who { id: number; name: string; road: string }
export function LiveChip({ info, me, people, canJoin, onJoin }: { info: LiveInfo; me: string; people: () => Who[]; canJoin: boolean; onJoin: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const text = info.status === 'online' ? `Live ${info.online}/${info.cap}` : info.status === 'queued' ? `In line #${info.position}` : info.status === 'connecting' ? 'Live…' : info.status === 'error' ? 'Live off' : '';
  if (!text) return null;
  if (info.status !== 'online') return <div className={'tbtn livechip ' + info.status} role="status" aria-live="polite" title={info.error || undefined}>{text}</div>;
  const list = open ? people().filter((w) => w.name && w.name !== me).sort((a, b) => a.name.localeCompare(b.name)) : [];
  return <div className="livewrap">
    <button type="button" className={'tbtn livechip ' + info.status} aria-expanded={open} aria-label={`${text}. Who's driving`} onClick={() => setOpen((o) => !o)}>{text}</button>
    {open && <div className="livewho" role="dialog" aria-label="Who's driving">
      <p className="eyebrow">Driving now · {info.online} of {info.cap}</p>
      <ul>
        <li><span><b>{me}</b><em> you</em></span></li>
        {list.map((w) => <li key={w.id}><span><b>{w.name}</b><small>{w.road || 'getting going'}</small></span>
          {canJoin && w.road && <button type="button" className="btn join" onClick={() => { onJoin(w.id); setOpen(false); }}>Drive with</button>}</li>)}
      </ul>
      {!canJoin && list.length > 0 && <p className="fine">Drive with someone from Free Drive.</p>}
    </div>}
  </div>;
}
