"""Compose a film's sound from its cue sheet: score, foley and voice as three stems.

The cue sheet is the one timeline. Sections set the harmony and energy, events place the foley
on the first frame that shows them, voice lines duck the music. Nothing is hand-timed here.

  sheet = {"duration": 26, "fps": 30, "preset": "lumevina-dew",
           "sections": [{"id": "healthy", "t0": 0, "t1": 6, "energy": 0.45}],
           "events":   [{"t": 0.8, "kind": "label", "tag": "l-hair", "pos": [0.12, 0.45]}],
           "voice":    [{"id": "vo01", "t": 0.3, "file": "vo/01.wav"}]}
"""
import json
import math
from pathlib import Path

import numpy as np

from . import instruments as I
from .core import SR, Bus, read_wav
from .dsp import filt, onset, reverb, saturate
from .duck import duck_curve

HERE = Path(__file__).resolve().parent
EVENTS = {k: v for k, v in json.loads((HERE.parent / "events.json").read_text()).items() if not k.startswith("_")}


def load_preset(name):
    return json.loads((HERE / "vibes" / f"{name}.json").read_text())


def first_frame(t, fps, after=False):
    """The first frame that shows an event at t: the frame at or after t, or, for something that
    grows from nothing (after=True: at t it is still at zero), the first frame after t."""
    return (math.floor(t * fps + 1e-6) + 1) / fps if after else math.ceil(t * fps - 1e-6) / fps


def _up(note, octaves):
    return note[:-1] + str(int(note[-1]) + octaves)


# ── score ─────────────────────────────────────────────────────────────
def score(sheet, P):
    dur, beat = sheet["duration"], 60.0 / P["bpm"]
    bus = Bus(dur, "music")
    secs = sheet["sections"]
    L = P["layers"]
    for i, s in enumerate(secs):
        ch = s.get("chord") or P["progression"][i % len(P["progression"])]
        e = s.get("energy", 0.5)
        last = i == len(secs) - 1
        # the pad overlaps the next section by its release, so chords cross-fade on the cut
        a = s["t0"] - (0.35 if i else 0.0)
        span = s["t1"] - a + (0.0 if last else L["pad"]["release"])
        bus.add(I.pad(ch["pad"], span + (2.5 if last else 0), L["pad"]["bright"], f"pad{i}", L["pad"]["attack"] if i == 0 else 0.5, L["pad"]["release"]), a, L["pad"]["gain"])
        # felt piano: chord tones an octave up, quarters (eighths once energy rises), a phrase per bar
        step = beat / 2 if e >= L["felt"]["eighths_above"] else beat
        tones = [_up(n, L["felt"]["octave"]) for n in ch["pad"][1:]] + [_up(ch["pad"][1], L["felt"]["octave"] + 1)]
        pattern = [0, 2, 1, 3, 2, 1, 3, 0]
        k = math.ceil((s["t0"] + 1e-6) / step)
        while k * step < s["t1"] - (0.0 if last else 0.15) and (not last or k * step < dur - 2.2):
            t = k * step
            pos = round(t / beat, 6)
            vel = (0.62 if pos % 4 == 0 else 0.52 if pos % 1 == 0 else 0.4) * (0.75 + 0.5 * e)
            bus.add(I.felt(tones[pattern[k % len(pattern)] % len(tones)], 2.6, vel, f"felt{i}.{k}", L["felt"]["bright"]), t, L["felt"]["gain"], 0.25 * math.sin(k * 1.7))
            k += 1
        if e >= L["sub"]["above"]:
            k = math.ceil(s["t0"] / (4 * beat))
            while k * 4 * beat < s["t1"] - 0.2:
                bus.add(I.sub(ch["root"], min(4 * beat, s["t1"] - k * 4 * beat) + 0.3, f"sub{i}.{k}"), k * 4 * beat, L["sub"]["gain"])
                k += 1
    bus.add(I.air(dur, "air"), 0, L["air"]["gain"])
    return bus.x


# ── foley ─────────────────────────────────────────────────────────────
def _voice(spec, e, idx, fps):
    v, tag, kind = spec["voice"], e.get("tag", e["kind"]) + f":{idx}", e["kind"]
    span = max(0.2, e.get("t1", e["t"]) - e["t"])
    if v == "bell":
        notes = spec["notes"]
        return I.bell(notes[min(idx, len(notes) - 1)], 1.6, tag=tag)
    if v == "tick":
        return I.tick(2200 + 30 * int("".join(c for c in e.get("tag", "0") if c.isdigit()) or 0), tag=tag)
    if v == "chime":
        return I.chime(spec["notes"], 2.4, tag=tag)
    if v == "tap":
        x = I.tap(tag, 520 + 40 * (idx % 5))
        if "bounce" in spec:
            d, g = spec["bounce"]
            y = np.zeros(int((d + 0.15) * SR), np.float32)
            b = I.tap(tag + "b", 600 + 40 * (idx % 3)) * np.float32(10 ** ((g - spec["gain"]) / 20))
            y[: len(x)] += x
            y[int(d * SR):int(d * SR) + len(b)] += b
            x = y
        return x
    if v == "fizz":
        return I.fizz(spec.get("dur", span), tag)
    if v == "dim":
        return I.dim(span, spec.get("note", "B1"), tag)
    if v == "swell":
        return I.swell(span, spec.get("note", "D2"), tag)
    if v == "whistle":
        return I.whistle(span, tag=tag)
    if v == "plop":
        x = I.plop(spec["f0"].get(e.get("tag"), 320) if isinstance(spec["f0"], dict) else spec["f0"], tag=tag)
        if "splash" in spec:
            s = I.splash(tag)
            out = np.zeros((max(len(x), len(s) + int(0.01 * SR)), 2), np.float32)
            out[: len(x)] += x[:, None] * np.float32(0.7071)
            out[int(0.01 * SR):int(0.01 * SR) + len(s)] += s * np.float32(10 ** ((spec["splash"] - spec["gain"]) / 20))
            return out
        return x
    if v == "sparkle":
        return I.sparkle(span, spec["notes"], tag)
    if v == "whoosh":
        return I.whoosh(spec.get("dur", 0.8), tag, spec.get("lo", 300), spec.get("hi", 4000))
    raise ValueError(f"unknown voice {v} for {kind}")


