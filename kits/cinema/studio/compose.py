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
from .core import SR, Bus, hz, read_wav, stereo
from .dsp import filt, onset, reverb, rms_env, saturate
from .duck import duck_curve

HERE = Path(__file__).resolve().parent
EVENTS = {k: v for k, v in json.loads((HERE.parent / "events.json").read_text()).items() if not k.startswith("_")}


def load_preset(name):
    """A preset by name. A foley entry may name a sequence kept at the top of the preset
    ("seq": "signature"), so the counter end and the title play the very same phrase."""
    P = json.loads((HERE / "vibes" / f"{name}.json").read_text())
    for spec in P.get("foley", {}).values():
        if isinstance(spec.get("seq"), str):
            spec["seq"] = P[spec["seq"]]
    return P


def first_frame(t, fps, after=False):
    """The first frame that shows an event at t: the frame at or after t, or, for something that
    grows from nothing (after=True: at t it is still at zero), the first frame after t."""
    return (math.floor(t * fps + 1e-6) + 1) / fps if after else math.ceil(t * fps - 1e-6) / fps


def _up(note, octaves):
    return note[:-1] + str(int(note[-1]) + octaves)


# ── score ─────────────────────────────────────────────────────────────
# The melodic layer when a preset doesn't name one: felt piano on the chord tones an octave up,
# quarters that turn to eighths once the energy reaches layers.felt.eighths_above, this phrase per bar.
FELT_PATTERN = [0, 2, 1, 3, 2, 1, 3, 0]


def melody_spec(L):
    """The melodic layer's arrangement, from layers.melody: {voice, pattern, step, octave, gain, ...}.
    step is in beats (1 = quarters, 0.25 = 16ths); double_above halves it once a section's energy
    reaches that; a null in the pattern is a rest. Without layers.melody it is the felt piano of
    layers.felt, exactly as before; "melody": null (or voice "none") means no melodic layer."""
    if "melody" not in L:
        F = L["felt"]
        return {"voice": "felt", "pattern": FELT_PATTERN, "step": 1, "double_above": F["eighths_above"],
                "octave": F["octave"], "gain": F["gain"], "bright": F["bright"], "dur": 2.6}
    M = L["melody"]
    if not M or M.get("voice", "none") == "none":
        return None
    return {"pattern": FELT_PATTERN, "step": 1, "double_above": None, "octave": 1, "dur": 2.6, "bright": 4000.0, **M}


def _semis(a, b):
    """Semitones from note a up to note b."""
    return 12 * math.log2(hz(b) / hz(a))


def _melodic(M, tone, prev, vel, tag):
    """One note of the melodic layer on its voice."""
    v = M["voice"]
    if v == "felt":
        return I.felt(tone, M["dur"], vel, tag, M["bright"])
    if v == "mallet":
        return I.mallet(tone, M["dur"], vel, tag, M["bright"], M.get("harmonic", False))
    if v == "blip":
        return I.blip(tone, M["dur"], vel, tag)
    if v == "glide":            # slides from the pattern's previous tone into this one, then swells away
        return I.glide(M["dur"], prev, _semis(prev, tone), tag, M.get("slide", 0.35), M.get("fifth", 0.0), M["bright"]) * np.float32(vel)
    raise ValueError(f"unknown melodic voice {v}")


