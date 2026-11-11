#!/usr/bin/env python3
"""Measure a delivered video against the studio's hard gates and the automated part of the
100-point internal rubric (films/channels/studio/QA.md, films/channels/studio/qa/rubric.json).

    python3 -I films/channels/studio/tools/qa_episode.py <video.mp4> [--episode episode.json]
        [--kind short|premium|part|long] [--out qa-report.json]
        [--scores rubric-scores.json] [--dialog dialog.wav] [--cards] [--file-only] [--release]
    python3 -I films/channels/studio/tools/qa_episode.py --blank-scores [--kind long]

What it measures from the file alone, with ffmpeg and ffprobe:
    size, frame rate, codec, length against the format's window, file size,
    integrated loudness and true peak (ebur128), mono safety (correlation, fold-down loss),
    picture against sound length, silence in the mix (silencedetect, -40 dB, 1.2 s),
    frozen picture (freezedetect, 1.4 s; a hold inside the last 8 s is the end card),
    flashes (large luminance swings; more than 3 in any second fails), a blank first frame.

What it reads when the files sit beside the video or the episode spec (skip with --file-only):
    the dialogue stem (voiceless gaps), claims.json, packaging.json, the kit's qa-delivery.json or
    audit.json (text audit), the studio's qa.json (sound sync), chapters.txt, episode.json
    (look gate; validate.py is run on it), and the delivery file names.

Options:
    --episode FILE   the master episode spec; gives the kind, size, frame rate and length window
    --kind KIND      short, premium, part or long (default: from --episode, else from the aspect)
    --out FILE       write the JSON report here (default: print it to stdout)
    --scores FILE    scores and gate results recorded by people (make one with --blank-scores)
    --dialog FILE    the dialogue stem, when it is not at build/audio/stems/dialog.wav
    --cards          a long video joined from finished episodes with narrated still cards
                     (the Season 2 format): frozen stretches are listed for a person to confirm
                     instead of failing
    --file-only      measure the file and read nothing else
    --release        exit 1 unless every hard gate has passed, the people's gates included, and the
                     internal score is complete and at the pass mark (95)
    --blank-scores   print a fill-in scores file for the people's criteria and gates, then stop

The report holds every measurement, each hard gate (pass, fail, waiting on a person, not checked),
where each threshold came from, the automated rubric points earned, and the criteria that still
need a person. The summary goes to stderr.

Exit status: 1 when a hard gate fails (with --release: also when any hard gate has not passed, or the
internal score is incomplete or under the pass mark), 2 when the video or a named file cannot be read,
else 0. The score is an internal assessment, not proof of
quality: a failed hard gate blocks release whatever the score. Standard library only; ffmpeg and
ffprobe must be on the PATH.
"""
import argparse
import datetime
import json
import math
import re
import subprocess
import sys
import tempfile
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.dont_write_bytecode = True

HERE = Path(__file__).resolve().parent
STUDIO = HERE.parent                                   # films/channels/studio
RUBRIC = STUDIO / "qa" / "rubric.json"
KINDS = ("short", "premium", "part", "long")
TOOL = "films/channels/studio/tools/qa_episode.py"

# ── thresholds ──────────────────────────────────────────────────────────────────────────────────
# qa/rubric.json "formats" is the authority; this copy is used only when that file cannot be read.
# Keep the two in step.
_NINE = {
    "aspect": "9:16", "size": [1080, 1920], "youtubeSize": [1440, 2560], "fps": 30,
    "lufs": [-15.0, -13.0], "truePeakDb": -1.0, "avLength": {"frames": 1},
    "mono": {"minCorrelation": 0.3, "maxLossDb": 3.0, "hard": True},
    "flashesPerS": 3,
    "silence": {"db": -40, "s": 1.2},
    "voiceGap": {"db": -42, "s": 1.2, "toleranceFrames": 1, "hard": True},
    "freeze": {"noiseDb": -60, "s": 1.4, "endCardWindowS": 3.0, "endCardMaxS": 8.0},
    "firstFrame": {"blankLeadMaxS": 0.0},
    "maxMb": 95,
    "lengthToleranceFrames": 1,
}
FALLBACK_FORMATS = {
    "short": dict(_NINE, lengthS=[61.0, 75.0], targetS=[61.0, 75.0]),
    "part": dict(_NINE, lengthS=[61.0, 75.0], targetS=[61.0, 75.0]),
    "premium": dict(_NINE, lengthS=[70.0, 90.0], targetS=[70.0, 90.0]),
    "long": dict(_NINE, aspect="16:9", size=[2560, 1440], youtubeSize=None,
                 lufs=[-15.5, -12.5], avLength={"seconds": 0.1},
                 mono={"minCorrelation": 0.3, "maxLossDb": 3.0, "hard": False},
                 voiceGap={"db": -42, "s": 1.2, "toleranceFrames": 1, "hard": False},
                 firstFrame={"blankLeadMaxS": 0.5}, lengthToleranceFrames=0,
                 lengthS=[510.0, 660.0], targetS=[510.0, 570.0]),
}
# Where each threshold came from. Printed in the report beside the gate that uses it.
SOURCES = {
    "size": "kits/cinema/film/qa.py (1080x1920); kits/cinema/film/compilation.mjs (2560x1440 long video); "
            "kits/cinema/film/youtube1440.py (the 1440x2560 YouTube file is an upscale)",
    "fps": "kits/cinema/film/scorecard.py (format target: 30 fps CFR); kits/cinema/film/render.mjs",
    "length": "short and part 61 to 75 s (1:01 to 1:15: films/channels/SEASON-FORMAT.md and the channel "
              "identities); premium 70 to 90 s (SEASON-FORMAT.md); one frame of tolerance. kits/cinema/film/qa.py "
              "is looser (60 to 75.5 s) and is not the gate. long: at least 8:30 (SEASON-FORMAT.md), at most 11 min "
              "(kits/cinema/film/compilation.mjs)",
    "loudness": "9:16: -15 to -13 LUFS, kits/cinema/film/qa.py. long: -14 LUFS within 1.5, "
                "kits/cinema/film/compilation.mjs. Measured with ffmpeg ebur128, as the kit does",
    "true_peak": "at most -1 dBTP on the delivered AAC: kits/cinema/film/qa.py, compilation.mjs",
    "av_length": "9:16: within one frame, kits/cinema/film/qa.py. long: within 0.1 s, compilation.mjs",
    "mono_safe": "correlation at least 0.3 and fold-down loss at most 3 dB: kits/cinema/film/qa.py. "
                 "compilation.mjs has no such gate, so a long video is measured but not gated",
    "flashes": "at most 3 flashes in any second; a transition is a luminance change of 0.1 or more, darker "
               "side under 0.8, over 25% of the frame: kits/cinema/film/qa.py (WCAG 2.3.1). Counted as the kit "
               "counts: every adjacent pair of opposite transitions, about twice WCAG's figure on a steady strobe",
    "silence": "studio standing gate: no silence of 1.2 s or more (films/channels/CTA.md, 'the voice-gap "
               "rule'); -40 dB on the delivered mix is this tool's setting",
    "voice_gaps": "voiceless gaps of at most 1.2 s on the dialogue stem at -42 dB: One More Orbit "
                  "season2/gaps.py, films/channels/CTA.md. One frame of tolerance is this tool's setting",
    "freeze": "1.4 s is a tool setting, from the coordinator's brief; not yet written in a rule file (the only "
              "written number is the renderer's audit warning at 2.5 s, kits/cinema/film/render.mjs). Noise -60 dB "
              "is ffmpeg's default. The end-card allowance (a hold inside the last 8 s, the longest card "
              "kits/cinema/film/compilation.mjs draws, or one that reaches the last 3 s) is this tool's setting",
    "first_frame": ".claude/skills/cinema-kit/SKILL.md: frame 0 is already composed (9:16: the platform cover is a "
                   "frame of the video). A long video may fade in from black; the half-second limit is this tool's "
                   "setting, set after the delivered Skin Sense Season 2 long video, which opens on one black frame",
    "file_size": "kits/cinema/film/compilation.mjs fails over 95 MB (GitHub refuses 100 MB)",
    "text_audit": "0 text-audit warnings: kits/cinema/film/qa.py, from the render's audit.json "
                  "(build/final/ or, on the plain path, build/final-plain/). The audit also warns on identical "
                  "frames for more than 2.5 s",
    "sound_sync": "transients within one frame of their picture event: kits/cinema/studio/qa.py",
    "claims_honest": "films/channels/STUDIO-STYLE.md: a claim is OK only when a person has opened the "
                     "source; a search excerpt stays OPEN. The verified_via values that may carry ok are this "
                     "tool's allow-list (films/channels/studio/QA.md, section 3B)",
    "sources_opened": "films/channels/STUDIO-STYLE.md; films/channels/studio/tools/validate.py (nothing "
                      "is exported while sources are open)",
    "chapters": "kits/cinema/film/compilation.mjs: the first chapter at 0:00, each at least 10 s, starts "
                "computed from segment starts; prism-studio links parts by exact chapter titles",
    "look_gate": "films/channels/SEASON-FORMAT.md; .claude/skills/cinema-kit/SKILL.md (stills before the "
                 "full render)",
    "packaging": "films/channels/PACKAGING.md: five titles, three thumbnails, three pairings, a winner, "
                 "every check true; the thumbnail text never repeats the title and has at most 4 words",
}
FLASH = {"change": 26, "darkBelow": 204, "area": 0.25}   # 0.1 and 0.8 of 255; qa.py's 25% of the frame
BLANK_SPREAD = 8                                         # luma levels between the 0.05% and 99.95% points
GRID_LONG_SIDE = 192                                     # half the kit's 216x384 flash grid
# How a claim may be verified and still be marked ok (QA.md, section 3B). validate.py carries the same lists.
VIA_PAGE = ("page", "owner opened the page")             # a person read the source itself; needs a source link
VIA_DERIVED = ("calculation", "derivation", "own model")  # no outside page: the sum is in calc.py, and the row says so
VIA_ASSUMED = ("assumption (no source)",)                 # a stated assumption or hedge; the note says what is assumed


