// The store's order (the owner, 2026-11-16): a character pack first (any listed sku of kind 'pack' other than the OC
// Hypercar Founder Edition: the Chad & Chadaline pack from claude/cast when that branch merges), then the OC Hypercar
// Founder Edition, then everything else listed (the Colour Studio), each group keeping its catalog order. Pure, with no
// imports, so the regression suite runs it on its own (store group).
export function storeOrder<T extends { sku: string; kind: string }>(items: T[], hypercar: string): T[] {
  const rank = (s: T) => (s.kind === 'pack' && s.sku !== hypercar ? 0 : s.sku === hypercar ? 1 : 2);
  return items.map((s, i) => ({ s, i })).sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i).map((x) => x.s);
}
