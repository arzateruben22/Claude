# Kit changes made while building episodes 2–6

Every change to `kits/` made for this channel, with why and how it stays backward compatible
(no change in output for any existing episode). New reusable blocks for this channel go in
`films/channels/body/set/` instead and are listed in each episode's README.

| Date | File | Change | Backward compatibility |
|---|---|---|---|
| 26 Oct | `kits/cinema/script/timeline.py` | `Film.captions(..., balance=False, keep=())`: an opt-in balanced pager. With `balance=True` a sentence that needs several pages is split by a search over every set of cut points (not the greedy longest head): a page or row ending on a weak word (an article most) costs, a page under 10 characters costs, a cut after a comma is preferred, `keep` phrases ("multiple sclerosis", "Julius Cohnheim") cost the most to split, and an extra page costs less than a split phrase. It ends the one-word tails ("timed.", "it.") that flashed for under a second. Episodes 2–6 pass `balance=True` and their own `keep` list | Opt-in: the defaults take the old path unchanged. Checked: episodes 1 and 2's caption pages from the default call are byte-identical to their compiled `film.json` |
