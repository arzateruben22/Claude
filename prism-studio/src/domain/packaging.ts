// Packaging: the title and thumbnail of each new episode and long video (owner's standing rule, 10 Nov 2026;
// films/channels/PACKAGING.md). The video builders write packaging.json beside the video (epNN/out/packaging.json, or
// compilations/<name>/packaging.json): five titles, three thumbnail concepts, three scored pairings, the winner, the Test
// & Compare set and a ChatGPT image prompt. Prism reads it on import and stores it on the episode or lesson; the winner
// title is the YouTube title, and the episode and long-video screens show the rest. Reading is forgiving: a missing,
// unreadable or half-written file never fails an import (fields that don't fit are left out, extra ones ignored).
// The scores are the builder's creative judgments, never CTR predictions, and are shown as such.
import fs from "node:fs";
import { z } from "zod";

export const SCORE_AXES = ["scroll", "curiosity", "clarity", "synergy", "originality", "accuracy", "mobile", "satisfaction"] as const;
export type ScoreAxis = (typeof SCORE_AXES)[number];
/** YouTube's title limit: a longer winner is kept for the screen but never used as the title. */
export const PACKAGING_TITLE_MAX = 100;

/** A trimmed string, cut to `max`; anything else (missing, a number, null) becomes "". */
const str = (max: number) => z.string().transform((s) => s.trim().slice(0, max)).catch("");
const id = z.string().trim().min(1).max(8);
/** A list whose items are kept one by one: an item that doesn't fit is dropped, not the whole list. */
const listOf = <T extends z.ZodType>(item: T, max: number) =>
  z.array(z.unknown()).catch([]).transform((xs) => xs.flatMap((x) => { const r = item.safeParse(x); return r.success ? [r.data as z.output<T>] : []; }).slice(0, max));
const score = z.number().min(0).max(100).nullable().catch(null);

const Title = z.object({ text: z.string().trim().min(1).max(300), mechanism: str(80) });
const Thumbnail = z.object({
  id, subject: str(600), composition: str(600), lighting: str(600), trigger: str(300), text: str(80), complements: str(400),
});
const Pairing = z.object({
  title: z.number().int().min(0).nullable().catch(null),
  thumbnail: z.string().trim().max(8).catch(""),
  scores: z.object(Object.fromEntries(SCORE_AXES.map((a) => [a, score])) as Record<ScoreAxis, typeof score>)
    .catch(Object.fromEntries(SCORE_AXES.map((a) => [a, null])) as Record<ScoreAxis, null>),
  note: str(500),
});

const Schema = z.object({
  version: z.number().int().nullable().catch(null),
  format: z.enum(["long", "short"]).nullable().catch(null),
  hook: str(600),
  titles: listOf(Title, 10),
  thumbnails: listOf(Thumbnail, 6),
  pairings: listOf(Pairing, 6),
  winner: z.object({ title: str(300), thumbnail: str(8), thumbnailText: str(80), why: str(800) }).nullable().catch(null),
  testAndCompare: listOf(id, 3),
  checks: z.record(z.string(), z.unknown()).catch({})
    .transform((r) => Object.fromEntries(Object.entries(r).filter((e): e is [string, boolean] => typeof e[1] === "boolean").slice(0, 12))),
  // a bare file name in the same folder (out/ or the compilation's), never a path
  thumbnailFile: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|png)$/i).max(200).catch(""),
  chatgptPrompt: str(6000),
  shortsCover: z.object({ frameSeconds: z.number().min(0).nullable().catch(null), text: str(80) }).nullable().catch(null),
});
export type Packaging = z.output<typeof Schema>;

/** A packaging.json's content, normalised; null when it isn't an object or carries nothing to show (no winner title,
 *  no titles and no prompt). Never throws. */
export function parsePackaging(raw: unknown): Packaging | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = Schema.safeParse(raw);
  if (!r.success) return null;
  const p = r.data;
  if (p.winner && !p.winner.title && !p.winner.thumbnail && !p.winner.thumbnailText) p.winner = null;
  return p.winner?.title || p.titles.length || p.chatgptPrompt ? p : null;
}

/** Read a packaging.json from disk for the importer: { packaging } when it is usable, { problem } when it is there but
 *  can't be used (the import carries on and reports it), {} when there is no file. */
export function readPackagingFile(file: string): { packaging?: Packaging; problem?: string } {
  if (!fs.existsSync(file)) return {};
  let raw: unknown;
  try { raw = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { return { problem: `packaging.json unreadable (${e instanceof SyntaxError ? "not JSON" : (e as Error).message})` }; }
  const packaging = parsePackaging(raw);
  return packaging ? { packaging } : { problem: "packaging.json has no winner title, titles or prompt" };
}

/** The YouTube title packaging gives: the winner title, when there is one within YouTube's 100 characters. */
export function packagingTitle(p: Packaging | null | undefined): string | null {
  const t = p?.winner?.title?.trim() ?? "";
  return t && t.length <= PACKAGING_TITLE_MAX ? t : null;
}

/** For the screens: each pairing with its title text and thumbnail concept resolved, the winner marked. */
export function pairingsView(p: Packaging) {
  return p.pairings.map((x) => {
    const title = x.title != null ? p.titles[x.title]?.text ?? "" : "";
    const thumb = p.thumbnails.find((t) => t.id === x.thumbnail) ?? null;
    const winner = !!p.winner && !!title && title === p.winner.title && (!p.winner.thumbnail || p.winner.thumbnail === x.thumbnail);
    return { title, thumbnail: x.thumbnail, concept: thumb, scores: SCORE_AXES.map((a) => ({ axis: a, value: x.scores[a] })), note: x.note, winner };
  });
}
