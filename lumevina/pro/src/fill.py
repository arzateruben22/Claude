"""Make a printed PDF fillable: a form field on every write-on line, box and checkbox.

The boxes come from render.cjs, which measured each spot in the page's layout,
so the fields sit exactly on the printed lines. Works in Adobe Acrobat and
Reader, Apple Preview, iPad Files/Markup and most browsers.
"""
import json

import pymupdf

INK = (0.165, 0.137, 0.149)


def make_fillable(pdf_path, fields_path, out_path):
    doc = pymupdf.open(pdf_path)
    fields = json.load(open(fields_path))
    seen = set()
    for f in fields:
        name = f["name"]
        if name in seen:            # every field name must be unique in a PDF form
            n = 2
            while "%s_%d" % (name, n) in seen:
                n += 1
            name = "%s_%d" % (name, n)
        seen.add(name)
        page = doc[f["page"]]
        x, y, w, h = f["x"], f["y"], f["w"], f["h"]
        wd = pymupdf.Widget()
        wd.field_name = name
        wd.border_width = 0
        wd.border_color = None
        wd.fill_color = None
        wd.text_color = INK
        wd.text_font = "Helv"
        if f["type"] == "check":
            wd.field_type = pymupdf.PDF_WIDGET_TYPE_CHECKBOX
            pad = 0.6
            wd.rect = pymupdf.Rect(x + pad, y + pad, x + w - pad, y + h - pad)
            wd.field_value = False
        elif f["type"] == "multi":
            wd.field_type = pymupdf.PDF_WIDGET_TYPE_TEXT
            wd.field_flags = pymupdf.PDF_TX_FIELD_IS_MULTILINE
            wd.rect = pymupdf.Rect(x, y + 2, x + w, y + h - 1)
            wd.text_fontsize = 9
        else:
            # text lines: the field fills the space just above the rule
            wd.field_type = pymupdf.PDF_WIDGET_TYPE_TEXT
            top = y + max(0, h - 14)
            wd.rect = pymupdf.Rect(x + 1, top, x + w - 1, y + h - 0.8)
            wd.text_fontsize = 0 if f["type"] == "text" else 8
        page.add_widget(wd)
    doc.save(out_path, garbage=3, deflate=True)
    doc.close()
    return len(seen)