def score(sheet, P):
    dur, beat = sheet["duration"], 60.0 / P["bpm"]
    bus = Bus(dur, "music")
    secs = sheet["sections"]
    L = P["layers"]
    M = melody_spec(L)
    for i, s in enumerate(secs):
        ch = s.get("chord") or P["progression"][i % len(P["progression"])]
        e = s.get("energy", 0.5)
        last = i == len(secs) - 1
        # the pad overlaps the next section by its release, so chords cross-fade on the cut
        a = s["t0"] - (0.35 if i else 0.0)
        span = s["t1"] - a + (0.0 if last else L["pad"]["release"])
        bus.add(I.pad(ch["pad"], span + (2.5 if last else 0), L["pad"]["bright"], f"pad{i}", L["pad"]["attack"] if i == 0 else 0.5, L["pad"]["release"]), a, L["pad"]["gain"])
        # the melodic layer: the chord's upper tones moved up `octave` (its second tone once more an
        # octave higher), stepping through the pattern
        if M:
            step = beat * M["step"] / 2 if M["double_above"] is not None and e >= M["double_above"] else beat * M["step"]
            tones = [_up(n, M["octave"]) for n in ch["pad"][1:]] + [_up(ch["pad"][1], M["octave"] + 1)]
            pattern = M["pattern"]
            k = math.ceil((s["t0"] + 1e-6) / step)
            while k * step < s["t1"] - (0.0 if last else 0.15) and (not last or k * step < dur - 2.2):
                t = k * step
                n = pattern[k % len(pattern)]
                if n is not None:
                    pos = round(t / beat, 6)
                    vel = (0.62 if pos % 4 == 0 else 0.52 if pos % 1 == 0 else 0.4) * (0.75 + 0.5 * e)
                    prev = pattern[(k - 1) % len(pattern)]
                    prev = tones[(n if prev is None else prev) % len(tones)]
                    bus.add(_melodic(M, tones[n % len(tones)], prev, vel, f"{M['voice']}{i}.{k}"), t, M["gain"], M.get("pan", 0.25) * math.sin(k * 1.7))
                k += 1
        # a heartbeat under the music: on every beat (lub, then dub a fraction of a beat later);
        # notes, beats (offsets in beats) and gains (dB) are parallel lists
        if "pulse" in L and e >= L["pulse"]["above"]:
            H = L["pulse"]
            hits = list(zip(H["notes"], H.get("beats", [0.0] * len(H["notes"])), H.get("gains", [0.0] * len(H["notes"]))))
            k = math.ceil((s["t0"] - 1e-6) / beat)
            while k * beat < s["t1"] - (0.0 if last else 0.05) and (not last or k * beat < dur - 1.0):
                for j, (note, off, g) in enumerate(hits):
                    bus.add(I.thump(note, 0.4, 1.0, f"pulse{i}.{k}.{j}"), (k + off) * beat, H["gain"] + g)
                k += 1
        if e >= L["sub"]["above"]:
            k = math.ceil(s["t0"] / (4 * beat))
            while k * 4 * beat < s["t1"] - 0.2:
                bus.add(I.sub(ch["root"], min(4 * beat, s["t1"] - k * 4 * beat) + 0.3, f"sub{i}.{k}"), k * 4 * beat, L["sub"]["gain"])
                k += 1
    # a drone of fifths held under the whole film (the space channel's bed instead of a piano)
    if "drone" in L:
        D = L["drone"]
        bus.add(I.drone(D["notes"], dur, "drone", D.get("bright", 900.0), D.get("attack", 3.0), D.get("release", 3.0)), 0, D["gain"])
    bus.add(I.air(dur, "air"), 0, L["air"]["gain"])
    return bus.x


# ── foley ─────────────────────────────────────────────────────────────
# Where a sound's moment is, when its foley entry has no "anchor": its attack (onset), its designed
# loudest moment (peak: a whoosh builds into the cut), or its last sample (end: a whistle swells into
# the landing, a glide or a tape ramp arrives).
ANCHOR = {"whoosh": "peak", "whistle": "end", "glide": "end", "ramp": "end"}


def _note(spec, idx, key="notes", default=None):
    """The idx-th note of an entry (the last one repeats), or its single "note"."""
    if key in spec:
        notes = spec[key]
        return notes[min(idx, len(notes) - 1)] if isinstance(notes, list) else notes
    return spec.get("note", default)


def _seq(spec, e, fps):
    """A short phrase (a channel's signature) from {"voice", "notes", "offsets"}: voice is one name or
    one per note; offsets are seconds from the first note (or "frames" instead, at the film's fps);
    "gains" (dB) per note. Any other field goes to every note's voice (an echo, a harmonic)."""
    S = spec["seq"]
    notes = S["notes"]
    voices = S["voice"] if isinstance(S["voice"], list) else [S["voice"]] * len(notes)
    offs = S["offsets"] if "offsets" in S else [f / fps for f in S["frames"]]
    gains = S.get("gains", [0.0] * len(notes))
    rest = {k: v for k, v in S.items() if k not in ("voice", "notes", "offsets", "frames", "gains")}
    parts = []
    for j, (v, note, off, g) in enumerate(zip(voices, notes, offs, gains)):
        sub = {**rest, "voice": v, "notes": [note], "gain": 0.0}
        x = _voice(sub, {"kind": e["kind"], "tag": f"{e.get('tag', e['kind'])}.{j}", "t": e["t"]}, 0, fps)
        parts.append((int(round(off * SR)), x * np.float32(10 ** (g / 20))))
    wide = any(x.ndim == 2 for _, x in parts)
    out = np.zeros((max(a + len(x) for a, x in parts),) + ((2,) if wide else ()), np.float32)
    for a, x in parts:
        out[a:a + len(x)] += stereo(x) if wide else x
    return out


