/* Storage adapter — the one place the whole kit reads/writes data.
 *
 * Every engine takes a `store` so you can swap where data lives WITHOUT
 * touching any business logic:
 *   • createLocalStore()  — browser localStorage (demo / offline)
 *   • createMemoryStore() — in-memory (tests / SSR)
 *   • write your own      — Supabase, REST, anything with get/set/del
 *
 * Contract: { get(key, fallback?), set(key, value), del(key) }
 * Values are plain JSON-serialisable objects/arrays.
 */

export function createLocalStore(prefix = "app_") {
  const k = (key) => prefix + key;
  return {
    get(key, fallback = null) {
      try {
        const v = JSON.parse(localStorage.getItem(k(key)));
        return v === null || v === undefined ? fallback : v;
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(k(key), JSON.stringify(value)); } catch { /* private mode */ }
    },
    del(key) {
      try { localStorage.removeItem(k(key)); } catch { /* ignore */ }
    }
  };
}

export function createMemoryStore() {
  const m = new Map();
  return {
    get: (key, fallback = null) => (m.has(key) ? m.get(key) : fallback),
    set: (key, value) => { m.set(key, value); },
    del: (key) => { m.delete(key); }
  };
}

/* Example Supabase adapter (sketch — fill in with your table/columns):
 *
 *   export function createSupabaseStore(supabase, table = "kv") {
 *     return {
 *       async get(key, fallback = null) {
 *         const { data } = await supabase.from(table).select("value").eq("key", key).single();
 *         return data?.value ?? fallback;
 *       },
 *       async set(key, value) { await supabase.from(table).upsert({ key, value }); },
 *       async del(key) { await supabase.from(table).delete().eq("key", key); }
 *     };
 *   }
 *
 * (For real apps you'd usually give each engine its own proper table rather
 * than a generic key/value store — the engines don't care which you use.)
 */
