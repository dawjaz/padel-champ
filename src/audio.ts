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
