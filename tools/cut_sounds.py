#!/usr/bin/env python3
"""
Cuts the ball-contact sounds for the game out of a long field recording (a padel practice session) and writes them as short mono WAV
files with the hall noise reduced, plus a report (clips.json) used to write public/assets/audio/sfx/manifest.json.

Usage: python3 tools/cut_sounds.py INPUT.wav OUTDIR
Needs numpy, scipy and ffmpeg. Everything is automatic: onsets are found as sharp rises in the 1.5-10 kHz band, the noise is
estimated from the 0.7 s before each hit (quiet-frame statistics) and subtracted in the STFT domain, then every clip is classified
from its spectrum into racket (strong / soft / spin / serve), floor, glass and mesh. Check the result by ear (public/sounds.html).
"""
import json
import os
import subprocess
import sys
import wave

import numpy as np
from scipy import signal
from scipy.ndimage import median_filter

SR = 48000
OUT_SR = 32000
# how many clips of each kind are kept (the loudest, so the cleanest)
KEEP = {'racket_strong': 6, 'racket_serve': 4, 'racket_spin': 6, 'racket_soft': 6, 'floor': 6, 'glass': 4, 'mesh': 4}


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def find_onsets(x):
    """Ball contacts are sharp clicks with energy up to 14 kHz; voices, steps and hall noise have none. Onsets are the clicks of the
    4-14 kHz band that rise at least 5 times above the local background."""
    h = signal.sosfilt(signal.butter(6, [4000, 14000], 'bp', fs=SR, output='sos'), x)
    hop = 48
    n = len(h) // hop
    env = np.sqrt((h[: n * hop].reshape(n, hop) ** 2).mean(1))
    ratio = env / (median_filter(env, size=200) + 1e-6)
    cand, _ = signal.find_peaks(ratio, height=5.0, distance=40)
    return [(int(c) * hop, float(ratio[c])) for c in cand]


def denoise(before, seg):
    nper, hop = 1024, 256
    hp = signal.butter(4, 200, 'hp', fs=SR, output='sos')
    before, seg = signal.sosfilt(hp, before), signal.sosfilt(hp, seg)
    _, _, N = signal.stft(before, SR, nperseg=nper, noverlap=nper - hop)
    noise = np.percentile(np.abs(N), 30, axis=1)  # quiet-frame level, so other hits in the window do not count
    _, _, S = signal.stft(seg, SR, nperseg=nper, noverlap=nper - hop)
    mag, ph = np.abs(S), np.angle(S)
    clean = np.maximum(mag - 2.2 * noise[:, None], 0.06 * mag)
    _, y = signal.istft(clean * np.exp(1j * ph), SR, nperseg=nper, noverlap=nper - hop)
    return y[: len(seg)]


def features(x, c, click):
    bsos = signal.butter(4, [250, 3000], 'bp', fs=SR, output='sos')
    seg = signal.sosfilt(bsos, x[c - int(0.12 * SR) : c + int(0.25 * SR)])
    env = np.sqrt(np.convolve(seg**2, np.ones(96) / 96, 'same'))
    pre = np.median(env[: int(0.11 * SR)]) + 1e-6
    body = env[int(0.12 * SR) :]
    i0 = int(np.argmax(body[: int(0.03 * SR)]))
    below = np.where(body[i0:] < body[i0] * 0.3)[0]
    decay = (int(below[0]) if len(below) else len(body)) / SR * 1000
    w = x[c : c + int(0.04 * SR)]
    sp = np.abs(np.fft.rfft(w * np.hanning(len(w)))) ** 2
    fr = np.fft.rfftfreq(len(w), 1 / SR)
    m = (fr > 200) & (fr < 3000)
    cen = float((fr[m] * sp[m]).sum() / sp[m].sum())
    low = float(sp[(fr >= 200) & (fr < 700)].sum() / sp[m].sum())
    return dict(click=click, body_gain=float(body[i0] / pre), decay=float(decay), cen=cen, low=low, level=float(np.abs(x[c : c + 1200]).max()))