class Stop(Exception):
    """A problem that ends the run with exit status 2."""


# ── small helpers ───────────────────────────────────────────────────────────────────────────────
def run(cmd):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, errors="replace")
    except FileNotFoundError:
        raise Stop(f"{cmd[0]} is not installed or not on the PATH")


def load_json(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def rate(text):
    try:
        a, b = (text or "0/1").split("/")
        return float(a) / float(b) if float(b) else 0.0
    except ValueError:
        return 0.0


def num(v, default=None):
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def stamp(t):
    t = max(0.0, t)
    return f"{int(t // 60)}:{t % 60:05.2f}"


def rel(path):
    try:
        return str(Path(path).resolve().relative_to(Path.cwd().resolve()))
    except ValueError:
        return str(path)


# ── measurements from the file ──────────────────────────────────────────────────────────────────
def probe(video):
    r = run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(video)])
    if r.returncode != 0:
        raise Stop(f"ffprobe cannot read {video}: {r.stderr.strip()[:200]}")
    j = json.loads(r.stdout)
    v = next((s for s in j.get("streams", []) if s.get("codec_type") == "video"), None)
    a = next((s for s in j.get("streams", []) if s.get("codec_type") == "audio"), None)
    if v is None:
        raise Stop(f"{video} has no picture stream")
    fdur = num(j.get("format", {}).get("duration"), 0.0)
    out = {"container": {"sizeMb": round(Path(video).stat().st_size / 1e6, 2), "durationS": round(fdur, 3)},
           "video": {"codec": v.get("codec_name"), "profile": v.get("profile"), "width": int(v["width"]),
                     "height": int(v["height"]), "fps": round(rate(v.get("r_frame_rate")), 3),
                     "avgFps": round(rate(v.get("avg_frame_rate")), 3), "frames": int(num(v.get("nb_frames"), 0)),
                     "durationS": round(num(v.get("duration"), fdur), 3), "pixFmt": v.get("pix_fmt"),
                     "colorPrimaries": v.get("color_primaries"),
                     "mbps": round(num(v.get("bit_rate"), 0) / 1e6, 2)},
           "audio": None}
    if a is not None:
        out["audio"] = {"codec": a.get("codec_name"), "sampleRate": int(num(a.get("sample_rate"), 0)),
                        "channels": int(num(a.get("channels"), 0)), "kbps": round(num(a.get("bit_rate"), 0) / 1e3),
                        "durationS": round(num(a.get("duration"), fdur), 3)}
    return out


def silences(log, total=None):
    """silencedetect's log lines as [{start, end, s}]; a stretch still open at the end runs to `total`."""
    starts = [max(0.0, float(x)) for x in re.findall(r"silence_start: (-?[\d.]+)", log)]
    ends = [(float(a), float(b)) for a, b in re.findall(r"silence_end: (-?[\d.]+) \| silence_duration: (-?[\d.]+)", log)]
    out = [{"start": round(s, 3), "end": round(e, 3), "s": round(e - s, 3)} for s, (e, _) in zip(starts, ends)]
    if len(starts) > len(ends) and total is not None:
        s = starts[len(ends)]
        out.append({"start": round(s, 3), "end": round(total, 3), "s": round(total - s, 3)})
    return out


def audio_levels(video, prof):
    """Loudness, true peak and loudness range (ebur128, as the kit measures them), and silence in the mix."""
    sil = prof["silence"]
    r = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(video), "-map", "0:a:0", "-af",
             f"silencedetect=n={sil['db']}dB:d={sil['s']},ebur128=peak=true:framelog=verbose", "-f", "null", "-"])
    s = r.stderr[r.stderr.rfind("Summary:"):] if "Summary:" in r.stderr else ""

    def get(pat):
        m = re.search(pat, s)
        return float(m.group(1)) if m and m.group(1) not in ("-inf", "inf", "nan") else None

    return {"lufs": get(r"I:\s+(-?[\d.]+|-inf) LUFS"), "truePeakDb": get(r"Peak:\s+(-?[\d.]+|-inf) dBFS"),
            "lra": get(r"LRA:\s+(-?[\d.]+) LU")}, r.stderr


def mono_fold(video, lufs_stereo):
    """Left/right correlation and how much quieter the mono fold-down is, from ffmpeg alone.

    With l, r and m the RMS of left, right and (left + right) / 2:
    correlation = (4 m^2 - l^2 - r^2) / (2 l r). The loss is the stereo loudness less the fold-down's."""
    graph = ("[0:a:0]aformat=channel_layouts=stereo,asplit[x][y];"
             "[x]astats=measure_overall=none:measure_perchannel=RMS_level[o1];"
             "[y]pan=stereo|c0=0.5*c0+0.5*c1|c1=0.5*c0+0.5*c1,astats=measure_overall=none:measure_perchannel=RMS_level,"
             "ebur128=framelog=verbose[o2]")
    r = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(video), "-filter_complex", graph,
             "-map", "[o1]", "-f", "null", "-", "-map", "[o2]", "-f", "null", "-"])
    groups = {}
    for idx, db in re.findall(r"\[Parsed_astats_(\d+) @ [^\]]+\] RMS level dB: (-?[\d.]+|-inf)", r.stderr):
        groups.setdefault(int(idx), []).append(0.0 if db == "-inf" else 10 ** (float(db) / 20))
    keys = sorted(groups)
    if len(keys) < 2 or len(groups[keys[0]]) < 2 or not groups[keys[1]]:
        return {"correlation": None, "monoLossDb": None}
    l, rr = groups[keys[0]][0], groups[keys[0]][1]
    m = groups[keys[1]][0]
    corr = 1.0 if l * rr == 0 else max(-1.0, min(1.0, (4 * m * m - l * l - rr * rr) / (2 * l * rr)))
    s = r.stderr[r.stderr.rfind("Summary:"):] if "Summary:" in r.stderr else ""
    mm = re.search(r"I:\s+(-?[\d.]+) LUFS", s)
    loss = round(lufs_stereo - float(mm.group(1)), 2) if mm and lufs_stereo is not None else None
    return {"correlation": round(corr, 2), "monoLossDb": loss}


def grid(w, h):
    k = GRID_LONG_SIDE / max(w, h)
    return max(2, int(round(w * k / 2)) * 2), max(2, int(round(h * k / 2)) * 2)


