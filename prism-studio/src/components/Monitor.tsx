// One monitor on the wall: a thin matte bezel, a screen showing the next thing to post (its cover, never written over),
// and the channel's name and one status line on the bezel's chin, with a single status light. A channel with nothing to
// show is switched-off glass. Light-paper covers are dimmed on the wall (data-tone="light"). The whole monitor is the
// link to its extension (/m/[slug]).
import Link from "next/link";
import { coverOf, smallCover, type IgSlot, type MonitorCard } from "@/lib/data";
import type { RigPosition } from "@/lib/rig";
import { formatLocal, localDate } from "@/domain/time";
import { mediaUrl } from "@/lib/media";
import { topicStyle } from "@/lib/format";

const shape = (pos: RigPosition) => (pos === "center" || pos === "top" ? "landscape" : "portrait");

export function Monitor({ m, pos, tz }: { m: MonitorCard; pos: RigPosition; tz: string }) {
  const kind = shape(pos);
  const ig = m.kind === "instagram";
  const small = smallCover(m.cover);
  return (
    <Link href={m.href} className={`mon mon-${kind}`} data-pos={pos} data-empty={(!ig && !m.cover) || undefined} data-tone={ig ? undefined : m.coverTone} style={topicStyle(m)}>
      <span className="mon-bezel">
        <span className="mon-screen">
          {ig ? <InstagramScreen m={m} tz={tz} />
            : m.cover ? (
              <img className="mon-cover" src={mediaUrl(small ?? m.cover)} srcSet={small && small !== m.cover ? `${mediaUrl(small)} 480w, ${mediaUrl(m.cover)} 1080w` : undefined}
                sizes="(min-width: 900px) 200px, 50vw" alt="" loading="eager" decoding="async" />
            ) : m.label.toLowerCase() !== m.name.toLowerCase() ? <span className="mon-standby" aria-hidden>{m.label}</span> : null}
        </span>
        {ig ? null : (
          <span className="mon-chin">
            <span className="mon-name">{m.name}</span>
            <span className="mon-status">{m.status}</span>
          </span>
        )}
        <span className="mon-led" data-led={m.led} aria-hidden />
      </span>
      <span className="sr-only">. Status light: {m.ledLabel}.</span>
    </Link>
  );
}

const SLOT_NOTE: Record<IgSlot["state"], string> = { posted: "Posted", ready: "Ready", needs_approval: "Needs approval", unplanned: "Up next", missed: "Missed", empty: "Open" };

function InstagramScreen({ m, tz }: { m: MonitorCard; tz: string }) {
  const slots = m.slots ?? [];
  const today = localDate(new Date(), tz);
  return (
    <span className="ig">
      <span className="ig-info">
        <span className="mon-label">All series</span>
        <span className="mon-name">Instagram</span>
        <span className="mon-status">{m.status}</span>
      </span>
      <span className="ig-tiles">
        {(slots.length ? slots : [null, null]).map((x, i) => {
          const cover = x?.item ? smallCover(coverOf(x.item)) : null;
          const other = x && localDate(x.at, tz) !== today;
          return (
            <span key={i} className="ig-tile" data-state={x?.state ?? "empty"} data-tone={cover ? x?.tone : undefined}>
              {cover ? <img src={mediaUrl(cover)} alt="" decoding="async" /> : null}
              {x ? (
                <span className="ig-cap">
                  <span className="ig-time">{formatLocal(x.at, tz, other ? { weekday: "short", hour: "numeric", minute: "2-digit" } : { hour: "numeric", minute: "2-digit" })}</span>
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
