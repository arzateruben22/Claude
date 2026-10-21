// The in-game phone (U6 in PROJECT_OC_UI_TARGET.md; the style library's 09_PHONE_UI): a phone-shaped overlay that
// slides in from the right of the pause screen. Its apps open only what exists (the map, the garage, the races, the
// radio, your bests, your profile, settings, feedback, and your credits); Messages and Contacts say Roadmap. The
// clock is this device's. Credits are earned by driving; nothing on the phone costs real money.
import { useEffect, useState } from 'react';
import { Ico } from './Icons';

export type PhoneApp = 'map' | 'garage' | 'course' | 'radio' | 'board' | 'profile' | 'settings' | 'feedback';
interface App { id: PhoneApp | 'credits' | 'messages' | 'contacts'; name: string; icon: Parameters<typeof Ico>[0]['name']; off?: boolean }
const APPS: App[] = [
  { id: 'map', name: 'Map', icon: 'map' }, { id: 'garage', name: 'Garage', icon: 'garage' }, { id: 'course', name: 'Races', icon: 'drive' },
  { id: 'radio', name: 'Radio', icon: 'radio' }, { id: 'credits', name: 'Credits', icon: 'career' }, { id: 'board', name: 'Bests', icon: 'bests' },
  { id: 'profile', name: 'Profile', icon: 'driver' }, { id: 'settings', name: 'Settings', icon: 'settings' }, { id: 'feedback', name: 'Feedback', icon: 'nav' },
  { id: 'messages', name: 'Messages', icon: 'phone', off: true }, { id: 'contacts', name: 'Contacts', icon: 'online', off: true },
];

export function Phone({ name, credits, level, onOpen, onClose }: { name: string; credits: number; level: number; onOpen: (a: PhoneApp) => void; onClose: () => void }) {
  const [now, setNow] = useState(() => new Date());
  const [app, setApp] = useState<'home' | 'credits'>('home');
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
                onClick={() => (a.id === 'credits' ? setApp('credits') : !a.off && onOpen(a.id as PhoneApp))}>
                <i aria-hidden="true"><Ico name={a.icon} /></i><span>{a.name}</span>{a.off && <em>Roadmap</em>}
              </button>
            ))}
          </div>
        </> : (
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
