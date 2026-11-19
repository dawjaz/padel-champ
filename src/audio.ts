import { getSave } from './save';

/**
 * Placeholder 8-bit sound effects: square-wave beeps from the Web Audio API.
 * No audio files needed. Replace with real chiptune (FamiStudio / jsfxr exports) later,
 * keeping the same `sfx(name)` calls so scenes do not change.
 */
export type SfxName = 'select' | 'hit' | 'point' | 'win' | 'lose';

/** [frequency in Hz, duration in ms] */
const NOTES: Record<SfxName, Array<[number, number]>> = {
  select: [[880, 50]],
  hit: [
    [220, 40],
    [330, 40],
  ],
  point: [
    [523, 80],
    [659, 80],
    [784, 120],
  ],
  win: [
    [523, 100],
    [659, 100],
    [784, 100],
    [1047, 250],
  ],
  lose: [
    [392, 150],
    [330, 150],
    [262, 300],
  ],
};

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

export function sfx(name: SfxName): void {
  if (!getSave().settings.sound) return;
  try {
    const c = getContext();
    if (!c) return;
    // Browsers only allow audio after a user gesture; resume on the first tap.
    if (c.state === 'suspended') void c.resume();
    let t = c.currentTime;
    for (const [freq, ms] of NOTES[name]) {
      const dur = ms / 1000;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.setValueAtTime(0, t + dur);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t);
      osc.stop(t + dur + 0.01);
      t += dur;
    }
  } catch {
    // Audio is optional: never let a sound error break the game.
  }
}

// ---------- padel sounds: racket, floor, glass, mesh, net (synthesised, no audio files) ----------

export type ImpactKind = 'racket' | 'floor' | 'glass' | 'mesh' | 'net';

// Real recordings: the files listed in public/assets/audio/sfx/manifest.json are used when there are any (several per kind are
// chosen at random); otherwise the synthesised sounds below play. See docs/ASSETS.md.
const sampleBuffers: Partial<Record<ImpactKind, AudioBuffer[]>> = {};
let samplesRequested = false;

function loadSamples(c: AudioContext): void {
  if (samplesRequested) return;
  samplesRequested = true;
  const base = new URL('assets/audio/sfx/', document.baseURI).href;
  void (async () => {
    try {
      const res = await fetch(`${base}manifest.json`);
      if (!res.ok) return;
      const manifest = (await res.json()) as Partial<Record<ImpactKind, string[]>>;
      for (const kind of Object.keys(manifest) as ImpactKind[]) {
        for (const file of manifest[kind] ?? []) {
          try {
            const data = await (await fetch(base + file)).arrayBuffer();
            const buffer = await c.decodeAudioData(data);
            (sampleBuffers[kind] ??= []).push(buffer);
          } catch {
            // a missing or broken file is skipped
          }
        }
      }
    } catch {
      // no manifest: synthesised sounds only
    }
  })();
}

/** Plays a recording: louder and a little higher for a harder hit, with a small random change so repeats do not sound identical. */
function playSample(c: AudioContext, kind: ImpactKind, power: number): boolean {
  const list = sampleBuffers[kind];
  if (!list || list.length === 0) return false;
  const src = c.createBufferSource();
  src.buffer = list[Math.floor(Math.random() * list.length)];
  src.playbackRate.value = (0.92 + 0.2 * power) * (0.97 + Math.random() * 0.06);
  const g = c.createGain();
  g.gain.value = 0.2 + 0.8 * power;
  src.connect(g);
  g.connect(c.destination);
  src.start();
  return true;
}

let noiseBuffer: AudioBuffer | null = null;

function noise(c: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === c.sampleRate) return noiseBuffer;
  const buf = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noiseBuffer = buf;
  return buf;
}

