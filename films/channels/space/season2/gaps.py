"""Voiceless gaps in an episode's mixed dialogue stem: python3 -I gaps.py <epdir> [min_gap_s]
Lists every stretch with no speech longer than min_gap_s (default 1.0), measured on build/audio/stems/dialog.wav."""
import subprocess, sys, re
ep = sys.argv[1]; mn = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
r = subprocess.run(["ffmpeg", "-hide_banner", "-i", f"{ep}/build/audio/stems/dialog.wav", "-af", f"silencedetect=n=-42dB:d={mn}", "-f", "null", "-"], capture_output=True, text=True).stderr
st = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", r)]; en = re.findall(r"silence_end: ([\d.]+) \| silence_duration: ([\d.]+)", r)
for a, (b, d) in zip(st, en): print(f"{a:6.2f} - {float(b):6.2f}  ({float(d):.2f} s)")
if len(st) > len(en): print(f"{st[-1]:6.2f} - end")
