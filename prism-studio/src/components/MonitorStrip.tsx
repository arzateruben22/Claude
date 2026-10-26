// The six monitors in miniature, laid out like the rig, at the top of every extension screen, each with its name:
// jump to any other monitor directly; the current one is lit and underlined. The Instagram one shows its two posts.
// Under 720 px it becomes a scrolling row of labelled buttons.
import Link from "next/link";
import { coverOf, smallCover, type MonitorCard } from "@/lib/data";
import { RIG_ORDER, type RigPosition } from "@/lib/rig";
import { mediaUrl } from "@/lib/media";
import { topicStyle } from "@/lib/format";
import { Icon } from "./Icon";

function Thumb({ m, pos, current }: { m: MonitorCard; pos: RigPosition; current: boolean }) {
  const tiles = m.kind === "instagram" ? [0, 1].map((i) => m.slots?.[i] ?? null) : null;
  const cover = smallCover(m.cover);
  return (
    <Link href={m.href} className={`thumb thumb-${pos === "center" || pos === "top" ? "landscape" : "portrait"}`} data-pos={pos}
      data-tone={tiles ? undefined : m.coverTone} data-cover={(tiles ? tiles.some((x) => x?.item) : !!cover) || undefined}
      aria-current={current ? "page" : undefined} style={topicStyle(m)}>
      <span className="thumb-mon" aria-hidden>
        <span className="thumb-screen">
          {tiles ? (
            <span className="thumb-tiles">
              {tiles.map((x, i) => { const c = x?.item ? smallCover(coverOf(x.item)) : null; return <span key={i} className="thumb-tile" data-tone={c ? x?.tone : undefined}>{c ? <img src={mediaUrl(c)} alt="" decoding="async" /> : null}</span>; })}
            </span>
          ) : cover ? <img src={mediaUrl(cover)} alt="" decoding="async" /> : null}
        </span>
        <span className="mon-led" data-led={m.led} />
      </span>
      <span className="thumb-name">{m.label}</span>
      <span className="sr-only">: {m.name}, {m.status}</span>
    </Link>
  );
}

export function MonitorStrip({ monitors, current }: { monitors: MonitorCard[]; current: string }) {
  const at = (slug: string) => monitors.find((m) => m.slug === slug);
  const cell = (pos: RigPosition, slug: string) => { const m = at(slug); return m ? <Thumb key={pos} m={m} pos={pos} current={slug === current} /> : null; };
  const [ol, il, top, center, ir, or] = RIG_ORDER;
  return (
    <nav className="strip" aria-label="Monitors">
      <Link href="/" className="strip-back"><Icon name="back" size={18} /> <span className="strip-back-label">Wall</span></Link>
      <div className="strip-rig">
        {cell(ol.position, ol.slug)}
        {cell(il.position, il.slug)}
        <span className="strip-col">{cell(top.position, top.slug)}{cell(center.position, center.slug)}</span>
        {cell(ir.position, ir.slug)}
        {cell(or.position, or.slug)}
      </div>
    </nav>
  );
}
