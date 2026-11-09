// SubRip captions from a film's own caption track (film.json "captions": word-timed lines). The burned-in
// captions and the .srt come from the same timings, so a platform's caption upload matches the picture.
type Word = [string, number];
export type FilmCaption = { t0: number; t1: number; lines: Word[][] };

const stamp = (s: number) => {
  const ms = Math.max(0, Math.round(s * 1000));
  const h = Math.floor(ms / 3_600_000), m = Math.floor(ms / 60_000) % 60, sec = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
};

/** Word-timed captions as some films write them: one entry per word, grouped by the narration line it belongs to. */
export type WordCaption = { w: string; t0: number; t1: number; line?: string };

/** Group word-timed captions into SubRip cues: same narration line, at most 7 words, broken at a pause over 0.6 s. */
function wordsToCaptions(words: WordCaption[]): FilmCaption[] {
  const cues: FilmCaption[] = [];
  let cur: WordCaption[] = [];
  const flush = () => { if (cur.length) cues.push({ t0: cur[0].t0, t1: cur[cur.length - 1].t1, lines: [cur.map((w) => [w.w, w.t0] as Word)] }); cur = []; };
  for (const w of words) {
    const last = cur[cur.length - 1];
    if (last && (last.line !== w.line || cur.length >= 7 || w.t0 - last.t1 > 0.6)) flush();
    cur.push(w);
  }
  flush();
  return cues;
}

/** SubRip text from a film's captions, in either shape: line cues ({t0, t1, lines}) or word-timed ({w, t0, t1, line}).
 *  Entries that fit neither shape are skipped, so a new caption format can never stop an import. */
export function captionsToSrt(captions: unknown[]): string {
  const isCue = (c: unknown): c is FilmCaption => !!c && Array.isArray((c as FilmCaption).lines);
  const isWord = (c: unknown): c is WordCaption => !!c && typeof (c as WordCaption).w === "string" && typeof (c as WordCaption).t0 === "number";
  const cues = [...captions.filter(isCue), ...wordsToCaptions(captions.filter(isWord))].sort((a, b) => a.t0 - b.t0);
  return cues
    .filter((c) => c.t1 > c.t0 && c.lines.length)
    .map((c, i) => `${i + 1}\n${stamp(c.t0)} --> ${stamp(c.t1)}\n${c.lines.map((l) => l.map((w) => w[0].replace(/\*/g, "")).join(" ")).join("\n")}\n`)
    .join("\n");
}