def picture_pass(video, w, h, fps, prof):
    """One decode of the picture at a small size: frozen stretches and large luminance transitions.

    The flash rule is kits/cinema/film/qa.py's, computed inside ffmpeg so no pixel is touched in Python:
    linear BT.709 luminance per pixel, then per frame the share of the frame that got brighter, and
    the share that got darker, by 0.1 or more where the darker side is under 0.8. The two masks come out
    stacked (brighter on top) and are counted here."""
    gw, gh = grid(w, h)
    lin = r"if(lte(val\,10)\,val/12.92\,255*pow((val/255+0.055)/1.055\,2.4))"
    fz = prof["freeze"]
    graph = (
        f"[0:v:0]scale={gw}:{gh}:flags=area,format=rgb24,split[fz][c];"   # rgb24 pinned: freezedetect's result moves with the pixel format
        f"[fz]freezedetect=n={fz['noiseDb']}dB:d={fz['s']},nullsink;"
        f"[c]format=rgb24,lutrgb=r='{lin}':g='{lin}':b='{lin}',"
        "colorchannelmixer=rr=0.2126:rg=0.7152:rb=0.0722:gr=0.2126:gg=0.7152:gb=0.0722:br=0.2126:bg=0.7152:bb=0.0722,"
        "format=gbrp,extractplanes=g,split=3[y1][y2][y3];"
        f"[y1]tblend=all_mode=subtract,lut=y='gte(val\\,{FLASH['change']})*255'[u];"
        f"[y2]negate,tblend=all_mode=subtract,lut=y='gte(val\\,{FLASH['change']})*255'[d];"
        f"[y3]tblend=all_mode=darken,lut=y='lt(val\\,{FLASH['darkBelow']})*255',split[m1][m2];"
        "[u][m1]blend=all_mode=and[uu];[d][m2]blend=all_mode=and[dd];[uu][dd]vstack[x]")
    n = gw * gh
    trans, big, frames = [], 0.0, 0
    with tempfile.TemporaryFile() as err:
        try:
            p = subprocess.Popen(["ffmpeg", "-hide_banner", "-nostats", "-i", str(video), "-an", "-sn",
                                  "-filter_complex", graph, "-map", "[x]", "-f", "rawvideo", "-pix_fmt", "gray", "-"],
                                 stdout=subprocess.PIPE, stderr=err)
        except FileNotFoundError:
            raise Stop("ffmpeg is not installed or not on the PATH")
        while True:
            b = p.stdout.read(2 * n)
            if len(b) < 2 * n:
                break
            if frames:                                   # tblend's first frame has no earlier frame to compare
                up, down = b.count(255, 0, n) / n, b.count(255, n) / n
                big = max(big, up, down)
                if up >= FLASH["area"]:
                    trans.append((frames, 1))
                if down >= FLASH["area"]:
                    trans.append((frames, -1))
            frames += 1
        p.stdout.close()
        code = p.wait()
        err.seek(0)
        log = err.read().decode("utf-8", "replace")
    if code != 0 or not frames:
        raise Stop(f"ffmpeg could not decode the picture of {video}: {log.strip()[-300:]}")
    f = int(round(fps)) or 30
    ends = [b[0] for a, b in zip(trans, trans[1:]) if a[1] != b[1]]   # a flash ends at its second transition
    worst = max((sum(1 for g in ends if t <= g < t + f) for t in ends), default=0)
    flashing = {"grid": [gw, gh], "framesRead": frames, "largeTransitions": len(trans),
                "transitionFrames": [t[0] for t in trans][:60], "flashes": len(ends), "maxFlashesPerS": worst,
                "largestChangedArea": round(big, 3)}
    total = frames / fps if fps else 0.0
    starts = [float(x) for x in re.findall(r"freezedetect\.freeze_start: (-?[\d.]+)", log)]
    stops = [float(x) for x in re.findall(r"freezedetect\.freeze_end: (-?[\d.]+)", log)]
    stretches = []
    for i, s in enumerate(starts):
        e = stops[i] if i < len(stops) else total        # still frozen at the last frame
        stretches.append({"start": round(s, 3), "end": round(e, 3), "s": round(e - s, 3)})
    return flashing, {"grid": [gw, gh], "noiseDb": fz["noiseDb"], "minS": fz["s"], "stretches": stretches}


