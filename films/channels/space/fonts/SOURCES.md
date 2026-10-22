# Fonts: Light Minute (space)

All three families are SIL Open Font License 1.1. The font files are the projects' own builds,
unmodified (only renamed to plain file names), and each licence file is the project's own, byte for
byte. Downloaded on 2026-10-22 through the session proxy: GitHub release assets where the project
publishes a release with the file, otherwise the file in the project's repository at a pinned commit
(raw.githubusercontent.com). The GitHub API and github.com pages were blocked, so tags and trees were
read with `git ls-remote` and a blobless clone.

| File | Family, version | Axes | Source | sha256 |
|---|---|---|---|---|
| `Unbounded-VF.ttf` (778,272 B) | Unbounded, Version 1.701 | wght 200–900 | <https://raw.githubusercontent.com/googlefonts/unbounded/f3ec43228a864a72487e41552e2140efab9884ea/fonts/variable/Unbounded%5Bwght%5D.ttf> (`main` at f3ec432, 2023-04-12; no releases or tags) | `323b511be380c8d474ef030686b71aedde501f8d9cd46da558b7c40454372c3f` |
| `Unbounded-OFL.txt` (4,392 B) | Unbounded licence | | <https://raw.githubusercontent.com/googlefonts/unbounded/f3ec43228a864a72487e41552e2140efab9884ea/OFL.txt> | `31e5d4e83955e7103c34570dd49b0570ef490800bd65b42923c0dd02445263b3` |
| `Lexend-VF.ttf` (240,288 B) | Lexend, Version 1.008 | wght 100–900, HEXP 0–100 | <https://raw.githubusercontent.com/googlefonts/lexend/7894f02b2e7eabc48595f1d4eff3b17b48c6e651/fonts/lexend/variable/Lexend%5BHEXP,wght%5D.ttf> (`main` at 7894f02, 2023-03-02; no releases or tags) | `e59ed08278bad676e9ee6a4c1761b118775d7ed21e9e87fc3d5fec9721579743` |
| `Lexend-OFL.txt` (4,436 B) | Lexend licence | | <https://raw.githubusercontent.com/googlefonts/lexend/7894f02b2e7eabc48595f1d4eff3b17b48c6e651/OFL.txt> | `5da8505887d0fa7fe963445fd58852707fda34adfeb65af25c99d152bab285bd` |
| `MartianMono-VF.woff2` (83,044 B) | Martian Mono, Version 1.100 (release `v1.1.0`, built 2025-02-11) | wght 100–800, wdth 75–112.5 | Release asset <https://github.com/evilmartians/mono/releases/download/v1.1.0/martian-mono-1.1.0-variable.zip> (zip sha256 `b87730975931dc2dbf0129ecf392ccaf8d29f46bc05e995703da4155db510867`), entry `MartianMonoVF.woff2` | `7cdf8e985a4872246d8c2a19333bcc5e8cbcf512746128823f35c1c43aac238a` |
| `MartianMono-OFL.txt` (4,390 B) | Martian Mono licence | | <https://raw.githubusercontent.com/evilmartians/mono/v1.1.0/OFL.txt> (the release zip has no licence file) | `ddafd2c3f37ef1d83ef284ca63e159befd3820850c5e9eded14ca52eee92c256` |

## Notes

- **TTF where no WOFF2 is published.** Unbounded publishes no WOFF2 at all. Lexend publishes WOFF2
  only for its static weights; the variable font is TTF only. Both ship as the project's TTF rather
  than a WOFF2 converted here, so the bytes stay the project's.
- **Only the upright variable faces ship**: Unbounded 600 titles, Lexend 600 captions and labels,
  Martian Mono 500–700 counters and badges.
- **Martian Mono's default width is 112.5** (its "semi-wide" master). `theme.json`'s CSS sets
  `font-variation-settings: "wdth" 100` (the standard width) and turns its coding ligatures off
  (`no-contextual`) on counters, badges and the scale pill. Measured in Chromium: every digit is the
  same advance, 0.70 em at wdth 100.
- **Unbounded has no µ**, so units stay in Lexend. The label glyphs ● ✦ ◯ are in neither Lexend nor
  Martian Mono and fall back to DejaVu Sans (the film page's system-safe stack).
- **Lexend's HEXP axis** stays at 0 (standard Lexend). "RevReading Lexend" is a Reserved Font Name;
  the file ships unmodified.
- **Why Lexend and Martian Mono:** the cross-check gave Atkinson Hyperlegible Next captions to the
  body channel only, so space takes the fallback its bible names (Lexend) and moves its counters
  from Atkinson Hyperlegible Mono to Martian Mono (DECISIONS.md).
