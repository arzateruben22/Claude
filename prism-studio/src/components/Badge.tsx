// Trophy badges: small geometric marks, gold when earned, an outline when still ahead.
import type { ReactNode } from "react";
const SHAPES: Record<string, (c: string) => ReactNode> = {
  spark: (c) => <path d="M32 8v14M32 42v14M8 32h14M42 32h14M15 15l10 10M39 39l10 10M49 15 39 25M25 39 15 49" stroke={c} strokeWidth={4} strokeLinecap="round" />,
  book: (c) => <path d="M12 16c8-3 14-2 20 3 6-5 12-6 20-3v32c-8-3-14-2-20 3-6-5-12-6-20-3zM32 19v32" stroke={c} strokeWidth={3.5} fill="none" strokeLinejoin="round" />,
  ring: (c) => <><circle cx={32} cy={32} r={20} stroke={c} strokeWidth={5} fill="none" /><circle cx={32} cy={32} r={8} fill={c} /></>,
  prism: (c) => <><path d="M32 8 54 50H10z" stroke={c} strokeWidth={4} fill="none" strokeLinejoin="round" /><path d="M4 30h20M40 34l20-8M40 38l20 2M40 42l20 10" stroke={c} strokeWidth={2.5} strokeLinecap="round" /></>,
  crown: (c) => <path d="M10 46 14 18l12 14 6-18 6 18 12-14 4 28zM12 52h40" stroke={c} strokeWidth={4} fill="none" strokeLinejoin="round" strokeLinecap="round" />,
  halo: (c) => <><ellipse cx={32} cy={18} rx={16} ry={5} stroke={c} strokeWidth={4} fill="none" /><circle cx={32} cy={40} r={12} stroke={c} strokeWidth={4} fill="none" /></>,
};
export function Badge({ kind, earned, demo }: { kind: string; earned: boolean; demo?: boolean }) {
  const c = earned ? (demo ? "#B08A2E" : "#C8902A") : "#B9B0A3";
  return (
    <svg className="badge-geo" viewBox="0 0 64 64" role="img" aria-label={earned ? (demo ? "earned (demo)" : "earned") : "not yet"}>
      <rect x={2} y={2} width={60} height={60} rx={16} fill={earned ? "#FFF4DC" : "transparent"} stroke={earned ? "#E9C985" : "var(--line-2)"} strokeDasharray={earned ? undefined : "4 4"} />
      {(SHAPES[kind] ?? SHAPES.ring)(c)}
    </svg>
  );
}
