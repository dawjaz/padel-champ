import { describe, expect, it } from 'vitest';
import { POSES } from './toon/character';
import { HIT_STOP, Rig, loadPose, poseSignature, racketEnds, smashSteps, strokeSteps } from './rig';

describe('rig', () => {
  it('glides to a pose and stays there', () => {
    const r = new Rig();
    r.to(0, POSES.fhPrep, 100);
    const mid = r.update(50, 16);
    expect(mid.hand[0]).toBeGreaterThan(POSES.ready.hand[0]);
    expect(mid.hand[0]).toBeLessThan(POSES.fhPrep.hand[0]);
    r.update(200, 16);
    expect(r.pose.hand).toEqual(POSES.fhPrep.hand);
    expect(r.playing(300)).toBe(false);
  });
  it('a stroke holds the hit pose for the hit-stop, overshoots and ends in ready', () => {
    const r = new Rig(loadPose('fhPrep'));
    r.play(0, strokeSteps('fh'));
    r.update(60, 16);
    expect(r.pose.racket).toBe(POSES.fhHit.racket);
    r.update(60 + HIT_STOP, 16);
    expect(r.pose.racket).toBe(POSES.fhHit.racket);
    let t = 60 + HIT_STOP;
    while (t < 2000) r.update((t += 16), 16);
    expect(r.pose.hand).toEqual(POSES.ready.hand);
  });
  it('the smash takes off from the left leg: right knee up in the air, left foot lands first', () => {
    const steps = smashSteps(300);
    const air = steps[0][1];
    expect(air.right[1]).toBeLessThan(air.left[1]);
    const land = steps[3][1];
    expect(land.left[1]).toBeGreaterThan(land.right[1]);
    expect(loadPose('smashPrep').right[1]).toBeLessThan(loadPose('smashPrep').left[1]);
  });
  it('drives a changing pose smoothly and ends drive with a glide', () => {
    const r = new Rig();
    r.drive(POSES.runA);
    const first = r.update(16, 16);
    expect(first.hand).not.toEqual(POSES.runA.hand);
    for (let t = 32; t < 600; t += 16) r.update(t, 16);
    expect(Math.abs(r.pose.hand[0] - POSES.runA.hand[0])).toBeLessThan(0.5);
  });
  it('signatures and racket ends', () => {
    expect(poseSignature(POSES.ready)).toBe(poseSignature({ ...POSES.ready }));
    expect(poseSignature(POSES.ready)).not.toBe(poseSignature(POSES.fhHit));
    const [near, far] = racketEnds({ ...POSES.ready, racket: 0, lean: 0, crouch: 0 });
    expect(near[0]).toBeCloseTo(far[0]);
    expect(far[1]).toBeLessThan(near[1]);
  });
});
