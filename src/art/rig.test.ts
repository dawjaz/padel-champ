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

describe('rig stage C', () => {
  it('a low ball bends the knees and lowers the racket, a high one stretches', async () => {
    const { forHeight } = await import('./rig');
    const low = forHeight(POSES.fhHit, 0.3);
    const high = forHeight(POSES.fhHit, 1.8);
    expect(low.crouch).toBeGreaterThan(POSES.fhHit.crouch);
    expect(low.hand[1]).toBeGreaterThan(POSES.fhHit.hand[1]);
    expect(high.hand[1]).toBeLessThan(POSES.fhHit.hand[1]);
    expect(forHeight(POSES.fhHit, 1)).toBe(POSES.fhHit);
  });
  it('a lunge steps out with the leg on the ball side and keeps it through the stroke', async () => {
    const { lungePose, strokeSteps } = await import('./rig');
    const l = lungePose(POSES.ready, 1, 1);
    expect(l.right[0]).toBeGreaterThan(POSES.ready.right[0] + 20);
    expect(l.crouch).toBeGreaterThan(POSES.ready.crouch + 10);
    expect(l.left[0]).toBeLessThan(POSES.ready.left[0] - 30);
    const steps = strokeSteps('fh', 1, l);
    expect(steps[0][1].right).toEqual(l.right);
    expect(steps[steps.length - 1][1]).toBe(POSES.ready);
  });
  it('the split step lands wide and low', async () => {
    const { splitSteps } = await import('./rig');
    const land = splitSteps()[1][1];
    expect(land.right[0] - land.left[0]).toBeGreaterThan(POSES.ready.right[0] - POSES.ready.left[0]);
  });
});

describe('rig stage D', () => {
  it('reactions end in ready, the sad ones show it on the face', async () => {
    const m = await import('./rig');
    for (const steps of [m.fistSteps(true), m.fistSteps(false), m.highFiveSteps(1), m.highFiveSteps(-1), m.frustrationSteps(), m.disappointSteps(), m.tiredSteps(), m.celebrateSteps(false)]) {
      expect(steps[steps.length - 1][1]).toBe(POSES.ready);
    }
    expect(m.frustrationSteps()[0][1].mood).toBe('sad');
    expect(m.highFiveSteps(1)[0][1].hand[1]).toBeLessThan(60);
    expect(m.highFiveSteps(-1)[0][1].off).not.toBe('grip');
  });
  it('a tired ready is lower with the head down, a fresh one is the plain pose', async () => {
    const m = await import('./rig');
    expect(m.tiredReady(0)).toBe(POSES.ready);
    expect(m.tiredReady(1).crouch).toBeGreaterThan(POSES.ready.crouch);
  });
  it('the head turns towards a look target and stops when told', () => {
    const r = new Rig();
    r.setLook(1);
    for (let t = 16; t < 1000; t += 16) r.update(t, 16);
    expect(r.pose.look).toBeCloseTo(1, 1);
  });
});
