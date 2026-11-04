// The Review page's channel switcher: one entry per channel that has episodes waiting, with how many and where its
// first episode slide is (the same `#ep-<id>` anchors the reel already uses). Pure, so it can be tested without a database.
type Item = { ep: { id: string }; channel: { id: string; name: string; color: string; colorInk: string } };

export type ChannelJump = { id: string; name: string; count: number; href: string; color: string; colorInk: string };

/** Channels in the order their first waiting episode appears in the queue (the reel's own order). */
export function channelJumps(queue: Item[]): ChannelJump[] {
  const by = new Map<string, ChannelJump>();
  for (const { ep, channel } of queue) {
    const hit = by.get(channel.id);
    if (hit) hit.count += 1;
    else by.set(channel.id, { id: channel.id, name: channel.name, count: 1, href: `#ep-${ep.id}`, color: channel.color, colorInk: channel.colorInk });
  }
  return [...by.values()];
}

/** The channel after `currentId`, wrapping round; the first when the current one is unknown. */
export function nextChannel<T extends { id: string }>(list: T[], currentId: string | null | undefined): T | null {
  if (!list.length) return null;
  const i = list.findIndex((c) => c.id === currentId);
  return list[(i + 1) % list.length];
}
