import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/styles.css';
// the new HUD (2026-11-23): one layout and its two skins, every rule under .app[data-skin]; after styles.css, so they win
import './ui/hud-layout.css';
import './ui/hud-retro.css';
import './ui/hud-ultra.css';

createRoot(document.getElementById('root')!).render(<App />);
