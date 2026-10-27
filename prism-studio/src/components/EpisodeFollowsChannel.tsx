"use client";
// Keeps a cost form's Episode list in step with its Channel: with a channel chosen, only that channel's episodes can be
// picked (the others are hidden, and disabled where a browser can't hide options); on Studio-wide every episode is
// listed, and picking one moves Channel to the episode's channel, which is where the server files it. Renders nothing;
// without JavaScript the full list stays and the server refuses a mismatched pair.
import { useEffect, useRef } from "react";

export function EpisodeFollowsChannel() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const form = ref.current?.closest("form");
    const ch = form?.querySelector<HTMLSelectElement>('select[name="channelId"]');
    const ep = form?.querySelector<HTMLSelectElement>('select[name="episodeId"]');
    if (!form || !ch || !ep) return;
    const groups = () => [...ep.querySelectorAll<HTMLOptGroupElement>("optgroup[data-channel]")];
    const sync = () => {
      for (const g of groups()) g.hidden = g.disabled = !!ch.value && g.dataset.channel !== ch.value;
      const sel = ep.selectedOptions[0];
      if (sel?.parentElement instanceof HTMLOptGroupElement && sel.parentElement.disabled) ep.value = "";
    };
    const picked = () => {
      const g = ep.selectedOptions[0]?.parentElement;
      if (!ch.value && g instanceof HTMLOptGroupElement && g.dataset.channel) ch.value = g.dataset.channel;
      sync();
    };
    const reset = () => setTimeout(sync, 0);   // after the browser has put the defaults back
    sync();
    ch.addEventListener("change", sync);
    ep.addEventListener("change", picked);
    form.addEventListener("reset", reset);
    return () => { ch.removeEventListener("change", sync); ep.removeEventListener("change", picked); form.removeEventListener("reset", reset); };
  }, []);
  return <span ref={ref} hidden />;
}
