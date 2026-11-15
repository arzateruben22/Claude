# Season 3 v2 inputs (for a second worker)
- `evelyn-s3-clean.flac`: clarity.py output (`--noise 0.2-2.9 --style whisper`) of evelyn-s3-full.m4a. Restore the pipeline's working copy with:
  `mkdir -p ep13/work/clarity && ffmpeg -i voice-evelyn/evelyn-s3-clean.flac -c:a pcm_s24le ep13/work/clarity/clean.wav`
- `full_words.json`: Parakeet word times of the whole recording (copy to `ep13/work/full_words.json`; set/s3_cut.py reads it).
- Then per episode: `s3_cut.py epNN v2`, `align.py epNNv2/vo` and `epNNv2/vo/yt`, `s3_duck.py epNN`, `s3_v2.py epNN`, `s3_caps.py epNNv2`, render with `--size 1440x2560 --speed 1.2`.
