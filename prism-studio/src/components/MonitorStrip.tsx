// The six monitors in miniature, laid out like the rig, at the top of every extension screen: jump to any other
// monitor directly; the current one is lit.
import Link from "next/link";
import type { MonitorCard } from "@/lib/data";
import { RIG_ORDER, type RigPosition } from "@/lib/rig";
import { mediaUrl } from "@/lib/media";
import { topicStyle } from "@/lib/format";
import { Icon } from "./Icon";

function Thumb({ m, pos, current }: { m: MonitorCard; pos: RigPosition; current: boolean }) {
  return (
    <Link href={m.href} className={`thumb thumb-${pos === "center" || pos === "top" ? "landscape" : "portrait"}`} data-pos={pos}
      aria-current={current ? "page" : undefined} aria-label={`${m.name}: ${m.status}`} title={m.name} style={topicStyle(m)}>
      <span className="thumb-screen">{m.cover ? <img src={mediaUrl(m.cover)} alt="" decoding="async" /> : null}</span>
      <span className="mon-led" data-led={m.led} aria-hidden />
    </Link>
  );
}

export function MonitorStrip({ monitors, current }: { monitors: MonitorCard[]; current: string }) {
  const at = (slug: string) => monitors.find((m) => m.slug === slug);
  const cell = (pos: RigPosition, slug: string) => { const m = at(slug); return m ? <Thumb key={pos} m={m} pos={pos} current={slug === current} /> : null; };
  const [ol, il, top, center, ir, or] = RIG_ORDER;
  return (
    <nav className="strip" aria-label="Monitors">
      <Link href="/" className="strip-back"><Icon name="back" size={18} /> <span>Wall</span></Link>
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
