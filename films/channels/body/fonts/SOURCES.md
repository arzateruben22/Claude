# Fonts: Meanwhile, Inside (body)

Both families are SIL Open Font License 1.1. The font files are the projects' own builds, unmodified
(only renamed to plain file names), and each licence file is the project's own, byte for byte.
Downloaded on 2026-10-22 through the session proxy: GitHub release assets where the project
publishes a release with the file, otherwise the file in the project's repository at a pinned commit
(raw.githubusercontent.com). The GitHub API and github.com pages were blocked, so tags and trees were
read with `git ls-remote` and a blobless clone.

| File | Family, version | Axes | Source | sha256 |
|---|---|---|---|---|
| `Fraunces-VF.woff2` (195,068 B) | Fraunces, Version 1.000 (release `1.000`, built 2020-10-29) | opsz 9–144, wght 100–900, SOFT 0–100, WONK 0–1 | Release asset <https://github.com/undercasetype/Fraunces/releases/download/1.000/UnderCaseType_Fraunces_1.000.zip> (zip sha256 `8d8b81dfaeb89433f5c908e1d8d0a4b202bd627bd80d4cd5ff56f311fdcad19f`), entry `UnderCaseType_Fraunces_1.000/Fonts - Web/Fraunces[SOFT,WONK,opsz,wght].woff2` | `25e420d8c154303e08322ea77f08997c4aade75653ef18425772ada5abacd0ce` |
| `Fraunces-OFL.txt` (4,391 B) | Fraunces licence | | <https://raw.githubusercontent.com/undercasetype/Fraunces/1.000/OFL.txt> (the release zip has no licence file; identical to the one on `main`) | `bdf4c22802eaf804f998195871c6b8938aac2ac14b2d78a8bd66a6f1eced833b` |
| `AtkinsonHyperlegibleNext-VF.woff2` (48,188 B) | Atkinson Hyperlegible Next, Version 2.001 | wght 200–800 | <https://raw.githubusercontent.com/googlefonts/atkinson-hyperlegible-next/7925f50f649b3813257faf2f4c0b381011f434f1/fonts/webfonts/AtkinsonHyperlegibleNext%5Bwght%5D.woff2> (`main` at 7925f50, 2025-02-21; the repo has no releases or tags) | `abde1ad5cf78b9ac575ef90d991f2e9101eb0b3b6668bde9a00e2e1e27d99afd` |
| `AtkinsonHyperlegibleNext-OFL.txt` (4,431 B) | Atkinson Hyperlegible Next licence | | <https://raw.githubusercontent.com/googlefonts/atkinson-hyperlegible-next/7925f50f649b3813257faf2f4c0b381011f434f1/OFL.txt> | `aca6a428580965d2297d1b718042dd427c2a9443ece3b0d02d758e161e0c4030` |

## Notes

- **Only the upright variable faces ship.** One file per family covers every weight the theme uses
  (Fraunces 600 titles; Atkinson 400–700). No italics.
- **Fraunces 144pt SuperSoft SemiBold** is set from the variable file in `theme.json`'s CSS:
  `font-weight: 600; font-variation-settings: "opsz" 144, "SOFT" 100`. Fraunces has proportional
  figures only (no `tnum`), so running counters use Atkinson's tabular figures instead.
- **Fraunces 1.003.** The repository's `main` (7ccdec3, 2025-10-21) carries a newer build,
  `fonts/webfonts/variable/Fraunces[SOFT,WONK,opsz,wght].woff2`, Version 1.003, sha256
  `e6638ea113d0027354a08f957a4068975c8066395a0d0f7bb7861f6409621be3`. It is not used because it has
  no release; 1.000 is the project's only tagged release. Same axes, same glyph count (698).
- **Atkinson Hyperlegible Next** has no subscript figures, so the "₂" in the O₂ and CO₂ label glyphs
  falls back to DejaVu Sans (the film page's system-safe stack). Its licence file names no Reserved
  Font Name, but the original Atkinson Hyperlegible reserves "Atkinson" and "Hyperlegible", so the
  file ships unmodified and unsubset, as the bible asks.
