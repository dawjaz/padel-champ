import { describe, expect, it } from 'vitest';
import {
  defenderIndex,
  formationZ,
  indexOfLane,
  laneSign,
  laneX,
  landingX,
  LANE_X,
  restPos,
  serveLane,
  serveSetup,
} from './court';
import { fixedRng } from './rng';

describe('lanes', () => {
  it('puts index 0 on the left and index 1 on the right', () => {
    expect(laneSign(0)).toBe(-1);
    expect(laneSign(1)).toBe(1);
    expect(laneX(0)).toBe(-LANE_X);
    expect(laneX(1)).toBe(LANE_X);
    expect(indexOfLane(-1)).toBe(0);
    expect(indexOfLane(1)).toBe(1);
  });
});

describe('defenderIndex', () => {
  it('sends parallel balls to the same lane and cross balls to the other', () => {
    expect(defenderIndex(0, 'parallel', fixedRng([0.5]))).toBe(0);
    expect(defenderIndex(1, 'parallel', fixedRng([0.5]))).toBe(1);
    expect(defenderIndex(0, 'cross', fixedRng([0.5]))).toBe(1);
    expect(defenderIndex(1, 'cross', fixedRng([0.5]))).toBe(0);
  });

  it('picks either player for a middle ball', () => {
    expect(defenderIndex(0, 'middle', fixedRng([0.1]))).toBe(0);
    expect(defenderIndex(0, 'middle', fixedRng([0.9]))).toBe(1);
  });
});

describe('landingX', () => {
  it('lands parallel balls near the glass, middle balls near the centre', () => {
    expect(Math.abs(landingX('parallel', 1))).toBeGreaterThan(Math.abs(landingX('cross', 1)));
    expect(Math.abs(landingX('middle', 0))).toBeLessThan(1);
    expect(landingX('cross', 0)).toBeLessThan(0);
    expect(landingX('cross', 1)).toBeGreaterThan(0);
  });
});

describe('serve', () => {
  it('serves the first point from the left, then alternates every point', () => {
    expect(serveLane(0, 0)).toBe(-1);
    expect(serveLane(0, 1)).toBe(1);
    expect(serveLane(0, 2)).toBe(-1);
    // the far team looks down the screen: its left is +x
    expect(serveLane(1, 0)).toBe(1);
    expect(serveLane(1, 1)).toBe(-1);
  });

  it('always serves cross: the receiver stands in the opposite lane', () => {
    for (const side of [0, 1] as const) {
      for (let points = 0; points < 4; points++) {
        const s = serveSetup(side, points);
        expect(Math.sign(s.receiver.x)).toBe(-Math.sign(s.server.x));
        expect(s.receiverIdx).toBe(indexOfLane(-s.lane as -1 | 1));
        expect(Math.sign(s.receiverPartner.x)).toBe(-Math.sign(s.receiver.x));
      }
    }
  });

  it("stands the server's partner in the middle of their own quarter (the lane the server is not in)", () => {
    for (const points of [0, 1]) {
      const near = serveSetup(0, points);
      expect(near.partner.x).toBe(-near.lane * 2.5);
      expect(near.partner.z).toBe(15);
      const far = serveSetup(1, points);
      expect(far.partner.x).toBe(-far.lane * 2.5);
      expect(far.partner.z).toBe(5);
      expect(Math.sign(near.partner.x)).toBe(-Math.sign(near.server.x));
    }
  });

  it('keeps everybody on their own half of the court', () => {
    const s = serveSetup(0, 0);
    expect(s.server.z).toBeGreaterThan(10);
    expect(s.partner.z).toBeGreaterThan(10);
    expect(s.receiver.z).toBeLessThan(10);
    expect(s.receiverPartner.z).toBeLessThan(10);
  });
});

describe('formations', () => {
  it('puts the net formation closer to the net than the back formation, on both ends', () => {
    expect(Math.abs(formationZ(0, 'net') - 10)).toBeLessThan(Math.abs(formationZ(0, 'back') - 10));
    expect(Math.abs(formationZ(1, 'net') - 10)).toBeLessThan(Math.abs(formationZ(1, 'back') - 10));
    expect(formationZ(0, 'net')).toBeGreaterThan(10);
    expect(formationZ(1, 'net')).toBeLessThan(10);
  });

  it('places rest positions in the player lane', () => {
    expect(restPos(0, 1, 'net')).toEqual({ x: LANE_X, z: formationZ(0, 'net') });
    expect(restPos(1, 0, 'back')).toEqual({ x: -LANE_X, z: formationZ(1, 'back') });
  });
});
