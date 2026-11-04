import { describe, expect, it } from "vitest";
import { channelJumps, nextChannel } from "../src/lib/channel-jump";

const item = (id: string, ch: string) => ({ ep: { id }, channel: { id: ch, name: ch.toUpperCase(), color: "#111111", colorInk: "#222222" } });

describe("review channel switcher", () => {
  const queue = [item("e1", "a"), item("e2", "a"), item("e3", "b"), item("e4", "c"), item("e5", "b")];

  it("counts each channel's waiting episodes and links its first slide", () => {
    expect(channelJumps(queue).map((c) => [c.id, c.count, c.href])).toEqual([["a", 2, "#ep-e1"], ["b", 2, "#ep-e3"], ["c", 1, "#ep-e4"]]);
  });

  it("is empty for an empty queue", () => {
    expect(channelJumps([])).toEqual([]);
    expect(nextChannel([], "a")).toBeNull();
  });

  it("cycles to the next channel and wraps; an unknown current channel goes to the first", () => {
    const list = channelJumps(queue);
    expect(nextChannel(list, "a")?.id).toBe("b");
    expect(nextChannel(list, "c")?.id).toBe("a");
    expect(nextChannel(list, null)?.id).toBe("a");
  });
});
