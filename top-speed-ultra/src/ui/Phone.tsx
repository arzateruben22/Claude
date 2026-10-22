// The in-game phone (U6 in PROJECT_OC_UI_TARGET.md; the style library's 09_PHONE_UI): a phone-shaped overlay that
// slides in from the right of the pause screen. Its apps open only what exists (the map, the garage, the races, the
// radio, your bests, your profile, settings, feedback, your homes, your credits, and since 2026-10-21 the story's
// Messages and Contacts, story.ts). The clock is this device's. Credits are earned by driving; nothing on the phone
// costs real money, and no message is sent or received over a network: the characters are the game's own.
import { useEffect, useState } from 'react';
import { Ico } from './Icons';
import type { ProfileBook } from '../game/profile';
import { inbox, unread, contacts, characterById, jobText, type Message, type Job } from '../game/story';

export type PhoneApp = 'map' | 'garage' | 'course' | 'radio' | 'board' | 'profile' | 'settings' | 'feedback' | 'homes';
interface App { id: PhoneApp | 'credits' | 'messages' | 'contacts'; name: string; icon: Parameters<typeof Ico>[0]['name']; off?: boolean }
const APPS: App[] = [
  { id: 'map', name: 'Map', icon: 'map' }, { id: 'garage', name: 'Garage', icon: 'garage' }, { id: 'course', name: 'Races', icon: 'drive' },
  { id: 'radio', name: 'Radio', icon: 'radio' }, { id: 'credits', name: 'Credits', icon: 'career' }, { id: 'board', name: 'Bests', icon: 'bests' },
  { id: 'profile', name: 'Profile', icon: 'driver' }, { id: 'settings', name: 'Settings', icon: 'settings' }, { id: 'feedback', name: 'Feedback', icon: 'nav' },
  { id: 'homes', name: 'Homes', icon: 'home' }, { id: 'messages', name: 'Messages', icon: 'chat' }, { id: 'contacts', name: 'Contacts', icon: 'driver' },
];

