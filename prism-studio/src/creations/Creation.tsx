import * as React from "react";
import { useId } from "react";
import type { CreationKey, CreationProps } from "./types";
import { CREATIONS } from "./meta";
import { makeCtx, motionCss, SharedDefs, type Ctx } from "./kit";
import { GlassGarden } from "./glassGarden";
import { GravityMarble } from "./gravityMarble";
import { BioelectricCar } from "./bioelectricCar";
import { PocketUniverse } from "./pocketUniverse";
import { RiftDragon } from "./riftDragon";

const RENDER: Record<CreationKey, (ctx: Ctx) => React.ReactNode> = {
  glass_garden: GlassGarden,
  gravity_marble: GravityMarble,
  bioelectric_car: BioelectricCar,
  pocket_universe: PocketUniverse,
  rift_dragon: RiftDragon,
};

export function creationLabel(p: Pick<CreationProps, "creation" | "form" | "branch" | "ascended" | "locked">): string {
  const meta = CREATIONS[p.creation];
  let s = `${meta.name}, form ${p.form}: ${meta.forms[p.form - 1]}`;
  if (p.branch) s += `, ${meta.branches[p.branch].name}`;
  if (p.ascended) s += ", ascended";
  if (p.locked) s += ", locked preview";
  return s;
}

/**
 * A living creation: pure inline SVG + a scoped <style>. Server-renderable
 * (the only hook is useId) and safe to render many times on one page.
 */
export function Creation(props: CreationProps): React.JSX.Element {
  const rid = useId();
  const {
    creation,
    form,
    branch = null,
    ascended = false,
    activity = "idle",
    size = 240,
    motion = "full",
    locked = false,
    className,
  } = props;
  const p = `pc${rid.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const ctx = makeCtx(p, {
    form,
    branch: branch === "b" ? "b" : "a",
    ascended: ascended && !locked,
    activity: locked ? "idle" : activity,
    locked,
  });
  const mode = locked ? "static" : motion;
  const k = activity === "resting" ? 2 : activity === "rendering" ? 0.8 : 1;
  const draw = RENDER[creation] ?? GlassGarden;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 400 400"
      width={size}
      height={size}
      role="img"
      aria-label={creationLabel({ creation, form, branch, ascended, locked })}
      className={className ? `${p} ${className}` : p}
      style={{ ["--k" as string]: k } as React.CSSProperties}
      data-creation={creation}
      data-form={form}
      data-activity={ctx.activity}
    >
      <style>{motionCss(p, mode)}</style>
      <defs>
        <SharedDefs ctx={ctx} />
      </defs>
      <g
        filter={locked ? ctx.url("locked") : undefined}
        opacity={ctx.activity === "resting" ? 0.8 : undefined}
      >
        {draw(ctx)}
      </g>
    </svg>
  );
}
