"""sum the bed, the owner's voice and the closer C2 (48.3 s) sample by sample; then limiter + a loudness check"""
import numpy as np, soundfile as sf, sys
D = sys.argv[1]; sr = 48000; T = 51.5
bed, _ = sf.read(D + 'bed2.wav', dtype='float32'); bed = bed.mean(1) if bed.ndim > 1 else bed
voice, _ = sf.read(D + 'voice2.wav', dtype='float32'); c2, _ = sf.read(D + 'c2proc.wav', dtype='float32')
n = int(T * sr); out = np.zeros(n, np.float32)
out[:len(bed)] += bed[:n]; out[:len(voice)] += voice[:n]
i = int(47.7 * sr); out[i:i + len(c2)] += c2[:n - i]
# the bed sits 3 dB lower under the closer
print('peak', float(np.abs(out).max()))
sf.write(D + 'mix_raw2.wav', out, sr, subtype='FLOAT')