def first_second(video, w, h, fps):
    """Is frame 0 composed? Luma spread of each frame in the first second, at a quarter of the size."""
    k = 480 / max(w, h)
    gw, gh = max(2, int(round(w * k / 2)) * 2), max(2, int(round(h * k / 2)) * 2)
    count = max(1, int(round(fps)) or 30)
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", str(video), "-an", "-frames:v", str(count), "-vf",
                        f"scale={gw}:{gh}:flags=area,format=gray", "-f", "rawvideo", "-"], capture_output=True)
    n, rows = gw * gh, []
    for i in range(len(r.stdout) // n):
        hist = Counter(r.stdout[i * n:(i + 1) * n])
        lo_cut, hi_cut, seen, lo, hi = n * 0.0005, n * 0.9995, 0, None, None
        for level in range(256):
            seen += hist.get(level, 0)
            if lo is None and seen > lo_cut:
                lo = level
            if hi is None and seen >= hi_cut:
                hi = level
                break
        mean = sum(level * c for level, c in hist.items()) / n
        rows.append({"spread": (hi or 0) - (lo or 0), "meanLuma": round(mean, 1)})
    if not rows:
        return {"firstFrameBlank": None, "note": "no frame could be read"}
    lead = 0
    for row in rows:
        if row["spread"] > BLANK_SPREAD:
            break
        lead += 1
    return {"grid": [gw, gh], "framesRead": len(rows), "firstFrameSpread": rows[0]["spread"],
            "firstFrameMeanLuma": rows[0]["meanLuma"], "firstFrameBlank": rows[0]["spread"] <= BLANK_SPREAD,
            "firstFrameBlack": rows[0]["spread"] <= BLANK_SPREAD and rows[0]["meanLuma"] <= 20,
            "blankLeadFrames": lead, "blankLeadS": round(lead / fps, 3) if fps else None,
            "blankMeans": f"luma spread of {BLANK_SPREAD} levels or less between the 0.05% and 99.95% points"}


# ── gates ───────────────────────────────────────────────────────────────────────────────────────
class Gates:
    def __init__(self):
        self.rows = {}

    def add(self, gid, result, measured, want, *, hard=True, kind="file", note=None, who=None):
        row = {"id": gid, "hard": hard, "from": kind, "result": result, "measured": measured, "want": want,
               "source": SOURCES.get(gid)}
        if who:
            row["who"] = who
        if note:
            row["note"] = note
        self.rows[gid] = row

    def result(self, gid):
        return self.rows.get(gid, {}).get("result", "not_checked")


def file_gates(G, m, prof, kind, video, cards):
    V, A = m["video"], m["audio"]
    fps = V["fps"] or 30.0
    # size
    want = prof["size"]
    got = [V["width"], V["height"]]
    yt = prof.get("youtubeSize")
    if got == want:
        G.add("size", "pass", f"{got[0]}x{got[1]}", f"{want[0]}x{want[1]}")
    elif yt and got == yt and Path(video).name.endswith("-youtube.mp4"):
        G.add("size", "pass", f"{got[0]}x{got[1]}", f"{want[0]}x{want[1]}",
              note="This is the YouTube file: an upscale of the 1080x1920 master. Label it '1440 upscale', never native. "
                   "Run this tool on the master as well.")
    else:
        G.add("size", "fail", f"{got[0]}x{got[1]}", f"{want[0]}x{want[1]}")
    # frame rate
    ok = abs(V["fps"] - prof["fps"]) < 0.01 and abs(V["avgFps"] - prof["fps"]) < 0.01
    G.add("fps", "pass" if ok else "fail", f"{V['fps']:g} fps (average {V['avgFps']:g})", f"{prof['fps']} fps, constant")
    # codec (reported; part of rubric criterion VF1, not a hard gate)
    codec_ok = V["codec"] == "h264" and V["pixFmt"] == "yuv420p" and (A is None or A["codec"] == "aac")
    G.add("codec", "pass" if codec_ok else "fail", f"{V['codec']} {V['pixFmt']}, {A['codec'] if A else 'no sound'}",
          "H.264 yuv420p with AAC sound", hard=False)
    # length
    lo, hi = prof["lengthS"]
    dur = V["durationS"]
    tol = prof.get("lengthToleranceFrames", 0) / fps + 1e-6
    in_window = lo - tol <= dur <= hi + tol
    G.add("length", "pass" if in_window else "fail", f"{dur:.3f} s ({stamp(dur)})",
          f"{lo:g} to {hi:g} s" + (" (one frame of tolerance)" if prof.get("lengthToleranceFrames") else ""),
          note=None if in_window or kind == "long" or dur < hi else
          "An approved master is not re-cut because of this. Season 2 masters remixed with the like/follow line over "
          "a held end card run long (Reality Rulebook ep12: 77.233 s): the coordinator decides (QA.md, section 3).")
    tlo, thi = prof["targetS"]
    G.add("length_target", "pass" if tlo - tol <= dur <= thi + tol else "fail", f"{dur:.3f} s", f"{tlo:g} to {thi:g} s (the target)",
          hard=False)
    # sound
    if A is None:
        for gid in ("loudness", "true_peak", "av_length", "silence"):
            G.add(gid, "fail", "no sound stream", "a sound stream")
        G.add("mono_safe", "fail", "no sound stream", "a sound stream", hard=prof["mono"]["hard"])
    else:
        a, b = prof["lufs"]
        l = A.get("lufs")
        G.add("loudness", "pass" if l is not None and a <= l <= b else "fail", f"{l} LUFS", f"{a:g} to {b:g} LUFS")
        tp = A.get("truePeakDb")
        G.add("true_peak", "pass" if tp is not None and tp <= prof["truePeakDb"] else "fail", f"{tp} dBTP",
              f"at most {prof['truePeakDb']:g} dBTP")
        allow = prof["avLength"].get("seconds", prof["avLength"].get("frames", 1) / fps)
        diff = abs(A["durationS"] - V["durationS"])
        G.add("av_length", "pass" if diff <= allow + 1e-6 else "fail",
              f"picture {V['durationS']:.3f} s, sound {A['durationS']:.3f} s (apart by {diff:.3f} s)",
              f"within {allow:.3f} s")
        mo = prof["mono"]
        c, loss = A.get("correlation"), A.get("monoLossDb")
        if c is None or loss is None:
            G.add("mono_safe", "not_checked", "could not be measured", "mono-safe", hard=mo["hard"])
        else:
            ok = c >= mo["minCorrelation"] and loss <= mo["maxLossDb"]
            G.add("mono_safe", "pass" if ok else "fail", f"correlation {c}, fold-down loss {loss} dB",
                  f"correlation at least {mo['minCorrelation']}, loss at most {mo['maxLossDb']} dB", hard=mo["hard"],
                  note=None if mo["hard"] else "Measured, not gated, for a long video.")
        sil = m["silenceInMix"]["stretches"]
        worst = max((s["s"] for s in sil), default=0.0)
        G.add("silence", "pass" if not sil else "fail",
              "none" if not sil else f"{len(sil)} stretch{'es' if len(sil) != 1 else ''}, longest {worst:.2f} s at {stamp(max(sil, key=lambda s: s['s'])['start'])}",
              f"no stretch of {prof['silence']['s']:g} s or more below {prof['silence']['db']} dB in the mix")
    # flashes
    F = m["flashing"]
    G.add("flashes", "pass" if F["maxFlashesPerS"] <= prof["flashesPerS"] else "fail",
          f"worst {F['maxFlashesPerS']} in one second ({F['flashes']} flash pairs, {F['largeTransitions']} large transitions)",
          f"at most {prof['flashesPerS']} flashes in any second")
    # freeze
    fz = prof["freeze"]
    flagged, end_holds = [], []                          # (the parameter `cards` is the --cards flag)
    for s in m["freezes"]["stretches"]:
        reaches_end = s["end"] >= dur - fz["endCardWindowS"] and s["s"] <= fz["endCardMaxS"]
        in_end_zone = s["start"] >= dur - fz["endCardMaxS"]      # a caption change splits one held card into pieces
        s["endCard"] = bool(reaches_end or in_end_zone)
        (end_holds if s["endCard"] else flagged).append(s)
    m["freezes"]["endCardS"] = round(sum(s["s"] for s in end_holds), 3)
    want = (f"no frozen stretch of {fz['s']:g} s or more, except the end card (a hold inside the last {fz['endCardMaxS']:g} s, "
            f"or one of at most {fz['endCardMaxS']:g} s that reaches the last {fz['endCardWindowS']:g} s)")
    if not flagged:
        G.add("freeze", "pass", "none" + (f"; end card held {m['freezes']['endCardS']:.2f} s" if end_holds else ""), want)
    else:
        longest = max(flagged, key=lambda s: s["s"])
        got = (f"{len(flagged)} frozen stretch{'es' if len(flagged) != 1 else ''}, {sum(s['s'] for s in flagged):.1f} s in all, "
               f"longest {longest['s']:.2f} s at {stamp(longest['start'])}")
        if kind == "long" and cards:
            G.add("freeze", "review", got, want, who="coordinator",
                  note="--cards: a person confirms that every stretch is a narrated card (opening, bridge, finale, an "
                       "episode's own end card) and records it under gates.freeze in the scores file.")
        else:
            G.add("freeze", "fail", got, want,
                  note="If this is a long video joined from finished episodes with narrated still cards, run again "
                       "with --cards." if kind == "long" else None)
    # first frame
    S = m["start"]
    allow = prof.get("firstFrame", {}).get("blankLeadMaxS", 0.0)
    want = ("frame 0 is composed: not blank, not black" if not allow
            else f"a fade-in from black of at most {allow:g} s of blank picture")
    if S.get("firstFrameBlank") is None:
        G.add("first_frame", "not_checked", S.get("note", "not read"), want)
    else:
        G.add("first_frame", "pass" if (S["blankLeadS"] or 0.0) <= allow + 1e-6 else "fail",
              f"frame 0 luma spread {S['firstFrameSpread']} levels, mean {S['firstFrameMeanLuma']}"
              + (f"; blank for the first {S['blankLeadS']} s ({S['blankLeadFrames']} frame{'s' if S['blankLeadFrames'] != 1 else ''})"
                 if S["firstFrameBlank"] else ""), want)
    mb = m["container"]["sizeMb"]
    G.add("file_size", "pass" if mb <= prof["maxMb"] else "fail", f"{mb} MB", f"at most {prof['maxMb']} MB")


# ── files beside the video ──────────────────────────────────────────────────────────────────────
def first_existing(*paths):
    for p in paths:
        if p and Path(p).is_file():
            return Path(p)
    return None


def voice_gap_gate(G, m, stem, prof, fps, kind):
    vg = prof["voiceGap"]
    r = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(stem), "-af", f"silencedetect=n={vg['db']}dB:d=1.0", "-f", "null", "-"])
    pr = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(stem)])
    total = num(pr.stdout.strip(), None)
    gaps = silences(r.stderr, total)
    limit = vg["s"] + vg.get("toleranceFrames", 0) / (fps or 30.0)
    over = []
    for g in gaps:
        g["tail"] = total is not None and g["end"] >= total - 0.05      # the hold after the last word
        g["over"] = (not g["tail"]) and g["s"] > limit
        if g["over"]:
            over.append(g)
    m["voiceGaps"] = {"stem": rel(stem), "thresholdDb": vg["db"], "listedFromS": 1.0, "limitS": round(limit, 3), "gaps": gaps}
    want = f"no voiceless gap over {vg['s']:g} s (plus one frame) before the end card"
    if not over:
        longest = max((g["s"] for g in gaps if not g["tail"]), default=0.0)
        G.add("voice_gaps", "pass", f"longest {longest:.2f} s", want, hard=vg["hard"], kind="sidecar")
    else:
        got = f"{len(over)} gap{'s' if len(over) != 1 else ''} over the limit, longest {max(g['s'] for g in over):.2f} s at {stamp(max(over, key=lambda g: g['s'])['start'])}"
        if vg["hard"]:
            G.add("voice_gaps", "fail", got, want, kind="sidecar")
        else:
            G.add("voice_gaps", "review", got, want, hard=False, kind="sidecar", who="coordinator",
                  note="A long film may hold picture-only beats. A person confirms each gap is one, with picture and sound carrying it.")


