"""Make a real voice recording as clear as it can be, without changing the voice.

    python3 -I kits/cinema/voice/clarity.py in.(m4a|wav) out.wav [--noise 0.2-2.9] [--style whisper|normal]

For phone voice memos (AAC around 64 kbps, nothing above 16 kHz, rumble, the odd clipped peak). Restoration only:
no resynthesis and no voice model, so the speaker's voice stays theirs (never clone a real person's voice).

Chain, in order:
  1. stationary noise reduction, profiled on a stretch of room tone (--noise, seconds; default 0.2-2.9)
  2. declip, then an 80 Hz high-pass (rumble and handling noise)
  3. EQ: -2.5 dB at 220 Hz (mud), +2 dB at 4.5 kHz (presence), +2.5 dB shelf from 9 kHz (air)
  4. a light harmonic exciter from 9 kHz, which restores some air above the memo's 16 kHz cut-off
  5. de-esser, gentle 2:1 compression
  6. whisper style only: a soft downward expander that lowers breaths and gaps by up to about 15 dB (never a hard gate)
  7. loudness to -16 LUFS / -1.5 dBTP (the ASMR target; the mix sets the final level)

Measured on Evelyn's S3 recording (11 Nov 2026): noise floor -65 to -90 dB, clipped peaks repaired, and the speech
recogniser got more words right afterwards ("two soft steps", "your muscles begin to tremble"), so clarity rose.
Breath ducking with word alignment (duck only between aligned words) is better still: apply it on top, on the stems.
For a QUIET whisper (the owner's PL reading: -43 dB RMS, mostly unvoiced) use --style normal: the expander can swallow
soft words ("Here are the rules" was lost with it, kept without it), so duck breaths only by word alignment.

Needs: ffmpeg, and `pip install numpy soundfile noisereduce` (pure Python and numpy; no GPU).
"""
import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

CHAIN_COMMON = ("adeclip=threshold=10,highpass=f=80:poles=2,"
                "equalizer=f=220:t=q:w=1.0:g=-2.5,equalizer=f=4500:t=q:w=1.2:g=2,highshelf=f=9000:g=2.5,"
                "aexciter=level_in=1:level_out=1:amount=1.2:drive=6:blend=0:freq=9000:ceil=20000:listen=0,"
                "deesser=i=0.35:m=0.5:f=0.5,acompressor=threshold=-30dB:ratio=2:attack=8:release=180:makeup=2")
EXPANDER = "agate=threshold=0.008:ratio=2:range=0.18:attack=15:release=220:knee=4"
LOUDNESS = "loudnorm=I=-16:TP=-1.5:LRA=9"


def run(cmd):
    subprocess.run(cmd, check=True)


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--noise", default="0.2-2.9", help="room-tone span in seconds, e.g. 0.2-2.9")
    ap.add_argument("--style", choices=["whisper", "normal"], default="whisper")
    a = ap.parse_args(argv)
    import numpy as np
    import noisereduce as nr
    import soundfile as sf

    n0, n1 = (float(v) for v in a.noise.split("-"))
    with tempfile.TemporaryDirectory() as td:
        raw, den = Path(td) / "raw.wav", Path(td) / "den.wav"
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", a.src, "-ac", "1", "-ar", "48000", "-c:a", "pcm_f32le", "-y", str(raw)])
        x, sr = sf.read(raw, dtype="float32")
        # pre-level to about -26 LUFS so the compressor and the breath expander see the same level for a quiet
        # whisper as for a loud memo (a -43 dB whisper would otherwise sit at the expander's threshold)
        r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(raw), "-af", "ebur128", "-f", "null", "-"],
                           capture_output=True, text=True)
        lufs = [float(l.split()[1]) for l in r.stderr.splitlines() if l.strip().startswith("I:") and "LUFS" in l]
        if lufs and lufs[-1] > -70:
            x = x * np.float32(10 ** ((-26.0 - lufs[-1]) / 20))
            x = np.clip(x, -1.0, 1.0)
        noise = x[int(n0 * sr):int(n1 * sr)]
        if len(noise) < sr // 2:
            sys.exit("room-tone span is under 0.5 s: pass --noise with a longer silent stretch")
        if float(np.abs(noise).max()) < 1e-6:
            y = x   # the room tone is digital silence (the recorder gated it): nothing to profile, skip the denoiser
        else:
            y = nr.reduce_noise(y=x, sr=sr, y_noise=noise, stationary=True, prop_decrease=0.75,
                                n_std_thresh_stationary=1.5, freq_mask_smooth_hz=300, time_mask_smooth_ms=60)
        sf.write(den, np.asarray(y, dtype="float32"), sr, subtype="FLOAT")
        chain = ",".join([CHAIN_COMMON] + ([EXPANDER] if a.style == "whisper" else []) + [LOUDNESS])
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(den), "-af", chain, "-ar", "48000", "-c:a", "pcm_s24le", "-y", a.dst])
    print("wrote", a.dst)


if __name__ == "__main__":
    main(sys.argv[1:])
