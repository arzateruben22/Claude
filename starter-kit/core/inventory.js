/* Inventory — retail stock with one source of truth for both sale channels.
 * Online checkout and in-person "sell" both call decrement()/sell(), so the
 * count is always right. sell() also appends to a sales log used by analytics.
 */

export function createInventory({ store, key = "inventory", salesKey = "retail_sales", lowStock = 3, seed = [] } = {}) {
  function load() {
    let list = store ? store.get(key, null) : null;
    if (!list || !list.length) { list = seed.map((p) => ({ ...p })); if (store) store.set(key, list); }
    return list;
  }
  const save = (list) => { if (store) store.set(key, list); };
  const num = (n) => Number(n || 0);

  function logSale(p, qty, channel) {
    if (!store) return;
    const sales = store.get(salesKey, []);
    sales.push({ id: p.id, name: p.name, price: num(p.price), qty: num(qty),
      at: new Date().toISOString(), channel });
    store.set(salesKey, sales);
  }

  return {
    all() { return load(); },
    get(id) { return load().find((p) => p.id === id) || null; },

    add(product) {
      const list = load();
      list.push({ id: product.id || String(product.name).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        name: product.name, stock: num(product.stock), cost: num(product.cost), price: num(product.price),
        desc: product.desc || "" });
      save(list); return list;
    },

    /* Drop stock without logging (e.g. shrinkage/adjustment). */
    decrement(id, qty = 1) {
      const list = load(); const p = list.find((x) => x.id === id);
      if (!p) return; p.stock = Math.max(0, num(p.stock) - num(qty)); save(list);
    },

    /* A sale: drop stock AND log it (channel = "online" | "in-person"). */
    sell(id, qty = 1, channel = "online") {
      const list = load(); const p = list.find((x) => x.id === id);
      if (!p || num(p.stock) < num(qty)) return false;
      p.stock = num(p.stock) - num(qty); save(list); logSale(p, qty, channel);
      return true;
    },

    setStock(id, stock) {
      const list = load(); const p = list.find((x) => x.id === id);
      if (p) { p.stock = Math.max(0, num(stock)); save(list); }
    },

    summary() {
      const list = load();
      return {
        products: list.length,
        units: list.reduce((a, p) => a + num(p.stock), 0),
        retailValue: list.reduce((a, p) => a + num(p.stock) * num(p.price), 0),
        lowStock: list.filter((p) => num(p.stock) <= lowStock).length,
        lowThreshold: lowStock
      };
    },

    sales() { return store ? store.get(salesKey, []) : []; }
  };
}