def claim_state(row):
    """(kind, settled, problem) for one ledger row.

    kind: 'page', 'derived', 'assumed' or 'other'. settled: the row is ok and a person could have signed it (a page
    a person opened, a sum that names calc.py, or an assumption that says what it assumes). problem: why an ok row
    is not honest, else None. Any other verified_via ('search excerpt', 'not read', 'from memory', empty) never
    carries ok."""
    via = str(row.get("verified_via", "")).strip().lower()
    ok = str(row.get("status", "")).strip().lower() == "ok"
    named = (str(row.get("note", "")) + " " + str(row.get("source_title", ""))).lower()
    if via in VIA_PAGE:
        kind, problem = "page", None if str(row.get("source_url", "")).strip() else "no source link"
    elif via in VIA_DERIVED:
        kind, problem = "derived", None if "calc.py" in named else "a derivation that does not name calc.py"
    elif via in VIA_ASSUMED:
        kind, problem = "assumed", None if str(row.get("note", "")).strip() else "an assumption with no note"
    else:
        kind, problem = "other", f"verified_via is \"{str(row.get('verified_via', '')).strip()}\""
    return kind, ok and problem is None, problem if ok else None


def claims_gates(G, m, path):
    rows = load_json(path)
    if not isinstance(rows, list) or not all(isinstance(r, dict) for r in rows):
        G.add("claims_complete", "fail", f"{rel(path)} is not a list of claims", "a claims ledger", hard=False, kind="sidecar")
        G.add("claims_honest", "fail", "the ledger cannot be read", "a claims ledger", kind="sidecar")
        return
    need = ("id", "sentence", "claim", "source_url", "source_title", "accessed", "verified_via", "status")
    no_page = ("source_url", "source_title")                 # a derivation or an assumption has no page to link
    name = lambda r: str(r.get("id", "?"))
    missing, dishonest, open_ids, kinds, n_ok = [], [], [], Counter(), 0
    for r in rows:
        kind, settled, problem = claim_state(r)
        kinds[kind] += 1
        n_ok += str(r.get("status", "")).strip().lower() == "ok"
        if any(not str(r.get(k, "")).strip() for k in need if not (kind in ("derived", "assumed") and k in no_page)):
            missing.append(name(r))
        if problem:
            dishonest.append(f"{name(r)} ({problem})")
        if not settled:
            open_ids.append(name(r))
    wording = [name(r) for r in rows if str(r.get("status", "")).strip().lower() == "needs-wording"]
    m["sidecars"]["claims"] = {"file": rel(path), "claims": len(rows), "ok": n_ok, "settled": len(rows) - len(open_ids),
                               "open": len(open_ids), "byKind": dict(kinds)}
    bad = missing or wording or not rows
    G.add("claims_complete", "fail" if bad else "pass",
          f"{len(rows)} claims" + (f"; fields missing in {', '.join(missing[:6])}" if missing else "")
          + (f"; needs-wording: {', '.join(wording[:6])}" if wording else ""),
          "every claim has its sentence, source link and title, access date, how it was verified and a status (a derivation "
          "or an assumption needs no link or title); none needs wording",
          hard=False, kind="sidecar")
    G.add("claims_honest", "fail" if dishonest else "pass",
          (f"{n_ok} marked ok, each by a page a person opened, a calc.py sum or a stated assumption" if n_ok else "no claim is marked ok yet")
          if not dishonest else f"marked ok without a page a person opened or a calc.py sum: {'; '.join(dishonest[:8])}",
          "ok only when verified_via is 'page' or 'owner opened the page' (with a source link), or the row is a derivation "
          "('calculation', 'derivation', 'own model') that names calc.py, or a stated assumption", kind="sidecar")
    G.add("sources_opened", "pass" if rows and not open_ids else "waiting",
          f"{len(rows) - len(open_ids)} of {len(rows)} claims settled" + (f"; open: {', '.join(open_ids[:8])}{'…' if len(open_ids) > 8 else ''}" if open_ids else ""),
          "every claim ok, and marked honestly, before the episode is exported", kind="sidecar", who="owner or reviewer")


def words_of(text):
    """Lower-case words of a title or a thumbnail text, punctuation dropped ("Won't" is wont)."""
    return re.findall(r"[a-z0-9]+", re.sub(r"['’]", "", str(text or "").lower()))


def packaging_gate(G, m, path):
    p = load_json(path)
    if not isinstance(p, dict):
        G.add("packaging", "fail", f"{rel(path)} cannot be read", "packaging.json", kind="sidecar")
        return
    checks = p.get("checks") if isinstance(p.get("checks"), dict) else {}
    false = [k for k, v in checks.items() if v is not True]
    counts = [len(p.get(k) or []) for k in ("titles", "thumbnails", "pairings")]
    title = str((p.get("winner") or {}).get("title", "")).strip()
    problems = []
    if counts[0] < 5:
        problems.append(f"{counts[0]} titles")
    if counts[1] < 3:
        problems.append(f"{counts[1]} thumbnails")
    if counts[2] < 3:
        problems.append(f"{counts[2]} pairings")
    if not title:
        problems.append("no winner title")
    elif len(title) > 100:
        problems.append("winner title over 100 characters")
    if len(checks) < 7:
        problems.append(f"{len(checks)} of 7 checks present")
    if false:
        problems.append("checks not true: " + ", ".join(false))
    # PACKAGING.md: the thumbnail never repeats the title; its text is optional, at most 4 words. checks.duplication
    # is the builder's own word for it, so the texts are compared here as well.
    winner = p.get("winner") if isinstance(p.get("winner"), dict) else {}
    texts = [("winner.thumbnailText", winner.get("thumbnailText"))]
    texts += [(f"thumbnail {t.get('id')} text", t.get("text")) for t in p.get("thumbnails") or []
              if isinstance(t, dict) and t.get("id") is not None and t.get("id") == winner.get("thumbnail")]
    if isinstance(p.get("shortsCover"), dict):
        texts.append(("shortsCover.text", p["shortsCover"].get("text")))
    title_words, seen = set(words_of(title)), set()
    for label, text in texts:
        w = tuple(words_of(text)) if isinstance(text, str) else ()
        if not w or w in seen:
            continue
        seen.add(w)
        if len(w) > 4:
            problems.append(f"{label} has {len(w)} words (at most 4)")
        elif title_words and all(x in title_words for x in w):
            problems.append(f"{label} \"{text.strip()}\" repeats the title")
    note = None
    if title and not 35 <= len(title) <= 55:
        note = f"The winner title has {len(title)} characters; PACKAGING.md aims for 35 to 55."
    m["sidecars"]["packaging"] = {"file": rel(path), "titles": counts[0], "thumbnails": counts[1], "pairings": counts[2],
                                  "winnerTitle": title, "checksTrue": len(checks) - len(false)}
    G.add("packaging", "fail" if problems else "pass", "; ".join(problems) if problems else f"5/3/3 present, winner \"{title}\", every check true",
          "five titles, three thumbnails, three pairings, a winner, every check true; the thumbnail text has at most "
          "4 words and never repeats the title", kind="sidecar", note=note)


def chapters_gate(G, m, path, dur):
    rows = []
    for line in Path(path).read_text(encoding="utf-8", errors="replace").splitlines():
        mm = re.match(r"^\s*(?:(\d+):)?(\d{1,2}):(\d{2})\s+(.+?)\s*$", line)
        if mm:
            rows.append((int(mm[1] or 0) * 3600 + int(mm[2]) * 60 + int(mm[3]), mm[4]))
    problems = []
    if not rows:
        problems.append("no chapter lines")
    else:
        if rows[0][0] != 0:
            problems.append("the first chapter does not start at 0:00")
        starts = [r[0] for r in rows] + [dur]
        if any(b <= a for a, b in zip(starts, starts[1:])):
            problems.append("starts are not in order inside the film")
        short = [rows[i][1] for i in range(len(rows)) if starts[i + 1] - starts[i] < 10]
        if short:
            problems.append(f"under 10 s: {', '.join(short[:3])}")
        if len({r[1] for r in rows}) != len(rows):
            problems.append("two chapters share a title")
    m["sidecars"]["chapters"] = {"file": rel(path), "chapters": len(rows), "starts": [r[0] for r in rows]}
    G.add("chapters", "fail" if problems else "pass", "; ".join(problems) if problems else f"{len(rows)} chapters, first at 0:00, each at least 10 s",
          "first at 0:00, in order, each at least 10 s, one title each", kind="sidecar",
          note="Not checked here: that each start is a segment's start (the build tool computes them) and that each "
               "title equals one part's title exactly (Prism links parts that way).")


