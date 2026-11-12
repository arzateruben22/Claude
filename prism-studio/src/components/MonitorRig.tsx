// The monitor rig: a landscape screen in the middle (the largest), a channel above it, two portrait screens on each
// side on steel arms from a central pole. The middle is the shared Instagram while Instagram is on; with it off (owner,
// 12 Nov 2026) the channels fill the wall: an odd one out takes the middle, and with four the middle stays empty and
// the stand drops it (data-no-center: the two pairs close in on the pole). With four channels the top screen stays dark
// and the stand drops it too (two a side). Under 900 px it becomes a calm stack: the middle screen, then the channels
// with something to show two by two, then the switched-off screens in one compact row. Which channel sits where:
// rigLayout in src/lib/rig.ts.
import type { RigView } from "@/lib/data";
import { PHONE_ORDER } from "@/lib/rig";
import { Monitor } from "./Monitor";

export function MonitorRig({ v }: { v: RigView }) {
  const noTop = !v.monitors.some((m) => m.pos === "top");
  const noCenter = !v.monitors.some((m) => m.pos === "center");
  return (
    <div className="rig" data-no-top={noTop || undefined} data-no-center={noCenter || undefined}>
      <div className="rig-stage">
        <span className="rig-pole" aria-hidden />
        <span className="rig-arm" aria-hidden />
        <span className="rig-base" aria-hidden />
        {[1, 2, 3, 4].map((i) => <span key={i} className={`rig-joint j${i}`} aria-hidden />)}
        {PHONE_ORDER.map((pos) => {
          const m = v.monitors.find((x) => x.pos === pos);
          return m ? <Monitor key={pos} m={m} pos={pos} tz={v.tz} /> : null;
        })}
      </div>
    </div>
  );
}
