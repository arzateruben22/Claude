// "Title & thumbnail": an episode's or long video's packaging.json (src/domain/packaging.ts), read by the importer. The
// winner title (the YouTube title) and the ChatGPT image prompt each have a copy button; the three scored pairings are
// the builder's creative judgments, never CTR predictions, and say so. Showing or copying any of it posts nothing.
import { packagingTitle, pairingsView, PACKAGING_TITLE_MAX, type Packaging } from "@/domain/packaging";
import { mediaUrl } from "@/lib/media";
import { CopyButton } from "./CopyButton";

const AXIS: Record<string, string> = {
  scroll: "Scroll", curiosity: "Curiosity", clarity: "Clarity", synergy: "Synergy", originality: "Originality", accuracy: "Accuracy", mobile: "Mobile", satisfaction: "Satisfaction",
};

/** `thumb`: the rendered winner thumbnail's media key when it is on disk; `download`: its download name. */
export function PackagingCard({ p, thumb, download, id = "title-thumbnail" }: { p: Packaging; thumb: string | null; download: string; id?: string }) {
  const title = p.winner?.title ?? "", usable = packagingTitle(p);
  const concept = p.thumbnails.find((t) => t.id === p.winner?.thumbnail) ?? null;
  const pairs = pairingsView(p);
  const failed = Object.entries(p.checks).filter(([, ok]) => !ok).map(([k]) => k);
  return (
    <section className="card stack-sm pack" id={id} aria-labelledby={`${id}-h`}>
      <div className="pack-head">
        <h3 id={`${id}-h`}>Title &amp; thumbnail</h3>
        <span className="faint num">packaging.json{p.format ? ` · ${p.format === "long" ? "long video" : "short"}` : ""}</span>
      </div>
      {failed.length ? <p className="chip bad" style={{ margin: 0 }}>A packaging check is false ({failed.join(", ")}): revise before posting</p> : null}
      <div className="pack-main" data-thumb={thumb ? (p.format === "short" ? "portrait" : "landscape") : undefined}>
        <div className="stack-sm">
          {title ? (
            <div className="copy-field">
              <span className="label">YouTube title <span className="faint">· {title.length} characters{usable ? "" : `: over ${PACKAGING_TITLE_MAX}, not used`}</span></span>
              <div className="copy-actions"><CopyButton text={title} label="Copy title" /></div>
              <p className="copy-text strong">{title}</p>
            </div>
          ) : <p className="muted" style={{ margin: 0 }}>No winner title yet: the YouTube title stays as it was.</p>}
          {p.winner?.thumbnailText || concept ? (
            <p className="pack-fact">
              <span className="label">Thumbnail{p.winner?.thumbnail ? ` ${p.winner.thumbnail}` : ""}</span>
              {p.winner?.thumbnailText ? <span className="pack-text">{p.winner.thumbnailText}</span> : <span className="faint">no text on it</span>}
            </p>
          ) : null}
          {p.winner?.why ? <p className="muted pack-why">{p.winner.why}</p> : null}
          {p.testAndCompare.length ? (
            <p className="pack-fact">
              <span className="label">Test &amp; Compare</span>
              <span>{p.testAndCompare.map((t, i) => <span key={t}>{i ? " · " : ""}<b className="pack-id">{t}</b>{p.winner?.thumbnail === t ? " (winner)" : ""}</span>)}</span>
            </p>
          ) : null}
        </div>
        {thumb ? (
          <a className="pack-thumb" href={mediaUrl(thumb, download)} download>
            <img src={mediaUrl(thumb)} alt={`The rendered winner thumbnail${p.winner?.thumbnailText ? `, reading "${p.winner.thumbnailText}"` : ""}`} loading="lazy" decoding="async" />
            <span className="post-dl">Download</span>
          </a>
        ) : null}
      </div>

      {pairs.length ? (
        <details className="pack-pairs-box">
          <summary><span>The {pairs.length === 3 ? "three" : pairs.length} pairings</span><span className="pack-disclaimer">Scores are creative judgments, not CTR predictions</span></summary>
          <ol className="pack-pairs">
            {pairs.map((x, i) => (
              <li key={i} data-winner={x.winner || undefined}>
                <div className="pack-pair-head"><b>{x.title || "(title missing)"}</b>{x.winner ? <span className="chip good">Winner</span> : null}</div>
                <div className="faint pack-pair-thumb">Thumbnail {x.thumbnail || "?"}{x.concept?.subject ? `: ${x.concept.subject}` : ""}{x.concept?.text ? ` · "${x.concept.text}"` : ""}</div>
                <dl className="pack-scores" aria-label="Creative judgments, 1 to 100 (not CTR predictions)">
                  {x.scores.map((s) => <div key={s.axis}><dt>{AXIS[s.axis] ?? s.axis}</dt><dd className="num">{s.value ?? "–"}</dd></div>)}
                </dl>
                {x.note ? <p className="faint pack-note">{x.note}</p> : null}
              </li>
            ))}
          </ol>
        </details>
      ) : null}

      {p.chatgptPrompt ? (
        <div className="copy-field">
          <span className="label" id={`${id}-prompt`}>ChatGPT prompt</span>
          <div className="copy-actions"><CopyButton text={p.chatgptPrompt} label="Copy ChatGPT prompt" /></div>
          <textarea className="copy-text pack-prompt" readOnly value={p.chatgptPrompt} aria-labelledby={`${id}-prompt`} rows={6} />
        </div>
      ) : null}
    </section>
  );
}