def names_check(G, m, video, kind):
    v = Path(video)
    problems = []
    if kind == "long":
        if v.parent.parent.name != "compilations":
            G.add("names", "not_checked", "the file is not in compilations/<name>/", "delivery names", hard=False, kind="sidecar")
            return
        if v.name != f"{v.parent.name}-16x9.mp4":
            problems.append(f"the video is not named {v.parent.name}-16x9.mp4")
        others = [p.name for p in v.parent.glob("*-16x9.mp4") if p != v]
        if others:
            problems.append("a second *-16x9.mp4 is in the folder")
        for name in ("thumbnail.jpg", "chapters.txt", "description.md", "packaging.json"):
            if not (v.parent / name).is_file():
                problems.append(f"{name} is missing")
    else:
        if v.parent.name != "out" or not re.fullmatch(r"ep\d\d", v.parent.parent.name):
            G.add("names", "not_checked", "the file is not in epNN/out/", "delivery names", hard=False, kind="sidecar")
            return
        if not v.name.endswith("-9x16.mp4"):
            problems.append("the master does not end in -9x16.mp4")
        else:
            stem = v.name[:-len("-9x16.mp4")]
            masters = [p.name for p in v.parent.glob("*-9x16.mp4")]
            if len(masters) != 1:
                problems.append(f"{len(masters)} files end in -9x16.mp4 (Prism takes the first)")
            if not (v.parent / f"{stem}-9x16.jpg").is_file():
                problems.append("the poster is missing")
            for name, label in ((f"{stem}-cover.jpg", "cover"), (f"{stem}-9x16-youtube.mp4", "YouTube file")):
                f = v.parent / name
                if not f.is_file():
                    problems.append(f"the {label} is missing")
                elif f.stat().st_mtime < v.stat().st_mtime:
                    problems.append(f"the {label} is older than the master")
            if not (v.parent / "packaging.json").is_file():
                problems.append("out/packaging.json is missing")
    if " " in v.name:
        problems.append("the file name has a space")
    G.add("names", "fail" if problems else "pass", "; ".join(problems) if problems else "named and placed as STRUCTURE.md says",
          "films/channels/studio/STRUCTURE.md: the names Prism imports", hard=False, kind="sidecar")


def sidecar_gates(G, m, video, kind, episode_path, episode, dialog, prof, fps):
    v = Path(video)
    efolder = Path(episode_path).parent if episode_path else None
    if v.parent.name == "out":
        folder = v.parent.parent
    elif v.parent.parent.name == "compilations":
        folder = v.parent
    else:
        folder = None
    roots = [r for r in (efolder, folder) if r]
    m["sidecars"] = {"lookedIn": [rel(r) for r in roots]}
    files = (episode or {}).get("files", {}) if isinstance((episode or {}).get("files"), dict) else {}

    def find(*names, named=None):
        cands = []
        if named and efolder:
            cands.append(efolder / named)
        for r in roots:
            cands += [r / n for n in names]
        return first_existing(*cands)

    stem = first_existing(dialog) if dialog else find("build/audio/stems/dialog.wav", "audio/stems/dialog.wav")
    if dialog and not stem:
        raise Stop(f"--dialog {dialog} cannot be read")
    if stem:
        voice_gap_gate(G, m, stem, prof, fps, kind)
    else:
        G.add("voice_gaps", "not_checked", "no dialogue stem found", "no voiceless gap over 1.2 s", hard=prof["voiceGap"]["hard"],
              kind="sidecar", note="Pass --dialog, or run beside build/audio/stems/dialog.wav. The mix-silence gate above is not a substitute: music fills voiceless gaps.")
    tag = re.fullmatch(r"episode\.(.+)\.json", Path(episode_path).name) if episode_path else None
    claims = (first_existing(efolder / f"claims.{tag[1]}.json") if tag else None) \
        or find("claims.json", named=files.get("claims"))      # episode.example.json goes with claims.example.json
    if claims:
        claims_gates(G, m, claims)
    else:
        G.add("claims_complete", "not_checked", "no claims.json found", "a complete claims ledger", hard=False, kind="sidecar")
        G.add("claims_honest", "not_checked", "no claims.json found", "ok only when a person has opened the source", kind="sidecar")
        G.add("sources_opened", "not_checked", "no claims.json found", "every claim ok, and marked honestly, before the episode is exported",
              kind="sidecar", who="owner or reviewer")
    pack = find("out/packaging.json", "packaging.json", named=files.get("packaging"))
    if pack:
        packaging_gate(G, m, pack)
    else:
        G.add("packaging", "not_checked", "no packaging.json found", "five titles, three thumbnails, three pairings, a winner, every check true",
              kind="sidecar", who="builder, then the owner chooses the title")
    # text audit: the kit's delivery QA, else the render's own audit
    qd = find("build/qa-delivery.json", "review/qa-delivery.json")
    warnings = None
    if qd and isinstance(load_json(qd), dict) and isinstance(load_json(qd).get("text_audit"), dict):
        warnings, src = load_json(qd)["text_audit"].get("warnings"), qd
    else:
        audits = sorted((p for r in roots for p in r.glob("build/final*/*/audit.json")),
                        key=lambda p: p.stat().st_mtime, reverse=True)      # final/ or final-plain/: the newest render
        if audits and isinstance(load_json(audits[0]), dict):
            warnings, src = len(load_json(audits[0]).get("warnings", [])), audits[0]
    if warnings is None:
        G.add("text_audit", "not_checked", "no text audit found (build/qa-delivery.json or build/final*/*/audit.json)",
              "0 text-audit warnings", kind="sidecar",
              note="build/ is not committed: run on the machine that rendered, or check the safe box on frame grabs.")
    else:
        m["sidecars"]["textAudit"] = {"file": rel(src), "warnings": warnings}
        G.add("text_audit", "pass" if warnings == 0 else "fail", f"{warnings} warnings", "0 text-audit warnings", kind="sidecar",
              note="The plain path's audit covers the kit's hud text only, not Skin Sense's own overlays: check those on "
                   "frame grabs." if "final-plain" in src.parts else None)
    sq = find("build/audio/qa.json", "audio/qa.json")
    sj = load_json(sq) if sq else None
    if isinstance(sj, dict) and isinstance(sj.get("sync"), dict):
        per = sj["sync"].get("per_kind", {})
        m["sidecars"]["soundQa"] = {"file": rel(sq), "syncPass": sj["sync"].get("pass"), "kinds": len(per),
                                    "underVoice": sj.get("under_voice"), "phone": sj.get("phone")}
        G.add("sound_sync", "pass" if sj["sync"].get("pass") is True else "fail",
              f"{len(per)} event kinds, {'all pass' if sj['sync'].get('pass') else 'a kind is out of sync'}",
              "transients within one frame of their picture event", kind="sidecar")
        uv = sj.get("under_voice")
        if isinstance(uv, dict):
            G.add("voice_over_music", "pass" if uv.get("pass") is True else "fail", f"voice {uv.get('gap_lu')} LU over the music",
                  "at least 10 LU while the voice speaks (kits/cinema/studio/qa.py)", hard=False, kind="sidecar")
        else:
            G.add("voice_over_music", "not_checked", "no voice spans in the studio's qa.json", "at least 10 LU", hard=False, kind="sidecar")
    else:
        G.add("sound_sync", "not_checked", "no studio qa.json found (build/audio/qa.json)", "transients within one frame", kind="sidecar")
        G.add("voice_over_music", "not_checked", "no studio qa.json found", "at least 10 LU", hard=False, kind="sidecar")
    if kind == "long":
        ch = first_existing(v.parent / "chapters.txt")
        if ch:
            chapters_gate(G, m, ch, m["video"]["durationS"])
        else:
            G.add("chapters", "not_checked", "no chapters.txt beside the video", "first at 0:00, each at least 10 s", kind="sidecar")
    names_check(G, m, video, kind)
    # the episode spec: look gate, and the plan itself
    if episode is not None:
        gate = (episode.get("status") or {}).get("lookGate")
        G.add("look_gate", "pass" if gate == "approved" else "waiting", f"status.lookGate is \"{gate}\"",
              "the owner has approved the look", kind="sidecar", who="owner")
        val = HERE / "validate.py"
        if val.is_file():
            r = run([sys.executable, "-I", str(val), str(episode_path)])
            lines = [x for x in (r.stdout + r.stderr).splitlines() if x.strip()]
            res = {0: "pass", 1: "fail"}.get(r.returncode, "not_checked")
            G.add("plan_valid", res, lines[-1][:200] if lines else f"validate.py exit {r.returncode}",
                  "tools/validate.py reports no failure", hard=False, kind="sidecar")
            m["sidecars"]["validate"] = {"exit": r.returncode, "lines": lines[-12:]}
        else:
            G.add("plan_valid", "not_checked", "tools/validate.py not found", "tools/validate.py reports no failure", hard=False, kind="sidecar")
    else:
        G.add("look_gate", "not_checked", "no episode.json given", "the owner has approved the look", kind="sidecar", who="owner")
        G.add("plan_valid", "not_checked", "no episode.json given", "tools/validate.py reports no failure", hard=False, kind="sidecar")


