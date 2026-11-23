// Messages and Contacts: the story's characters texting you (src/game/story.ts). They lived in the in-game phone, which the
// owner took off the pause screen (2026-11-22: "get rid of the mobile phone section"); nothing written was deleted, it is
// in PROFILE on the main menu now. Everyone here is fictional, the game's own people; no message is sent or received over a
// network, and nothing costs real money. Opening a thread reads it (kept on the profile).
import { useState } from 'react';
import type { ProfileBook } from '../game/profile';
import { inbox, unread, contacts, characterById, jobText, type Message, type Job } from '../game/story';

// how many of the story's messages are still unread (the Profile tab's badge)
export const unreadCount = (book: ProfileBook, level: number) => unread(book.p, level);

export function Messages({ book, level, onJob }: { book: ProfileBook; level: number; onJob: (j: Job) => void }) {
  const [view, setView] = useState<'messages' | 'contacts'>('messages');
  const [thread, setThread] = useState<string | null>(null);
  const [, bump] = useState(0);
  const p = book.p, msgs = inbox(p, level);
  // opening a thread reads it (kept on the profile)
  const open = (who: string) => {
    setThread(who);
    const ids = msgs.filter((m) => m.from === who && !p.story.read.includes(m.id)).map((m) => m.id);
    if (ids.length) { p.story.read.push(...ids); book.save(); bump((n) => n + 1); }
  };
  if (thread) return <Thread who={thread} msgs={msgs.filter((m) => m.from === thread)} done={p.story.done} onBack={() => setThread(null)} onJob={onJob} />;
  const fresh = unread(p, level), people = contacts(p, level);
  return (
    <div className="msgs">
      <div className="seg msgs-tabs" role="group" aria-label="Messages or contacts" data-n={2} style={{ '--n': 2 } as React.CSSProperties}>
        <button type="button" aria-pressed={view === 'messages'} onClick={() => setView('messages')}>Messages{fresh > 0 && <em className="msg-badge" aria-label={`${fresh} unread`}>{fresh}</em>}</button>
        <button type="button" aria-pressed={view === 'contacts'} onClick={() => setView('contacts')}>Contacts</button>
      </div>
      {view === 'messages' ? <>
        {msgs.length === 0 && <p className="muted">No messages yet. People get in touch as you drive.</p>}
        {[...new Set([...msgs].reverse().map((m) => m.from))].map((who) => {
          const c = characterById(who)!, last = [...msgs].reverse().find((m) => m.from === who)!, n = msgs.filter((m) => m.from === who && !p.story.read.includes(m.id)).length;
          return (
            <button key={who} type="button" className={'msg-row' + (n ? ' new' : '')} onClick={() => open(who)}>
              <i className="msg-av" style={{ background: c.colour }} aria-hidden="true">{c.name[0]}</i>
              <span><b>{c.name}</b><small>{last.text}</small></span>{n > 0 && <em className="msg-badge" aria-label={`${n} unread`}>{n}</em>}
            </button>
          );
        })}
      </> : <>
        {people.length === 0 && <p className="muted">Nobody yet. Drive, and people will find you.</p>}
        {people.map((c) => (
          <button key={c.id} type="button" className="msg-row" onClick={() => { setView('messages'); open(c.id); }}>
            <i className="msg-av" style={{ background: c.colour }} aria-hidden="true">{c.name[0]}</i>
            <span><b>{c.name}</b><small>{c.role} · {c.where}</small></span>
          </button>
        ))}
        <p className="fine">Everyone here is fictional: the game's own people.</p>
      </>}
    </div>
  );
}

// one character's thread: their messages as bubbles; a job shows its goal and pay, done or open, with a button that sets
// it up on the menu (the tile and the freeway)
function Thread({ who, msgs, done, onBack, onJob }: { who: string; msgs: Message[]; done: string[]; onBack: () => void; onJob: (j: Job) => void }) {
  const c = characterById(who)!;
  return (
    <div className="msgs msg-thread">
      <button type="button" className="msg-back" onClick={onBack}>‹ Messages</button>
      <p className="msg-who"><i className="msg-av" style={{ background: c.colour }} aria-hidden="true">{c.name[0]}</i><span><b>{c.name}</b><small>{c.role}</small></span></p>
      {msgs.map((m) => {
        const ok = done.includes(m.id);
        return (
          <div key={m.id} className="msg-item">
            <p className="msg-bubble">{m.text}</p>
            {m.job && (
              <div className={'msg-job' + (ok ? ' ok' : '')}>
                <b>{jobText(m.job)}</b><small>{ok ? 'Done' : 'Pays'} · {(m.credits ?? 0).toLocaleString()} cash, {(m.xp ?? 0).toLocaleString()} XP</small>
                {!ok && <button type="button" className="btn primary" onClick={() => onJob(m.job!)}>Set it up</button>}
              </div>
            )}
            {ok && m.done && <p className="msg-bubble">{m.done}</p>}
          </div>
        );
      })}
    </div>
  );
}