interface PhoneProps { name: string; credits: number; level: number; book: ProfileBook; onOpen: (a: PhoneApp) => void; onJob: (j: Job) => void; onClose: () => void }
export function Phone({ name, credits, level, book, onOpen, onJob, onClose }: PhoneProps) {
  const [now, setNow] = useState(() => new Date());
  const [app, setApp] = useState<'home' | 'credits' | 'messages' | 'contacts'>('home');
  const [thread, setThread] = useState<string | null>(null);
  const p = book.p, msgs = inbox(p, level), fresh = unread(p, level);
  // opening a thread reads it (kept on the profile)
  const open = (who: string) => {
    setThread(who);
    const ids = msgs.filter((m) => m.from === who && !p.story.read.includes(m.id)).map((m) => m.id);
    if (ids.length) { p.story.read.push(...ids); book.save(); }
  };
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t); }, []);
  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return (
    <div className="overlay phone-wrap" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="phone" role="dialog" aria-label="Phone">
        <header className="ph-status"><b>{time}</b><span className="ph-notch" aria-hidden="true" /><span>OC Life</span></header>
        {app === 'home' ? <>
          <div className="ph-hello"><small>Level {level}</small><b>{name}</b></div>
          <div className="ph-grid">
            {APPS.map((a) => (
              <button key={a.id} type="button" className={'ph-app' + (a.off ? ' off' : '')} disabled={a.off} aria-label={a.off ? `${a.name}, roadmap` : a.name}
                onClick={() => (a.id === 'credits' || a.id === 'messages' || a.id === 'contacts' ? (setApp(a.id), setThread(null)) : !a.off && onOpen(a.id as PhoneApp))}>
                <i aria-hidden="true"><Ico name={a.icon} /></i><span>{a.name}</span>{a.off && <em>Roadmap</em>}
                {a.id === 'messages' && fresh > 0 && <em className="ph-badge" aria-label={`${fresh} unread`}>{fresh}</em>}
              </button>
            ))}
          </div>
        </> : app === 'messages' ? (
          thread ? <Thread who={thread} msgs={msgs.filter((m) => m.from === thread)} done={p.story.done} onBack={() => setThread(null)} onJob={onJob} />
          : <div className="ph-list">
            <button type="button" className="ph-back" onClick={() => setApp('home')}>‹ Apps</button>
            <small className="ph-title">Messages</small>
            {msgs.length === 0 && <p className="ph-empty">No messages yet. People get in touch as you drive.</p>}
            {[...new Set([...msgs].reverse().map((m) => m.from))].map((who) => {
              const c = characterById(who)!, last = [...msgs].reverse().find((m) => m.from === who)!, n = msgs.filter((m) => m.from === who && !p.story.read.includes(m.id)).length;
              return (
                <button key={who} type="button" className={'ph-row' + (n ? ' new' : '')} onClick={() => open(who)}>
                  <i className="ph-av" style={{ background: c.colour }} aria-hidden="true">{c.name[0]}</i>
                  <span><b>{c.name}</b><small>{last.text}</small></span>{n > 0 && <em className="ph-badge" aria-label={`${n} unread`}>{n}</em>}
                </button>
              );
            })}
          </div>
        ) : app === 'contacts' ? (
          <div className="ph-list">
            <button type="button" className="ph-back" onClick={() => setApp('home')}>‹ Apps</button>
            <small className="ph-title">Contacts</small>
            {contacts(p, level).length === 0 && <p className="ph-empty">Nobody yet. Drive, and people will find you.</p>}
            {contacts(p, level).map((c) => (
              <button key={c.id} type="button" className="ph-row" onClick={() => { setApp('messages'); open(c.id); }}>
                <i className="ph-av" style={{ background: c.colour }} aria-hidden="true">{c.name[0]}</i>
                <span><b>{c.name}</b><small>{c.role} · {c.where}</small></span>
              </button>
            ))}
            <p className="ph-empty">Everyone here is fictional: the game's own people.</p>
          </div>
        ) : (
          <div className="ph-credits">
            <button type="button" className="ph-back" onClick={() => setApp('home')}>‹ Apps</button>
            <small>Credits</small>
            <b>{Math.floor(credits).toLocaleString()}</b>
            <p>Earned by driving: distance, clean passes, near misses, races and records. Spent in the garage. Never bought, never real money.</p>
          </div>
        )}
        <button type="button" className="ph-home" aria-label="Close the phone" onClick={onClose} />
      </section>
    </div>
  );
}

// one character's thread: their messages as bubbles; a job shows its goal and pay, done or open, with a button that sets
// it up on the menu (the mode, the course or the freeway)
function Thread({ who, msgs, done, onBack, onJob }: { who: string; msgs: Message[]; done: string[]; onBack: () => void; onJob: (j: Job) => void }) {
  const c = characterById(who)!;
  return (
    <div className="ph-list ph-thread">
      <button type="button" className="ph-back" onClick={onBack}>‹ Messages</button>
      <p className="ph-who"><i className="ph-av" style={{ background: c.colour }} aria-hidden="true">{c.name[0]}</i><span><b>{c.name}</b><small>{c.role}</small></span></p>
      {msgs.map((m) => {
        const ok = done.includes(m.id);
        return (
          <div key={m.id} className="ph-msg">
            <p className="ph-bubble">{m.text}</p>
            {m.job && (
              <div className={'ph-job' + (ok ? ' ok' : '')}>
                <b>{jobText(m.job)}</b><small>{ok ? 'Done' : 'Pays'} · {(m.credits ?? 0).toLocaleString()} credits, {(m.xp ?? 0).toLocaleString()} XP</small>
                {!ok && <button type="button" className="btn primary" onClick={() => onJob(m.job!)}>Set it up</button>}
              </div>
            )}
            {ok && m.done && <p className="ph-bubble">{m.done}</p>}
          </div>
        );
      })}
    </div>
  );
}
