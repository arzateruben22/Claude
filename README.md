# Skin Sense Season 3 masters (v2)
Files over 100 MB, split with `split -b 90m -d -a 2` (`name.mp4.part00`, `.part01`, ...), with the SHA256 of the whole file in `name.mp4.SHA256`.
Rejoin: `cat name.mp4.part* > name.mp4 && sha256sum -c name.mp4.SHA256`.
Git keeps a capped preview of the 1080 file on the working branch (claude/outer-layer-s1-b).
