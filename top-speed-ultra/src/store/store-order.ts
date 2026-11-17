// The store's order (the owner, 2026-11-16, updated 2026-11-17): a character pack first (any listed sku of kind 'pack'
// that is neither the Founders package nor the OC Hypercar Founder Edition: the Chad & Chadaline pack from claude/cast
// when that branch merges), then the Founders package, then the OC Hypercar Founder Edition, then anything else listed
// (nothing, in this tree), each group keeping its catalog order. Pure, with no imports, so the regression suite runs it
// on its own (store group).
export function storeOrder<T extends { sku: string; kind: string }>(items: T[], hypercar: string, founders: string): T[] {
  const rank = (s: T) => (s.sku === founders ? 1 : s.sku === hypercar ? 2 : s.kind === 'pack' ? 0 : 3);
  return items.map((s, i) => ({ s, i })).sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i).map((x) => x.s);
}