/** A burst of filtered noise: `freq` is the centre (bandpass) or cut-off, `at` the start in seconds from now. */
function burst(c: AudioContext, at: number, dur: number, vol: number, type: BiquadFilterType, freq: number, q = 1): void {
  const src = c.createBufferSource();
  src.buffer = noise(c);
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  const t = c.currentTime + at;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(c.destination);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

/** A tone that falls (or holds) in pitch and dies away: the body of a thump or the ring of the glass. */
function tone(c: AudioContext, at: number, dur: number, vol: number, from: number, to: number, type: OscillatorType = 'sine'): void {
  const o = c.createOscillator();
  o.type = type;
  const g = c.createGain();
  const t = c.currentTime + at;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/**
 * The sound of the ball touching something. `power` (0..1) is how hard: a smash cracks off the racket and rattles the glass,
 * a soft chiquita is a dull pop and the ball hardly bounces. Each material has its own character:
 *  - racket: a short click of the foam face plus a dull body (higher and cracking when hit hard),
 *  - floor: a soft thud of the sand-filled turf, higher and snappier when the ball comes in fast,
 *  - glass: a thump with a ringing "tonk" that lasts longer the harder it is hit,
 *  - mesh: a metallic rattle of the loose fence,
 *  - net: a dull cord thump.
 */
export function impactSound(kind: ImpactKind, power: number): void {
  if (!getSave().settings.sound) return;
  try {
    const c = getContext();
    if (!c) return;
    if (c.state === 'suspended') void c.resume();
    const p = Math.max(0.05, Math.min(1, power));
    loadSamples(c);
    if (playSample(c, kind, p)) return;
    const jitter = 0.94 + Math.random() * 0.12;
    switch (kind) {
      case 'racket':
        burst(c, 0, 0.018 + 0.03 * p, 0.25 + 0.5 * p, 'bandpass', (1700 + 1800 * p) * jitter, 0.9);
        tone(c, 0, 0.05 + 0.06 * p, 0.2 + 0.4 * p, (170 + 140 * p) * jitter, 90, 'triangle');
        if (p > 0.7) burst(c, 0, 0.07, 0.35 * p, 'highpass', 3500, 0.7);
        break;
      case 'floor':
        tone(c, 0, 0.06, 0.12 + 0.4 * p, (120 + 90 * p) * jitter, 60);
        burst(c, 0, 0.03 + 0.02 * p, 0.05 + 0.25 * p, 'lowpass', 700 + 800 * p);
        if (p > 0.5) burst(c, 0, 0.012, 0.15 * p, 'bandpass', 2400, 1.2);
        break;
      case 'glass':
        tone(c, 0, 0.07, 0.15 + 0.45 * p, 100 * jitter, 55);
        burst(c, 0, 0.025, 0.1 + 0.3 * p, 'bandpass', 1300 * jitter, 1);
        for (const [f, d, v] of [[520, 0.2, 0.1], [790, 0.28, 0.07], [1240, 0.16, 0.05]] as const) {
          tone(c, 0.004, d * (0.5 + p), v * (0.3 + p), f * jitter, f * 0.97);
        }
        break;
      case 'mesh':
        for (let i = 0; i < 4 + Math.round(4 * p); i++) {
          burst(c, i * (0.008 + Math.random() * 0.01), 0.03 + 0.02 * p, (0.1 + 0.2 * p) * (1 - i * 0.08), 'highpass', 2600 + Math.random() * 1500, 1.5);
        }
        tone(c, 0, 0.2 + 0.2 * p, 0.04 + 0.06 * p, 1400 * jitter, 1250, 'triangle');
        tone(c, 0.01, 0.15 + 0.15 * p, 0.03 + 0.05 * p, 2150 * jitter, 2000, 'triangle');
        break;
      case 'net':
        burst(c, 0, 0.09, 0.1 + 0.25 * p, 'lowpass', 520);
        tone(c, 0, 0.08, 0.1 + 0.2 * p, 130, 80);
        break;
    }
  } catch {
    // Audio is optional: never let a sound error break the game.
  }
}
