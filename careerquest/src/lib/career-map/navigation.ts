/**
 * Map geometry and keyboard navigation for the Career Map canvas. Pure (no DOM), so the layout and
 * arrow-key behaviour are unit-tested.
 */

export const MAP_LAYOUT = {
  colWidth: 212,
  rowHeight: 112,
  nodeWidth: 172,
  nodeHeight: 92,
  pad: 20,
} as const;

type Pos = { key: string; col: number; row: number };

export function nodeOrigin(n: { col: number; row: number }): { x: number; y: number } {
  return { x: MAP_LAYOUT.pad + n.col * MAP_LAYOUT.colWidth, y: MAP_LAYOUT.pad + n.row * MAP_LAYOUT.rowHeight };
}

export function canvasSize(nodes: { col: number; row: number }[]): { width: number; height: number } {
  const cols = Math.max(0, ...nodes.map((n) => n.col));
  const rows = Math.max(0, ...nodes.map((n) => n.row));
  return {
    width: MAP_LAYOUT.pad * 2 + cols * MAP_LAYOUT.colWidth + MAP_LAYOUT.nodeWidth,
    height: MAP_LAYOUT.pad * 2 + rows * MAP_LAYOUT.rowHeight + MAP_LAYOUT.nodeHeight,
  };
}

/** SVG path for a connector: a horizontal S-curve between columns, a straight drop within one. */
export function edgePath(a: { col: number; row: number }, b: { col: number; row: number }): string {
  const A = nodeOrigin(a);
  const B = nodeOrigin(b);
  const { nodeWidth: w, nodeHeight: h } = MAP_LAYOUT;
  if (a.col === b.col) {
    const down = b.row > a.row;
    const x = A.x + w / 2;
    return `M${x},${down ? A.y + h : A.y} L${B.x + w / 2},${down ? B.y : B.y + h}`;
  }
  const forward = b.col > a.col;
  const x1 = forward ? A.x + w : A.x;
  const x2 = forward ? B.x : B.x + w;
  const y1 = A.y + h / 2;
  const y2 = B.y + h / 2;
  const mx = (x1 + x2) / 2;
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}

export type Direction = "left" | "right" | "up" | "down";

const KEY_DIRECTIONS: Record<string, Direction> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" };

export function directionForKey(key: string): Direction | null {
  return KEY_DIRECTIONS[key] ?? null;
}

/**
 * The nearest stop in a direction: candidates must lie strictly that way; the score favours
 * distance along the direction, then closeness across it (so → from a stop prefers the next column
 * in the same lane).
 */
export function spatialNeighbor(nodes: Pos[], fromKey: string, dir: Direction): string | null {
  const a = nodes.find((n) => n.key === fromKey);
  if (!a) return null;
  let best: { key: string; score: number; cross: number } | null = null;
  for (const n of nodes) {
    if (n.key === a.key) continue;
    const dc = n.col - a.col;
    const dr = n.row - a.row;
    let along: number;
    let cross: number;
    if (dir === "right") [along, cross] = [dc, Math.abs(dr)];
    else if (dir === "left") [along, cross] = [-dc, Math.abs(dr)];
    else if (dir === "down") [along, cross] = [dr, Math.abs(dc)];
    else [along, cross] = [-dr, Math.abs(dc)];
    if (along <= 0) continue;
    const score = along * 4 + cross * 3;
    if (!best || score < best.score || (score === best.score && cross < best.cross)) best = { key: n.key, score, cross };
  }
  return best?.key ?? null;
}

/** Reading order for Home/End: by column, then row. */
export function readingOrder(nodes: Pos[]): string[] {
  return [...nodes].sort((a, b) => a.col - b.col || a.row - b.row).map((n) => n.key);
}
