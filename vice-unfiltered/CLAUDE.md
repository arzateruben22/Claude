# Vice Unfiltered — production workspace

This folder is the Vice Unfiltered short-form clipping studio. It is unrelated to the
OC game guidelines in the repository root `CLAUDE.md`.

- `CLAUDE_MASTER_PROMPT.md` is the production specification for every video and thumbnail. Read it in full before any job.
- `README.md` explains the folder layout, file naming and the job flow.
- `assets/ASSET_INVENTORY.csv` is the verified list of what we actually have (SHA-256 checked against `ASSET_MANIFEST.csv`). Never reference an asset that is not in it.
- Run `python3 -I tools/qc.py <export.mp4> <out_dir> --at <times>` on every export and look at the frames before calling anything finished.
