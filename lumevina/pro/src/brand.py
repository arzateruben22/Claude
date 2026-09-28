"""Lumevina Studio, paper edition: the look every printable shares.

Print is white paper, so the site's noir palette flips: warm ink on white,
a deeper rose that holds up in print, and the brand's original pair of
typefaces (Cormorant Garamond for display, Jost for everything else).
"""
import base64, os

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.normpath(os.path.join(HERE, "..", "..", "fonts"))

INK = "#2a2326"       # warm near-black text
MUTED = "#7a6d72"     # labels, captions
RULE = "#cdbfc4"      # write-on lines
HAIR = "#e7dde0"      # hairlines, table grid
ROSE = "#a86b7e"      # accent: headings, marks (dark enough to print)
BLUSH = "#f7eef1"     # the only fill, used sparingly
GOLD = "#a9855c"      # tiny details

FACES = [("Cormorant Garamond", 400, "normal", "cormorant-garamond-latin-400-normal"),
         ("Cormorant Garamond", 400, "italic", "cormorant-garamond-latin-400-italic"),
         ("Cormorant Garamond", 500, "normal", "cormorant-garamond-latin-500-normal"),
         ("Cormorant Garamond", 500, "italic", "cormorant-garamond-latin-500-italic"),
         ("Cormorant Garamond", 600, "normal", "cormorant-garamond-latin-600-normal"),
         ("Jost", 300, "normal", "jost-latin-300-normal"),
         ("Jost", 400, "normal", "jost-latin-400-normal"),
         ("Jost", 500, "normal", "jost-latin-500-normal")]


def font_css():
    out = []
    for fam, w, st, f in FACES:
        data = base64.b64encode(open(os.path.join(FONTS, f + ".woff2"), "rb").read()).decode()
        out.append('@font-face{font-family:"%s";font-weight:%d;font-style:%s;font-display:block;'
                   'src:url(data:font/woff2;base64,%s) format("woff2")}' % (fam, w, st, data))
    return "\n".join(out)


TOKENS = """
:root{--ink:%s;--muted:%s;--rule:%s;--hair:%s;--rose:%s;--blush:%s;--gold:%s;
--serif:"Cormorant Garamond",Georgia,serif;--sans:"Jost","Helvetica Neue",Arial,sans-serif}
""" % (INK, MUTED, RULE, HAIR, ROSE, BLUSH, GOLD)

# Word files name the same two families. Both are free Google Fonts; the
# Start Here page links them, and Word substitutes something close if they
# aren't installed. Google Docs has both built in.
DOCX_SERIF = "Cormorant Garamond"
DOCX_SANS = "Jost"
