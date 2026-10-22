# Fonts: Rest Frame (physics)

All three families are SIL Open Font License 1.1. The font files are the projects' own builds,
unmodified (only renamed to plain file names), and each licence file is the project's own, byte for
byte. Downloaded on 2026-10-22 through the session proxy: GitHub release assets where the project
publishes a release with the file, otherwise the file in the project's repository at a pinned commit
(raw.githubusercontent.com). The GitHub API and github.com pages were blocked, so tags and trees were
read with `git ls-remote` and a blobless clone.

| File | Family, version | Axes | Source | sha256 |
|---|---|---|---|---|
| `Archivo-VF.ttf` (658,596 B) | Archivo, Version 2.001 | wght 100–900, wdth 62–125 | <https://raw.githubusercontent.com/Omnibus-Type/Archivo/211127690e8ff106c36c935f7e5e697114cff103/fonts/variable/Archivo%5Bwdth,wght%5D.ttf> (`main` at 2111276, 2026-09-02; no releases or tags) | `664bbeb10522dac35c174a3860aaecad7b1ad3a0fc8b0d26888e26c824ec556d` |
| `Archivo-OFL.txt` (4,388 B) | Archivo licence | | <https://raw.githubusercontent.com/Omnibus-Type/Archivo/211127690e8ff106c36c935f7e5e697114cff103/OFL.txt> | `108b4e57c9c796d3d38d0428ca7ee39de47ad93187302718d9b2d8864b9b716b` |
| `IBMPlexSans-VF.woff2` (230,368 B) | IBM Plex Sans Var, Version 3.000 (release `@ibm/plex-sans-variable@0.2.0`, built 2025-06-16) | wght 100–700, wdth 85–100 | Release asset <https://github.com/IBM/plex/releases/download/%40ibm%2Fplex-sans-variable%400.2.0/plex-sans-variable.zip> (zip sha256 `f83825d527be6cd39c8971c932b9bf22688a3ad3e5ac6305b6143d02f52b87b6`), entry `fonts/complete/woff2/IBM Plex Sans Var-Roman.woff2`; byte-identical to `packages/plex-sans-variable/fonts/complete/woff2/IBM Plex Sans Var-Roman.woff2` at the tag (ceee82f) | `e978248b6b56da9e372975322a98dd9a51135d1b375e32ed6d5ca69f3aab792d` |
| `IBMPlexSans-LICENSE.txt` (4,456 B) | IBM Plex licence | | <https://raw.githubusercontent.com/IBM/plex/ceee82fa88781b8310b198fd302480efaeac609e/packages/plex-sans-variable/LICENSE.txt> (the release zip has no licence file) | `7e6b2818edbd8f6a01ae80641cc8f16a51080d08fb4e532be3a0b6f74adb07da` |
| `IBMPlexMono-VF.woff2` (83,488 B) | IBM Plex Mono Var, Version 1.000 (release `@ibm/plex-mono-variable@1.0.0`, built 2026-04-20) | wght 100–700 | Release asset <https://github.com/IBM/plex/releases/download/%40ibm%2Fplex-mono-variable%401.0.0/plex-mono-variable.zip> (zip sha256 `46bbde4aeab959180ebad197f5b841c6bb5c8070146ba02c31240556e1e0b40d`), entry `fonts/complete/woff2/IBM Plex Mono Var-Roman.woff2`; byte-identical to the file in `packages/plex-mono-variable` at the tag (bf26009) | `ef55d69e81baa6523a9b6e015d746e707bc7e9579f18703a169cb18c36dd567b` |
| `IBMPlexMono-LICENSE.txt` (4,456 B) | IBM Plex licence | | <https://raw.githubusercontent.com/IBM/plex/bf260093582f04622aacc1e9f9ca604d7ccd0c42/packages/plex-mono-variable/LICENSE.txt> (identical to the Sans one) | `7e6b2818edbd8f6a01ae80641cc8f16a51080d08fb4e532be3a0b6f74adb07da` |

## Notes

- **Archivo ships as TTF**: the project publishes its variable font only as TTF (its WOFF2 files
  are static weights and widths). The variable file is needed for the width axis: the title is set
  ExtraBold Expanded (`font-weight: 800; font-variation-settings: "wdth" 125`) and the title card
  squashes the width on each contact.
- **IBM Plex variable packages.** IBM now publishes Plex per package. The variable Sans
  (`@ibm/plex-sans-variable@0.2.0`) and the variable Mono (`@ibm/plex-mono-variable@1.0.0`) are the
  latest releases of each; one file per family covers every weight used (Sans 400–700, Mono
  500–700). The static packages (`@ibm/plex-sans@1.1.0`, `@ibm/plex-mono@2.5.0`) were not needed.
  The CSS family names are "IBM Plex Sans" and "IBM Plex Mono"; the files' own names are
  "IBM Plex Sans Var" and "IBM Plex Mono Var" and are left as they are.
- **"Plex" is a Reserved Font Name**: the files ship unmodified and unsubset.
- Plex figures are tabular by default (every digit 0.60 em), so counters never jitter.
