import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/styles.css';
import './ui/hud-retro.css';   // the Retro look's HUD skin, every rule under .app[data-skin="retro"]: after styles.css, so it wins

createRoot(document.getElementById('root')!).render(<App />);
