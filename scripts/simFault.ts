// Serve faults: speed of the ball before and after its first wall contact, and when it reaches the net.
import { SHOTS } from '../src/game/catalog';
import { buildCoast, buildFlight } from '../src/art/ballPath';
import type { ErrorKind } from '../src/game/types';

const KINDS: ErrorKind[] = ['net', 'glass', 'side', 'long', 'bouncemesh'];
const serves = SHOTS.filter((s) => s.kind === 'serve');
const sp = (a: { t: number; x: number; z: number; h: number }, b: typeof a): number => Math.hypot(b.x - a.x, b.z - a.z, b.h - a.h) / (b.t - a.t);
for (const s of serves) {
  for (const k of KINDS) {
    let worst = 0;
    let worstNet = 0;
    let wallIn = 0;
    let wallOut = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const landX = s.landX ?? 3;
      const f = buildFlight({ from: { x: -2.5, z: 18.5 }, startH: 0.9, hitterSide: 0, shot: s, landX, outcome: 'fault', errorKind: k, seed, receive: 'bounce' });
      const n = f.path.length;
      const vIn = sp(f.path[n - 2], f.path[n - 1]);
      const c = buildCoast(f, 0.5);
      let maxAfter = 0;
      for (let i = 1; i < c.path.length; i++) maxAfter = Math.max(maxAfter, sp(c.path[i - 1], c.path[i]));
      const net = c.events.find((e) => e.kind === 'net');
      let netV = 0;
      if (net) {
        const i = c.path.findIndex((p) => p.t >= net.t);
        if (i > 0) netV = sp(c.path[i - 1], c.path[i]);
      }
      wallIn = Math.max(wallIn, vIn);
      wallOut = Math.max(wallOut, maxAfter);
      worst = Math.max(worst, maxAfter / Math.max(vIn, 1));
      worstNet = Math.max(worstNet, netV);
    }
    console.log(`${s.id.padEnd(12)} ${k.padEnd(10)} end-of-flight ${wallIn.toFixed(1).padStart(5)} m/s  max after ${wallOut.toFixed(1).padStart(5)}  ratio ${worst.toFixed(2)}  net hit ${worstNet.toFixed(1)}`);
  }
}
