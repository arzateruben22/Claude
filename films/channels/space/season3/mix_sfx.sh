#!/bin/bash
# mix_sfx.sh <in.mp4> <film.json (timeline)> <sfx.json> <out.mp4>: the sound-effects stem (kits/cinema/sound/sfx.py) into the film's mix:
# amix normalize=0 -> alimiter -1.5 dB -> gain to -14 LUFS -> alimiter again, 4x oversampled so the AAC can't overshoot (a 12 Nov 2026 Part 1 encode hit +1.3 dBTP); video copied.
set -e; IN=$1; FILM=$2; SFX=$3; OUT=$4; W=$(mktemp -d); SFXPY=${SFXPY:-$(cd "$(dirname "$0")/../../../.." && pwd)/kits/cinema/sound/sfx.py}
python3 -I $SFXPY $FILM $SFX $W/stem.wav > /dev/null
ffmpeg -v error -y -i $IN -i $W/stem.wav -filter_complex "[0:a][1:a]amix=inputs=2:normalize=0:duration=first,alimiter=limit=-1.5dB:level=disabled[a]" -map "[a]" -c:a pcm_s24le $W/mix.wav
I=$(ffmpeg -hide_banner -i $W/mix.wav -af ebur128 -f null - 2>&1 | grep -E "^\s+I:" | tail -1 | awk '{print $2}'); G=$(python3 -c "print(round(-14 - ($I), 2))")
ffmpeg -v error -y -i $IN -i $W/mix.wav -filter_complex "[1:a]volume=${G}dB,aresample=192000,alimiter=limit=-1.5dB:level=disabled:attack=1:release=50,aresample=48000[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 256k -movflags +faststart $OUT
echo "mixed: stem+mix at $I LUFS, gain ${G} dB -> $(ffmpeg -hide_banner -i $OUT -af ebur128 -f null - 2>&1 | grep -E '^\s+I:' | tail -1)"; rm -rf $W