def _voice(spec, e, idx, fps):
    v, tag, kind = spec["voice"], e.get("tag", e["kind"]) + f":{idx}", e["kind"]
    span = max(0.2, e.get("t1", e["t"]) - e["t"])
    if v == "seq":
        return _seq(spec, e, fps)
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
        return I.sparkle(spec.get("dur", span), spec["notes"], tag, grain=spec.get("grain", "bell"))
    if v == "whoosh":
        return I.whoosh(spec.get("dur", 0.8), tag, spec.get("lo", 300), spec.get("hi", 4000))
    # the science channels' voices
    if v == "mallet":
        return I.mallet(_note(spec, idx), spec.get("dur", 0.9), spec.get("vel", 0.8), tag, harmonic=spec.get("harmonic", False))
    if v == "thump":
        return I.thump(_note(spec, idx, default="Eb2"), tag=tag)
    if v == "squish":
        return I.squish(spec.get("dur", span), tag)
    if v == "zap":
        return I.zap(tag)
    if v == "ping":
        echo = spec.get("echo", [0.25, -9.0])
        return I.ping(_note(spec, idx, default=spec.get("f", 1100.0)), tag, (echo[0], echo[1]), spec.get("repeats", 2))
    if v == "glide":
        return I.glide(spec.get("dur", span), spec.get("note", "E3"), spec.get("interval", 19), tag, fifth=spec.get("fifth", 0.0))
    if v == "drone":
        return I.drone(spec["notes"], spec.get("dur", span), tag, attack=min(1.0, span / 3), release=min(1.0, span / 3))
    if v == "blip":
        return I.blip(_note(spec, idx), spec.get("dur", 0.09), spec.get("vel", 0.8), tag)
    if v == "knock":
        return I.knock(_note(spec, idx), spec.get("f0", 200.0), tag)
    if v == "boing":
        return I.boing(_note(spec, idx, default="G3"), tag=tag)
    if v == "shutter":
        return I.shutter(tag, spec.get("gap", 0.035))
    if v == "ramp":
        return I.ramp(spec.get("note", "G3"), spec.get("dur", 0.5), spec.get("dir", "down"), tag)
    if v == "hum":
        return I.hum(spec.get("note", "D4"), spec.get("dur", span), tag, spec.get("beat", 0.5))
    raise ValueError(f"unknown voice {v} for {kind}")


def _anchor(sig, how, voice):
    """The sample of sig that lands on the event's frame (see ANCHOR)."""
    if how == "end":
        return len(sig)
    if how == "peak":
        at = I.PEAK.get(voice)
        return int(at * len(sig)) if at is not None else int(np.argmax(rms_env(sig, 0.01)))
    if how == "onset":
        return onset(sig)
    raise ValueError(f"unknown anchor {how}")


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
    """Returns (effects stem, placed cues). Each sound's anchor lands on its event's frame: its
    onset by default, its peak or its end for sounds that build up to a moment (see ANCHOR). An
    entry with "at": "t1" lands on the frame that shows the event's end instead of its start."""
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
        show = first_frame(e.get("t1", e["t"]) if spec.get("at") == "t1" else e["t"], fps, row.get("after", False))
        lead = row.get("lead", 0.0)
        anchor = _anchor(sig, spec.get("anchor") or ANCHOR.get(spec["voice"], "onset"), spec["voice"])
        t_place = show - lead - anchor / SR
        pan = (e["pos"][0] * 2 - 1) * 0.6 if e.get("pos") else e.get("pan", 0.0)
        bus.add(sig, t_place, spec["gain"] + e.get("gain", 0.0), pan)
        placed.append({"kind": e["kind"], "tag": e.get("tag"), "t": e["t"], "show": round(show, 4), "sound": round(show - lead, 4),
                       "place": round(t_place, 4), "anchor": anchor, "voice": spec["voice"], "gain": spec["gain"], "pan": round(pan, 3), "sig": sig})
        if spec["voice"] == "seq":                          # QA finds a phrase the way it finds its first note
            v = spec["seq"]["voice"]
            placed[-1]["of"] = v[0] if isinstance(v, list) else v
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
        music = music * duck_curve(spans, n, sheet.get("duck_db", P.get("duck_db", -9.0)))[:, None]
        effects = effects * duck_curve(spans, n, -3.0)[:, None]
    # the film ends on its last frame: a short fade so nothing is cut mid-ring
    tail = int(0.6 * SR)
    for x in (music, effects, voice):
        x[-tail:] *= (np.linspace(1, 0, tail, dtype=np.float32) ** 2)[:, None]
    return {"dialog": voice.astype(np.float32), "music": music.astype(np.float32), "effects": effects.astype(np.float32)}, placed, spans
