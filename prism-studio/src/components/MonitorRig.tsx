// The six-monitor rig: Instagram in the middle (landscape, the largest), one channel above it, two portrait screens
// on each side on steel arms from a central pole. Under 900 px it becomes a calm stack: Instagram, the top screen,
// then the four portraits two by two. The mapping lives in src/lib/rig.ts.
import type { RigView } from "@/lib/data";
import { INSTAGRAM_SLUG, PHONE_ORDER, RIG, type RigPosition } from "@/lib/rig";
import { Monitor } from "./Monitor";

export const slugAt = (pos: RigPosition) => (pos === "center" ? INSTAGRAM_SLUG : RIG[pos]);

export function MonitorRig({ v }: { v: RigView }) {
  return (
    <div className="rig">
      <div className="rig-stage">
        <span className="rig-pole" aria-hidden />
        <span className="rig-arm" aria-hidden />
        <span className="rig-base" aria-hidden />
        {[1, 2, 3, 4].map((i) => <span key={i} className={`rig-joint j${i}`} aria-hidden />)}
        {PHONE_ORDER.map((pos) => {
          const m = v.monitors.find((x) => x.slug === slugAt(pos));
          return m ? <Monitor key={pos} m={m} pos={pos} tz={v.tz} /> : null;
        })}
      </div>
    </div>
  );
}