def clip(x, c):
    a = max(0, c - int(0.012 * SR))
    before = x[max(0, c - int(0.7 * SR)) : max(1, c - int(0.08 * SR))]
    seg = x[a : c + int(0.26 * SR)]
    y = denoise(before, seg)
    onset = c - a
    e = np.sqrt(np.convolve(y**2, np.ones(96) / 96, 'same'))
    i0 = onset + int(np.argmax(e[onset : onset + int(0.04 * SR)]))
    after = e[i0:]
    below = np.where(after < after[0] * 0.12)[0]
    end = i0 + (int(below[0]) if len(below) else len(after))
    end = min(end + int(0.01 * SR), onset + int(0.2 * SR), len(y))
    end = max(end, onset + int(0.06 * SR))
    start = max(0, onset - int(0.004 * SR))
    z = y[start:end].copy()
    z[: int(0.001 * SR)] *= np.linspace(0, 1, int(0.001 * SR))
    f = min(int(0.03 * SR), len(z) // 2)
    z[-f:] *= np.linspace(1, 0, f) ** 2
    z = signal.resample_poly(z, OUT_SR, SR)
    return z, float(np.abs(z).max())


def write_wav(path, z, gain):
    pcm = np.clip(z * gain, -1, 1)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(OUT_SR)
        w.writeframes((pcm * 32767).astype('<i2').tobytes())


def main(src, outdir):
    os.makedirs(outdir, exist_ok=True)
    x = load(src)
    items = []
    for c, click in find_onsets(x):
        if c < int(0.9 * SR) or c + int(0.3 * SR) > len(x):
            continue
        items.append(dict(c=c, t=c / SR, **features(x, c, click)))
    if not items:
        raise SystemExit('no hits found')
    q = lambda k, p: float(np.percentile([i[k] for i in items], p))
    rest = list(items)

    def take(pred):
        got = [i for i in rest if pred(i)]
        for i in got:
            rest.remove(i)
        return got

    # Classification from the spectrum (there is no label in the recording: check it by ear):
    #  floor: a dull thud (most energy below 700 Hz) that is not loud;  glass: rings on (long decay of the body, clear body above the noise);
    #  mesh: a bright, hissy click without much body;  everything else is the racket.
    for i in take(lambda i: i['low'] >= q('low', 70) and i['level'] < q('level', 60)):
        i['kind'] = 'floor'
    for i in take(lambda i: i['decay'] >= q('decay', 78) and i['body_gain'] >= q('body_gain', 40)):
        i['kind'] = 'glass'
    for i in take(lambda i: i['click'] >= q('click', 60) and i['body_gain'] <= q('body_gain', 50)):
        i['kind'] = 'mesh'
    # racket hits, by how hard: the loudest are strong, the quietest soft, in between spin (the longer body = the brush of the strings)
    rest.sort(key=lambda i: -i['level'])
    n = len(rest)
    for r, i in enumerate(rest):
        i['kind'] = 'racket_strong' if r < n * 0.35 else 'racket_soft' if r >= n * 0.7 else 'racket_spin'
    # the serve: the sharpest of the hard hits (an overhead hit cracks)
    hard = sorted([i for i in rest if i['kind'] == 'racket_strong'], key=lambda i: -i['click'])
    for i in hard[: max(2, len(hard) // 3)]:
        i['kind'] = 'racket_serve'
    counts = {}
    for i in items:
        i['file'] = None
    for i in sorted(items, key=lambda i: (i['kind'], -i['level'])):
        k = counts[i['kind']] = counts.get(i['kind'], 0) + 1
        if k > KEEP.get(i['kind'], 6):
            continue
        z, pk = clip(x, i['c'])
        name = f"{i['kind']}_{k:02d}.wav"
        write_wav(os.path.join(outdir, name), z, 0.7 / max(pk, 1e-6))
        i['file'] = name
        i['ms'] = int(1000 * len(z) / OUT_SR)
    with open(os.path.join(outdir, 'clips.json'), 'w') as fh:
        json.dump(sorted([i for i in items if i['file']], key=lambda i: i['file']), fh, indent=1)
    manifest = {}
    for i in items:
        if i['file']:
            manifest.setdefault(i['kind'], []).append(i['file'])
    manifest = {k: sorted(v) for k, v in sorted(manifest.items())}
    manifest['net'] = []
    with open(os.path.join(outdir, 'manifest.json'), 'w') as fh:
        json.dump(manifest, fh, indent=2)
    print({k: min(v, KEEP.get(k, 6)) for k, v in counts.items()}, 'clips kept of', len(items))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
