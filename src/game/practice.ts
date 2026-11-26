import type { PointState } from './point';
import type { Formation, Height, SideIndex } from './types';

/**
 * The practice court: ready-made situations to play one shot from, again and again (no score, no career). Each rally situation is a
 * ball and the positions of both pairs; the engine's own rules decide which shots can be played from it, as in a match.
 */
export type SituationId = 'short_lob' | 'mid_lob' | 'deep_lob' | 'off_glass' | 'net' | 'side_wall' | 'serve' | 'return' | 'runout';

/** The ball and positions of a practice exercise (the Free Practice SETUP uses the same fields). */
export interface PracticeSetup {
  ball: Height;
  /** The ball comes off the glass. */
  glass: boolean;
  /** A short lob near the net: the one to smash out of the court. */
  weakLob: boolean;
  me: Formation;
  opp: Formation;
  /** The ball has bounced (not played out of the air). */
  bounced: boolean;
  /** A hard, fast ball (a block at the net). */
  hard: boolean;
  /** It comes down by a side wall (contrapared). */
  atWall: boolean;
}

export interface Situation {
  id: SituationId;
  /** Button label (short, upper case). */
  label: string;
  /** One line under the court: what the ball is. */
  desc: string;
  kind: 'rally' | 'serve' | 'return' | 'runout';
  setup?: PracticeSetup;
  /** The shots this situation is there to practise (they must be playable from it; tested). */
  signature: string[];
}

const base: PracticeSetup = { ball: 'mid', glass: false, weakLob: false, me: 'back', opp: 'back', bounced: false, hard: false, atWall: false };

export const SITUATIONS: Situation[] = [
  {
    id: 'short_lob',
    label: 'SHORT LOB',
    desc: 'A short lob near the net: smash it out (Por Tres, Por Cuatro) or play a vibora.',
    kind: 'rally',
    setup: { ...base, ball: 'high', weakLob: true, me: 'mid' },
    signature: ['smash_x3', 'smash_x4', 'vibora', 'bandeja'],
  },
  {
    id: 'mid_lob',
    label: 'MID LOB',
    desc: 'A lob to mid-court, out of the air: vibora or bandeja.',
    kind: 'rally',
    setup: { ...base, ball: 'high', me: 'mid' },
    signature: ['vibora', 'bandeja'],
  },
  {
    id: 'deep_lob',
    label: 'DEEP LOB',
    desc: 'A deep lob that comes off the back glass high: the bajada.',
    kind: 'rally',
    setup: { ...base, ball: 'high', glass: true },
    signature: ['bajada_fast', 'bajada_slow'],
  },
  {
    id: 'off_glass',
    label: 'OFF THE GLASS',
    desc: 'A ball off the back glass at waist height: bajada, lob or chiquita.',
    kind: 'rally',
    setup: { ...base, ball: 'mid', glass: true },
    signature: ['bajada_fast', 'rally_chiquita', 'rally_lob'],
  },
  {
    id: 'net',
    label: 'AT THE NET',
    desc: 'A hard ball at you at the net: volley, block or drop shot.',
    kind: 'rally',
    setup: { ...base, ball: 'mid', me: 'net', hard: true },
    signature: ['volley', 'bloqueo', 'dejada'],
  },
  {
    id: 'side_wall',
    label: 'SIDE WALL',
    desc: 'A ball that bounced by the side wall: the contrapared.',
    kind: 'rally',
    setup: { ...base, ball: 'mid', bounced: true, atWall: true },
    signature: ['contrapared', 'bounce_shot'],
  },
  { id: 'serve', label: 'YOUR SERVE', desc: 'Serve: pick the serve, then hit it as the ring closes.', kind: 'serve', signature: [] },
  { id: 'return', label: 'RETURN', desc: 'They serve at you: read it and return it.', kind: 'return', signature: [] },
  { id: 'runout', label: 'RUN OUT', desc: 'They smash a Por Tres out over the side wall: run out after it and play it back.', kind: 'runout', signature: [] },
];

export const situation = (id: SituationId): Situation => SITUATIONS.find((s) => s.id === id) ?? SITUATIONS[0];

/**
 * The point state of a rally exercise: `start` is a fresh point (guts, server), the ball and the positions come from the setup. A
 * weak lob is only ever played by the human side (the opponents never get a free smash).
 */
export function practicePoint(start: PointState, s: PracticeSetup, holder: SideIndex, hitterIdx: number, humanSide: SideIndex): PointState {
  return {
    ...start,
    status: 'rally',
    holder,
    hitterIdx,
    hits: 1,
    ball: {
      height: s.ball,
      pressure: 0,
      glass: s.glass,
      air: !s.glass && !s.bounced,
      zone: 'mid',
      speed: s.hard ? 26 : 18,
      lob: s.weakLob && holder === humanSide ? 'weak' : undefined,
      ...(s.atWall ? { nearWall: true } : {}),
    },
    // formations are by side: the human pair is `me` whoever holds the ball
    formation: humanSide === 0 ? [s.me, s.opp] : [s.opp, s.me],
  };
}
