"""One More Orbit S3 Part 5 cover: the handwritten note + arrow (rotation device 1; P1-P4 had none). The Moon at
70,000 km (5.5x wider than today) over the beach, the figure on the shore; note "the ground|moves?!" in the channel's
hand (Permanent Marker, teal) with an arrow to the sand at the figure's feet. The episode: "The ground moves too ...
more than a hundred sixty times today's tidal pull ... it would flex far more."
usage: p5_cover.py <moon still> <beach still> <PermanentMarker ttf> <hook.py dir> <out dir>"""
import sys
from PIL import Image
MOON, BEACH, MARKER, HOOKDIR, OUT = sys.argv[1:6]
sys.path.insert(0, HOOKDIR); from hook import marks
m = Image.open(MOON).convert("RGB"); b = Image.open(BEACH).convert("RGB")
TOPH = 1640; C = Image.new("RGB", (2160, 3840))
C.paste(b, (0, TOPH))
top = m.crop((0, 0, 2160, TOPH + 400))                       # the Moon's sky, overlapping 400 px into the beach sky
fade = Image.linear_gradient("L").resize((2160, TOPH + 400)).point(lambda v: 255 if v < 255 * TOPH / (TOPH + 400) else int(255 * (1 - (v / 255 - TOPH / (TOPH + 400)) / (400 / (TOPH + 400)))))
C.paste(top, (0, 0), fade)
cv = C.resize((1080, 1920), Image.LANCZOS)
cv = marks(cv, font=MARKER, color="#4FE3C6", note="the ground|moves?!", note_at=(44, 840), note_size=118,
           arrows=[((300, 1075), (402, 1632), -70)], circle=(378, 1668, 74, 26), stroke=10)
cv.save(f"{OUT}/one-more-orbit-s3-part5-cover.jpg", quality=92)
cv.resize((480, 853), Image.LANCZOS).save(f"{OUT}/one-more-orbit-s3-part5-cover-480.jpg", quality=88)
cv.crop((0, 240, 1080, 1680)).save(f"{OUT}/one-more-orbit-s3-part5-cover-grid-3x4.jpg", quality=90)
print("ok")
