// One monitor on the wall: a thin matte bezel, a screen showing the next thing to post (its cover), the channel's
// name, one status line and a single status light. The whole monitor is the link to its extension (/m/[slug]).
import Link from "next/link";
import { coverOf, type IgSlot, type MonitorCard } from "@/lib/data";
import type { RigPosition } from "@/lib/rig";
import { formatLocal } from "@/domain/time";
import { mediaUrl } from "@/lib/media";
import { topicStyle } from "@/lib/format";

const shape = (pos: RigPosition) => (pos === "center" || pos === "top" ? "landscape" : "portrait");

export function Monitor({ m, pos, tz }: { m: MonitorCard; pos: RigPosition; tz: string }) {
  const kind = shape(pos);
  return (
    <Link href={m.href} className={`mon mon-${kind}`} data-pos={pos} data-empty={!m.cover || undefined} style={topicStyle(m)}>
      <span className="mon-bezel">
        <span className="mon-screen">
          {m.kind === "instagram" ? <InstagramScreen m={m} tz={tz} /> : (
            <>
              {m.cover ? <img className="mon-cover" src={mediaUrl(m.cover)} alt="" loading="eager" decoding="async" /> : null}
              <span className="mon-info">
                {m.label.toLowerCase() !== m.name.toLowerCase() ? <span className="mon-label">{m.label}</span> : null}
                <span className="mon-name">{m.name}</span>
                <span className="mon-status">{m.status}</span>
              </span>
            </>
          )}
        </span>
        <span className="mon-led" data-led={m.led} aria-hidden />
      </span>
      <span className="sr-only">. Status light: {m.ledLabel}.</span>
    </Link>
  );
}

const SLOT_NOTE: Record<IgSlot["state"], string> = { posted: "Posted", ready: "Ready", needs_approval: "Needs approval", unplanned: "Up next", empty: "Open" };

function InstagramScreen({ m, tz }: { m: MonitorCard; tz: string }) {
  const slots = m.slots ?? [];
  return (
    <span className="ig">
      <span className="ig-info">
        <span className="mon-label">All series</span>
        <span className="mon-name">Instagram</span>
        <span className="mon-status">{m.status}</span>
      </span>
      <span className="ig-tiles">
        {(slots.length ? slots : [null, null]).map((x, i) => {
          const cover = x?.item ? coverOf(x.item) : null;
          return (
            <span key={i} className="ig-tile" data-state={x?.state ?? "empty"} style={x?.item ? topicStyle(x.item.channel) : undefined}>
              {cover ? <img src={mediaUrl(cover)} alt="" decoding="async" /> : null}
              {x ? (
                <span className="ig-cap">
                  <span className="ig-time">{formatLocal(x.at, tz, { hour: "numeric", minute: "2-digit" })}</span>
                  <span className="ig-what">{x.item ? x.item.e.title : "Open"}</span>
                  <span className="ig-note">{SLOT_NOTE[x.state]}</span>
                </span>
              ) : null}
            </span>
          );
        })}
      </span>
    </span>
  );
}
