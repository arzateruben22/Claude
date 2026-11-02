# Fonts (self-hosted, SIL OFL 1.1)

From the Fontsource npm packages (5.3.0), latin subsets, downloaded 2026-10-24.

| File | Family | Package | sha256 |
|---|---|---|---|
| BricolageGrotesque-VF.woff2 | BricolageGrotesque | @fontsource | `a97804dc9fbe5fc9…` |
| InstrumentSerif-Italic.woff2 | InstrumentSerif | @fontsource | `5a51946dfffa8297…` |
| InstrumentSerif-Regular.woff2 | InstrumentSerif | @fontsource | `5eb09b5ac0e28b67…` |
| JetBrainsMono-Medium.woff2 | JetBrainsMono | @fontsource | `cb182feeed4d798f…` |

## The two new channels (added 2026-11-02)

Converted to WOFF2 here (fontTools `pyftsubset`, Latin subset plus a few symbols: arrows, ≈, ≤ ≥, −, ×, all
layout features kept, variable axes kept) from the channels' own unmodified TTFs, which came from `google/fonts` at
commit `ddf386ba1b9fbc6b2c818f1ddcd9148f54ced94b` (see `films/channels/*/fonts/SOURCES.md` on the channel branches).
Each licence file is the family's own OFL.txt, unchanged.

| File | Family, axes | From | sha256 (start) |
|---|---|---|---|
| Newsreader-VF.woff2 | Newsreader, wght 200–800, opsz 6–72 (Outer Layer display) | `claude/outer-layer-s1`: `films/channels/skincare/fonts/Newsreader-VF.ttf` | `ec7e9c14e855e022…` |
| RedHatText-VF.woff2 | Red Hat Text, wght 300–700 (Outer Layer text) | `claude/outer-layer-s1`: `films/channels/skincare/fonts/RedHatText-VF.ttf` | `f1c2f79007989623…` |
| Figtree-VF.woff2 | Figtree, wght 300–900 (Back of the Envelope text) | `claude/back-of-the-envelope-s1`: `films/channels/whatif/fonts/Figtree-VF.ttf` | `0710212a3770b2c1…` |

Back of the Envelope's display face (Bricolage Grotesque) and its figures (JetBrains Mono) are the files above.