def _masked(events, P, fps, window=0.2):
    """Two sounds within `window` of each other blur into one. Keep the more important (lower prio
    in events.json); the other drops out. Equal priorities both play (a run of cells, ticks)."""
    times = []
    for n, e in enumerate(events):
        if e["kind"] in P["foley"] and not (e["kind"] == "section" and e["t"] <= 0):
            row = EVENTS.get(e["kind"], {})
            if not row.get("span"):
                times.append((first_frame(e["t"], fps, row.get("after", False)), row.get("prio", 2), n))
    out = set()
    for ta, pa, na in times:
        for tb, pb, nb in times:
            if na != nb and abs(ta - tb) < window and pa > pb:
                out.add(na)
    return out


def foley(sheet, P):
    """Returns (effects stem, placed cues). Each sound's own onset lands on its event's frame;
    sweeps that build up to a moment (whoosh into a cut, a whistle into a landing) end on it."""
    fps, bus, placed, count = sheet["fps"], Bus(sheet["duration"], "effects"), [], {}
    masked = _masked(sheet["events"], P, fps)
    for n, e in enumerate(sheet["events"]):
        spec = P["foley"].get(e["kind"])
        if not spec:
            continue
        idx = count.get(e["kind"], 0)
        count[e["kind"]] = idx + 1
        if (e["kind"] == "section" and e["t"] <= 0) or n in masked:
            continue
        sig = _voice(spec, e, idx, fps)
        row = EVENTS.get(e["kind"], {})
        show = first_frame(e["t"], fps, row.get("after", False))
        lead = row.get("lead", 0.0)
        if spec["voice"] == "whoosh":                      # builds into the cut: its peak lands on it
            anchor = int(0.7 * len(sig))
        elif spec["voice"] == "whistle":                    # swells into the landing
            anchor = len(sig)
        else:
            anchor = onset(sig)
        t_place = show - lead - anchor / SR
        pan = (e["pos"][0] * 2 - 1) * 0.6 if e.get("pos") else e.get("pan", 0.0)
        bus.add(sig, t_place, spec["gain"] + e.get("gain", 0.0), pan)
        placed.append({"kind": e["kind"], "tag": e.get("tag"), "t": e["t"], "show": round(show, 4), "sound": round(show - lead, 4),
                       "place": round(t_place, 4), "anchor": anchor, "voice": spec["voice"], "gain": spec["gain"], "pan": round(pan, 3), "sig": sig})
    return bus.x, placed


# ── voice ─────────────────────────────────────────────────────────────
def dialog(sheet, root):
    bus, spans = Bus(sheet["duration"], "dialog"), []
    for v in sheet.get("voice", []):
        x = filt(read_wav(Path(root) / v["file"]), lo=80, order=2)
        bus.add(x, v["t"], v.get("gain", 0.0))
        spans.append((v["t"], v["t"] + len(x) / SR))
    return bus.x, spans


# ── the three stems ───────────────────────────────────────────────────
def build(sheet, root="."):
    P = load_preset(sheet["preset"])
    sp, dr = P["space"], P["drive"]
    music = saturate(reverb(filt(score(sheet, P), lo=40), sp["music"][0], sp["music"][1], f"{P['name']}:music"), dr["music"])
    effects, placed = foley(sheet, P)
    effects = saturate(reverb(effects, sp["foley"][0], sp["foley"][1], f"{P['name']}:foley"), dr["effects"])
    voice, spans = dialog(sheet, root)
    if spans:
        voice = reverb(voice, sp["dialog"][0], sp["dialog"][1], f"{P['name']}:dialog")
        n = len(music)
        music = music * duck_curve(spans, n, sheet.get("duck_db", -9.0))[:, None]
        effects = effects * duck_curve(spans, n, -3.0)[:, None]
    # the film ends on its last frame: a short fade so nothing is cut mid-ring
    tail = int(0.6 * SR)
    for x in (music, effects, voice):
        x[-tail:] *= (np.linspace(1, 0, tail, dtype=np.float32) ** 2)[:, None]
    return {"dialog": voice.astype(np.float32), "music": music.astype(np.float32), "effects": effects.astype(np.float32)}, placed, spans
