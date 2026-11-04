// Review's channel switcher: a button per channel with its count of episodes waiting, and "Next channel". Plain
// anchors to the channel's first episode slide (#ep-…), so it works with no JavaScript and in the static preview; the
// reel script (ReelNav) adds the cycling and marks the channel in view. "Next channel" links to the second channel
// until the script knows where you are.
import type { CSSProperties } from "react";
import type { ChannelJump } from "@/lib/channel-jump";
import { Icon } from "./Icon";

export function ChannelSwitch({ channels }: { channels: ChannelJump[] }) {
  const next = channels[1] ?? channels[0];
  return (
    <nav className="chan-switch" aria-label="Jump to a channel">
      <ul className="chan-list">
        {channels.map((c) => (
          <li key={c.id}>
            <a href={c.href} className="chan-btn" data-chan={c.id} style={{ ["--topic" as string]: c.color } as CSSProperties}>
              <span className="chan-name">{c.name}</span>
              <span className="chan-count num" aria-label={`${c.count} waiting`}>{c.count}</span>
            </a>
          </li>
        ))}
      </ul>
      {channels.length > 1 ? (
        <a href={next.href} className="btn chan-next" data-chan-next>
          <span>Next channel</span><Icon name="back" size={18} />
        </a>
      ) : null}
    </nav>
  );
}
