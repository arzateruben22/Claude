"use client";
// The three ways to take an approved export to a platform. Each records a hand-off (never a publication):
// only "Mark uploaded" or a verified integration says a post is live.
import { useEffect, useState } from "react";
import { handedOff } from "@/app/actions";
import { Icon } from "./Icon";

export function HandOff({ publicationId, videoUrl, fileName, uploadUrl, platformLabel, shareText, disabled }: {
  publicationId: string; videoUrl: string; fileName: string; uploadUrl: string; platformLabel: string; shareText: string; disabled?: boolean;
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
        {canShare ? <button type="button" className="btn topic" onClick={share} disabled={disabled || busy}><Icon name="share" size={18} /> Share to app</button> : null}
        <a className={`btn ${canShare ? "ghost" : "topic"}`} href={`${videoUrl}&dl=${encodeURIComponent(fileName)}`} download={fileName} onClick={note} aria-disabled={disabled}><Icon name="download" size={18} /> Download</a>
        <a className="btn ghost" href={uploadUrl} target="_blank" rel="noopener noreferrer" onClick={note} aria-disabled={disabled}><Icon name="external" size={18} /> Open {platformLabel}</a>
      </div>
      <p className="faint" role="status" aria-live="polite" style={{ margin: 0, fontSize: 13, minHeight: "1.2em" }}>{msg}</p>
    </div>
  );
}
