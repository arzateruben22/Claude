"""cta_remix.py <epdir> <name> <line 1-4>: the owner's like/follow moment on an ALREADY-FINISHED short, picture untouched.
The end card is held (its last full frame, before the loop dip) just long enough for the voiced line, which starts 0.3 s after the
spoken tease; the music is ducked under it by the studio mix; 1080 file says 'follow', the -youtube file says 'subscribe'.
usage: python3 -I cta_remix.py films/channels/space/ep09 one-more-orbit-s2e03 3"""
import json, os, subprocess, sys, shutil, wave
ep, name, line = sys.argv[1], sys.argv[2], int(sys.argv[3])
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
VOICE = os.path.expanduser("~/.cache/cinema-voice"); PY = VOICE + "/venv/bin/python"
LINES = {1: "Quick thing: if that made the sky feel bigger, tap like and {v}.",
         2: "Still looking up? Tap like and {v}. There's plenty more sky.",
         3: "Real quick: like and {v}, if space just got a little stranger for you.",
         4: "If you want one more orbit, tap like and {v}."}
out = os.path.join(ep, "out"); mp4 = os.path.join(out, f"{name}-9x16.mp4"); yt = os.path.join(out, f"{name}-9x16-youtube.mp4")
work = os.path.join(ep, "build", "cta"); shutil.rmtree(work, ignore_errors=True); os.makedirs(work)
sh = json.load(open(os.path.join(ep, "sheet.json"))); film = json.load(open(os.path.join(ep, "film.json")))
D = sh["duration"]; last = film["voice"][-1]; te = last["t"] + last["dur"]          # the spoken tease ends here
# 1. the two voiced lines (Kokoro am_michael, same voice as the film)
scr = os.path.join(work, "cta.md"); open(scr, "w").write("\n".join(f"## {k}\nvo: {LINES[line].format(v=v)}\n" for k, v in (("follow", "follow"), ("subscribe", "subscribe"))))
vo = os.path.join(work, "vo"); subprocess.run([PY, "-I", f"{ROOT}/kits/cinema/voice/tts.py", scr, vo, "--voice", "am_michael", "--speed", "0.95"], check=True, capture_output=True)
def dur(p):
    with wave.open(p) as w: return w.getnframes() / w.getframerate()
L = {k: dur(os.path.join(vo, f"{i:02d}.wav")) for i, k in ((1, "follow"), (2, "subscribe"))}
Lmax = max(L.values()); t_cta = round(te + 0.3, 3)
newD = round(max(D, t_cta + Lmax + 0.8), 3); delta = round(newD - D, 3); T = round(D - 1.0, 3)       # hold point: end card fully up, before the loop dip
print(f"tease ends {te:.2f}  CTA at {t_cta}  lengths {L}  film {D} -> {newD} (+{delta} s held at {T})")
# 2. the two mixes with the studio renderer (music ducks under the voice, the section runs to the new end)
mix = {}
for k in ("follow", "subscribe"):
    d = os.path.join(ep, "vo", f"cta_{k}.wav"); shutil.copy(os.path.join(vo, f"{1 if k == 'follow' else 2:02d}.wav"), d)
    s = json.loads(json.dumps(sh)); s["duration"] = newD
    for sec in s["sections"]:
        if sec["t1"] >= D - 1e-3: sec["t1"] = newD
    for e in s["events"]:
        if e.get("t1") and e["t1"] >= D - 1e-3: e["t1"] = newD
    s["voice"] = s["voice"] + [{"id": "cta", "t": t_cta, "file": f"vo/cta_{k}.wav"}]
    sp = os.path.join(work, f"sheet_{k}.json"); json.dump(s, open(sp, "w"), indent=1)
    ad = os.path.join(work, f"audio_{k}"); r = subprocess.run(["python3", "-I", f"{ROOT}/kits/cinema/studio/render.py", "--root", ep, sp, ad], capture_output=True, text=True)
    mix[k] = os.path.join(ad, "mix.m4a"); assert os.path.exists(mix[k]), r.stdout[-600:] + r.stderr[-600:]
# 3. the picture: hold the end card for delta seconds (the loop dip stays at the end)
src = os.path.join(work, "orig.mp4"); shutil.copy(mp4, src)
vf = f"[0:v]trim=0:{T},setpts=PTS-STARTPTS[a];[0:v]trim={T}:{T + 0.0334},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration={delta}[h];[0:v]trim={T + 0.0334},setpts=PTS-STARTPTS[b];[a][h][b]concat=n=3:v=1:a=0[v]"
for k, dest in (("follow", mp4),):
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", src, "-i", mix[k], "-filter_complex", vf, "-map", "[v]", "-map", "1:a", "-r", "30", "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", "-c:a", "copy", "-t", str(newD), "-movflags", "+faststart", dest], check=True)
# 4. the 1440p YouTube file from the new 1080 picture, with the 'subscribe' audio
os.remove(yt)
subprocess.run(["python3", "-I", f"{ROOT}/kits/cinema/film/youtube1440.py", ep, "--force"], check=True, capture_output=True)
tmp = yt + ".tmp.mp4"
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", yt, "-i", mix["subscribe"], "-map", "0:v", "-map", "1:a", "-c", "copy", "-t", str(newD), tmp], check=True); os.replace(tmp, yt)
print("done:", mp4, yt)
