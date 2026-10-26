// SubRip captions from a film's own caption track (film.json "captions": word-timed lines). The burned-in
// captions and the .srt come from the same timings, so a platform's caption upload matches the picture.
type Word = [string, number];
export type FilmCaption = { t0: number; t1: number; lines: Word[][] };

const stamp = (s: number) => {
  const ms = Math.max(0, Math.round(s * 1000));
  const h = Math.floor(ms / 3_600_000), m = Math.floor(ms / 60_000) % 60, sec = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
};

export function captionsToSrt(captions: FilmCaption[]): string {
  return captions
    .filter((c) => c.t1 > c.t0 && c.lines.length)
    .map((c, i) => `${i + 1}\n${stamp(c.t0)} --> ${stamp(c.t1)}\n${c.lines.map((l) => l.map((w) => w[0].replace(/\*/g, "")).join(" ")).join("\n")}\n`)
    .join("\n");
}
