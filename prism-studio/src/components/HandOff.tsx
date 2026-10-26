"use client";
// The ways to take an approved export to a platform: share to the app (phones), download, or open the upload page.
// Each records a hand-off (never a publication): only "Mark uploaded" or a verified integration says a post is live.
// Rendered only for an approved export; unapproved posts get "Review and approve" instead (no download link at all),
// and markHandedOff ignores a publication without a live approval in any case.
import { useEffect, useState } from "react";
import { handedOff } from "@/app/actions";
import { Icon } from "./Icon";

export function HandOff({ publicationId, videoUrl, fileName, uploadUrl, platformLabel, shareText }: {
  publicationId: string; videoUrl: string; fileName: string; uploadUrl: string; platformLabel: string; shareText: string;
}) {
  const [canShare, setCanShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    try { setCanShare(typeof navigator.canShare === "function" && navigator.canShare({ files: [new File([""], "x.mp4", { type: "video/mp4" })] })); } catch { setCanShare(false); }
  }, []);
  const note = () => { void handedOff(publicationId).then((r) => r && setMsg(r.message)); };
  const share = async () => {
    setBusy(true); setMsg("Preparing the video…");
    try {
      const blob = await (await fetch(videoUrl)).blob();
      await navigator.share({ files: [new File([blob], fileName, { type: "video/mp4" })], text: shareText });
      note();
    } catch (e) {
      setMsg((e as Error).name === "AbortError" ? "" : "Sharing didn't work here. Use Download instead.");
    } finally { setBusy(false); }
  };
  return (
    <div className="stack-sm">
      <div className="row">
        {canShare ? <button type="button" className="btn" onClick={share} disabled={busy}><Icon name="share" size={18} /> Share to app</button> : null}
        <a className={`btn${canShare ? " ghost" : ""}`} href={`${videoUrl}&dl=${encodeURIComponent(fileName)}`} download={fileName} onClick={note}><Icon name="download" size={18} /> Download</a>
        <a className="btn ghost" href={uploadUrl} target="_blank" rel="noopener noreferrer" onClick={note}><Icon name="external" size={18} /> Open {platformLabel}</a>
      </div>
      <p className="status-line faint" role="status" aria-live="polite">{msg}</p>
    </div>
  );
}
