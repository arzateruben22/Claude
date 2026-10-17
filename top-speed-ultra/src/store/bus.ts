// What the store's modules share: browser storage that never throws (a private window or blocked storage just
// means nothing is remembered), and one change event that the game and the Store panel listen to. It fires when you
// sign in or out, when what you own changes (a purchase, a restore, a refund seen on the server) and when you
// equip a paint.

export function load<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
export function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked: a convenience */ }
}
export function drop(key: string) { try { localStorage.removeItem(key); } catch { /* blocked */ } }
export function sessionLoad<T>(key: string, fallback: T): T {
  try { const raw = sessionStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
export function sessionSave(key: string, value: unknown | null) {
  try { if (value === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* blocked */ }
}

const bus = new EventTarget();
export function emit() { bus.dispatchEvent(new Event('change')); }
export function onStoreChange(fn: () => void): () => void {
  const h = () => fn();
  bus.addEventListener('change', h);
  return () => bus.removeEventListener('change', h);
}

// a short random id for test receipts and test users (not for anything secret)
export function shortId(n = 8) {
  const a = new Uint8Array(n);
  try { crypto.getRandomValues(a); } catch { for (let i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256); }
  return [...a].map((b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
}