# ── people's scores, the rubric ─────────────────────────────────────────────────────────────────
def person_gates(G, rubric, scores, kind):
    given = (scores or {}).get("gates", {}) if isinstance((scores or {}).get("gates"), dict) else {}
    for g in (rubric or {}).get("hardGates", []):
        gid = g["id"]
        if kind not in g.get("appliesTo", KINDS):
            continue
        entry = given.get(gid) if isinstance(given.get(gid), dict) else None
        if g.get("check") == "person":
            if gid == "gate_a_h":
                s = (entry or {}).get("scores") if isinstance((entry or {}).get("scores"), dict) else None
                if s and all(isinstance(s.get(k), int) and 1 <= s[k] <= 5 for k in "abcdefgh"):
                    ok = min(s.values()) >= 3 and all(s[k] >= 4 for k in "agh") and entry.get("openIssues", 0) in (0, [], None)
                    G.add(gid, "pass" if ok else "fail", ", ".join(f"({k}) {s[k]}" for k in "abcdefgh"), g["rule"], kind="person", who=g.get("who"))
                else:
                    G.add(gid, "waiting", "not scored", g["rule"], kind="person", who=g.get("who"))
            elif entry and entry.get("result") in ("pass", "fail") and str(entry.get("by", "")).strip():
                G.add(gid, entry["result"], f"recorded by {entry['by']}" + (f": {entry['note']}" if entry.get("note") else ""),
                      g["rule"], kind="person", who=g.get("who"))
            else:
                G.add(gid, "waiting", "not recorded", g["rule"], kind="person", who=g.get("who"))
        elif entry and G.result(gid) in ("review", "not_checked") and entry.get("result") in ("pass", "fail") \
                and str(entry.get("by", "")).strip():           # a person settles what the tool could only list or not read
            row = G.rows.get(gid)
            if row is None:
                continue
            row["result"] = entry["result"]
            row["note"] = f"Recorded by {entry['by']}" + (f": {entry['note']}" if entry.get("note") else "") + ". " + row.get("note", "")
            row["note"] = row["note"].strip()


def score_rubric(G, rubric, scores, kind):
    given = (scores or {}).get("criteria", {}) if isinstance((scores or {}).get("criteria"), dict) else {}
    auto, needs, person = [], [], []
    earned_auto = avail_auto = unscored_auto = earned_person = scored_person = 0
    for cat in rubric.get("categories", []):
        for c in cat.get("criteria", []):
            pts = c["points"]
            entry = given.get(c["id"]) if isinstance(given.get(c["id"]), dict) else None
            person_pts = entry.get("points") if entry else None
            person_ok = isinstance(person_pts, (int, float)) and not isinstance(person_pts, bool) and 0 <= person_pts <= pts \
                and str(entry.get("by", "")).strip()
            if c["how"] == "auto":
                avail_auto += pts
                results = [G.result(x) for x in c.get("checks", [])]
                if results and all(r == "pass" for r in results):
                    earned_auto += pts
                    auto.append({"id": c["id"], "points": pts, "earned": pts, "checks": c["checks"]})
                elif any(r == "fail" for r in results):
                    auto.append({"id": c["id"], "points": pts, "earned": 0, "checks": c["checks"],
                                 "failed": [x for x in c["checks"] if G.result(x) == "fail"]})
                elif person_ok:                          # a person settled what the tool could not read
                    earned_person += person_pts
                    scored_person += pts
                    unscored_auto += pts
                    person.append({"id": c["id"], "points": pts, "earned": person_pts, "by": entry["by"]})
                else:
                    unscored_auto += pts
                    needs.append({"id": c["id"], "category": cat["name"], "points": pts, "how": "auto",
                                  "text": c["text"], "why": "not scored: " + ", ".join(
                                      f"{x} is {G.result(x).replace('_', ' ')}" for x in c["checks"] if G.result(x) != "pass")})
            elif person_ok:
                earned_person += person_pts
                scored_person += pts
                person.append({"id": c["id"], "points": pts, "earned": person_pts, "by": entry["by"]})
            else:
                needs.append({"id": c["id"], "category": cat["name"], "points": pts, "how": c["how"], "text": c["text"]})
    complete = not needs
    total = round(earned_auto + earned_person, 1) if complete else None
    return {"internalOnly": True, "passScore": rubric.get("passScore", 95), "maxScore": rubric.get("maxScore", 100),
            "automated": {"earned": earned_auto, "available": avail_auto, "notScored": unscored_auto, "criteria": auto},
            "people": {"earned": earned_person, "scoredOutOf": scored_person, "criteria": person},
            "needsPerson": needs, "pointsStillOpen": sum(n["points"] for n in needs),
            "total": total, "meetsPassScore": None if total is None else total >= rubric.get("passScore", 95)}


def blank_scores(rubric, kind):
    out = {"episode": "", "video": "", "note": "Fill in points (whole numbers, 0 to the maximum) and who scored. "
           "Leave null what nobody has judged. This file is an internal assessment, never a public number.",
           "criteria": {}, "gates": {}}
    for cat in rubric.get("categories", []):
        for c in cat.get("criteria", []):
            if c["how"] != "auto":
                out["criteria"][c["id"]] = {"points": None, "max": c["points"], "by": c["how"], "date": "", "note": "",
                                            "what": c["text"]}
    for g in rubric.get("hardGates", []):
        if g.get("check") == "person" and kind in g.get("appliesTo", KINDS):
            if g["id"] == "gate_a_h":
                out["gates"][g["id"]] = {"scores": {k: None for k in "abcdefgh"}, "openIssues": [], "by": "", "date": "",
                                         "rule": g["rule"]}
            else:
                out["gates"][g["id"]] = {"result": None, "by": "", "date": "", "note": "", "rule": g["rule"]}
    return out


# ── main ────────────────────────────────────────────────────────────────────────────────────────
def summary(report, G, out):
    m = report["measurements"]
    V = m["video"]
    p = lambda *a: print(*a, file=sys.stderr)
    p(f"{Path(report['file']).name} · {report['kind']} · {V['width']}x{V['height']} · {V['fps']:g} fps · "
      f"{V['durationS']:.3f} s · {m['container']['sizeMb']} MB")
    label = {"pass": "PASS", "fail": "FAIL", "waiting": "wait", "review": "LOOK", "not_checked": "  - "}
    for row in report["hardGates"] + report["otherChecks"]:
        p(f"  {label[row['result']]}  {row['id']:<17}{'' if row['hard'] else '(not a gate) '}{row['measured']}")
        if row["result"] in ("fail", "review") and row.get("note"):
            p(f"        {row['note']}")
    v = report["verdict"]
    p(f"  hard gates: {v['pass']} pass, {v['fail']} fail, {v['waiting']} waiting on a person, {v['notChecked']} not checked")
    r = report["rubric"]
    if r:
        a = r["automated"]
        line = f"  internal rubric: automated {a['earned']} of {a['available']} points"
        if a["notScored"]:
            line += f" ({a['notScored']} not scored: files missing)"
        if r["total"] is None:
            line += f"; {r['pointsStillOpen']} points still need a person"
        else:
            line += f"; total {r['total']} of {r['maxScore']} (pass mark {r['passScore']}, internal only)"
        p(line)
    p("  " + v["summary"])
    if out:
        p(f"  report: {out}")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("video", nargs="?")
    ap.add_argument("--episode")
    ap.add_argument("--kind", choices=KINDS)
    ap.add_argument("--out")
    ap.add_argument("--scores")
    ap.add_argument("--dialog")
    ap.add_argument("--cards", action="store_true")
    ap.add_argument("--file-only", action="store_true")
    ap.add_argument("--release", action="store_true")
    ap.add_argument("--blank-scores", action="store_true")
    args = ap.parse_args(argv)
    t0 = time.time()
    rubric = load_json(RUBRIC)
    formats = (rubric or {}).get("formats") or FALLBACK_FORMATS
    try:
        if args.blank_scores:
            if not rubric:
                raise Stop(f"{RUBRIC} cannot be read")
            print(json.dumps(blank_scores(rubric, args.kind or "short"), indent=1, ensure_ascii=False))
            return 0
        if not args.video:
            ap.error("the video file is required")
        video = Path(args.video)
        if not video.is_file():
            raise Stop(f"{video} does not exist")
        episode = None
        if args.episode:
            episode = load_json(args.episode)
            if not isinstance(episode, dict) or not isinstance(episode.get("format"), dict):
                raise Stop(f"{args.episode} is not a studio episode spec (no \"format\"). Skin Sense ep04 to ep12 hold an "
                           "older file of the same name; leave --episode out for those.")
        scores = None
        if args.scores:
            scores = load_json(args.scores)
            if not isinstance(scores, dict):
                raise Stop(f"{args.scores} cannot be read")
        m = probe(video)
        V = m["video"]
        if args.kind:
            kind, kind_from = args.kind, "--kind"
        elif episode and episode["format"].get("kind") in KINDS:
            kind, kind_from = episode["format"]["kind"], "episode.json"
        else:
            kind, kind_from = ("long" if V["width"] > V["height"] else "short"), "assumed from the aspect"
        prof = json.loads(json.dumps({**FALLBACK_FORMATS[kind], **(formats.get(kind) or {})}))   # a copy this run may adjust
        notes = []
        if rubric is None:
            notes.append("qa/rubric.json could not be read: built-in thresholds used, no rubric points counted.")
        if episode:
            f = episode["format"]
            if isinstance(f.get("size"), list) and f["size"] != prof["size"]:
                notes.append(f"episode.json asks for {f['size'][0]}x{f['size'][1]}; the {kind} profile's size is "
                             f"{prof['size'][0]}x{prof['size'][1]}. The episode's size is used.")
                prof["size"] = f["size"]
            if isinstance(f.get("fps"), int):
                prof["fps"] = f["fps"]
            if isinstance(f.get("durationS"), list) and len(f["durationS"]) == 2:
                prof["targetS"] = [float(f["durationS"][0]), float(f["durationS"][1])]
        fps = V["fps"] or float(prof["fps"])
        timing = {}

        def timed_picture():
            t = time.time()
            out = picture_pass(video, V["width"], V["height"], fps, prof)
            timing["pictureS"] = round(time.time() - t, 1)
            return out

        with ThreadPoolExecutor(max_workers=1) as pool:      # the picture decodes while the sound is measured
            picture = pool.submit(timed_picture)
            t = time.time()
            if m["audio"]:
                levels, log = audio_levels(video, prof)
                m["audio"].update(levels)
                m["silenceInMix"] = {"thresholdDb": prof["silence"]["db"], "minS": prof["silence"]["s"],
                                     "stretches": silences(log, m["audio"]["durationS"])}
                m["audio"].update(mono_fold(video, levels["lufs"]) if m["audio"]["channels"] >= 2
                                  else {"correlation": 1.0, "monoLossDb": 0.0})
                m["avLengthDiffS"] = round(abs(m["audio"]["durationS"] - V["durationS"]), 3)
            m["start"] = first_second(video, V["width"], V["height"], fps)
            timing["soundAndFirstSecondS"] = round(time.time() - t, 1)
            m["flashing"], m["freezes"] = picture.result()
        G = Gates()
        file_gates(G, m, prof, kind, video, args.cards)
        if args.file_only:
            m["sidecars"] = {"skipped": "--file-only"}
        else:
            sidecar_gates(G, m, video, kind, args.episode, episode, args.dialog, prof, fps)
        if rubric and (scores or not args.file_only):
            person_gates(G, rubric, scores, kind)
        hard = [r for r in G.rows.values() if r["hard"]]
        other = [r for r in G.rows.values() if not r["hard"]]
        count = Counter(r["result"] for r in hard)
        failed = [r["id"] for r in hard if r["result"] == "fail"]
        open_ = [r["id"] for r in hard if r["result"] in ("waiting", "review", "not_checked")]
        # release needs both: every hard gate passed, and the internal score complete and at the pass mark
        rub = score_rubric(G, rubric, scores, kind) if rubric else None
        pass_score = rub["passScore"] if rub else None
        total = rub["total"] if rub else None
        score_met = total is not None and total >= pass_score
        if rub is None:
            score_text = "No internal score: qa/rubric.json could not be read."
        elif total is None:
            score_text = (f"The internal score is not complete: {rub['pointsStillOpen']} of {rub['maxScore']} points still "
                          f"need a person (pass mark {pass_score}).")
        else:
            score_text = (f"Internal score {total:g} of {rub['maxScore']}, pass mark {pass_score}: "
                          + ("met." if score_met else "not met, so not ready for release."))
        if failed:
            text = "FAIL: " + ", ".join(failed) + ". Fix the shot or the stage that caused it; the score does not matter until this passes."
        elif open_:
            text = "No hard gate failed. Not ready for release: " + ", ".join(open_) + " still open. " + score_text
        elif args.file_only:
            text = "Every gate measured from the file passed. --file-only: the gates that need other files or a person were not checked."
        else:
            text = "Every hard gate passed. " + score_text
        code = 1 if failed or (args.release and (open_ or args.file_only or not score_met)) else 0
        timing["totalS"] = round(time.time() - t0, 1)
        report = {
            "tool": TOOL, "reportVersion": 1, "made": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
            "internalAssessment": "An internal check by the studio's own tool. A score is not proof of quality, and a "
                                  "failed hard gate blocks release whatever the score.",
            "file": rel(video), "kind": kind, "kindFrom": kind_from,
            "episode": (episode or {}).get("id"), "notes": notes,
            "options": {"cards": args.cards, "fileOnly": args.file_only, "release": args.release,
                        "scores": rel(args.scores) if args.scores else None},
            "profile": prof,
            "measurements": m,
            "hardGates": hard, "otherChecks": other,
            "thresholdSources": {r["id"]: r["source"] for r in G.rows.values() if r.get("source")},
            "rubric": rub,
            "verdict": {"pass": count["pass"], "fail": count["fail"], "waiting": count["waiting"] + count["review"],
                        "notChecked": count["not_checked"], "failed": failed, "open": open_,
                        "score": total, "passScore": pass_score, "scoreMet": score_met,
                        "releaseReady": not failed and not open_ and not args.file_only and score_met,
                        "exitCode": code, "summary": text},
            "timing": timing,
        }
        text_out = json.dumps(report, indent=1, ensure_ascii=False)
        if args.out:
            Path(args.out).parent.mkdir(parents=True, exist_ok=True)
            Path(args.out).write_text(text_out + "\n", encoding="utf-8")
        else:
            print(text_out)
        summary(report, G, args.out)
        return code
    except Stop as e:
        print(f"qa_episode: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
