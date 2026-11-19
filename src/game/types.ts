export type StatKey = 'power' | 'technique' | 'speed' | 'defense';

export type Gender = 'male' | 'female';
export type HairStyle = 'short' | 'long' | 'ponytail' | 'bun' | 'afro' | 'bald';

/**
 * How a player looks. Colours are CSS hex strings ("#rrggbb"). Every garment has its own field,
 * so later equipment (outfits, shoes, rackets) can simply override these colours.
 */
export interface Appearance {
  gender: Gender;
  skin: string;
  hairStyle: HairStyle;
  hairColor: string;
  shirt: string;
  bottom: string;
  bottomStyle: 'shorts' | 'skirt';
  shoes: string;
  racket: string;
  headband?: string;
}

export interface PlayerDef {
  id: string;
  name: string;
  /** Stats on a 1-10 scale. */
  stats: Record<StatKey, number>;
  maxGuts: number;
  appearance: Appearance;
}

/** Index of a side: 0 = player (near end of the court), 1 = CPU (far end). */
export type SideIndex = 0 | 1;

/** Ball height after a shot. */
export type Height = 'high' | 'mid' | 'low';
export type Direction = 'parallel' | 'middle' | 'cross';
/** A team plays either up at the net or back at the baseline. */
export type Formation = 'net' | 'back';
export type ShotKind = 'serve' | 'return' | 'rally';
/** What the ball hits after its first bounce in the opponent's court. */
export type WallHit = 'none' | 'side' | 'back' | 'fence';
/** Screen-side lane of a player: -1 = left, +1 = right. */
export type LaneSign = -1 | 1;

/**
 * How the receiver takes a serve that kicks off the side glass: `bounce` = straight after the first bounce
 * (early, rushed ball, but clean contact), `wall` = after the ball has come off the glass (more time).
 * Rally shots that go to a wall are always taken after the wall.
 */
export type ReceiveMode = 'bounce' | 'wall';

export interface ShotDef {
  id: string;
  name: string;
  kind: ShotKind;
  /** Which stat drives the attack. */
  stat: StatKey;
  /** Attack multiplier. */
  power: number;
  /** Guts spent by the hitter. */
  cost: number;
  /** Base chance of an unforced error (a fault, for serves). */
  risk: number;
  /** Height of the ball after this shot. */
  out: Height;
  /** Multiplier by the height of the incoming ball. */
  fit: Record<Height, number>;
  /** Shots that always go one way (rulo). */
  fixedDirection?: Direction;
  /** What this shot does to the hitter's formation. */
  advance: 'net' | 'back' | 'stay';
  /** Metres from the net where the ball first lands in the opponent's court. */
  landDepth: number;
  /** Serves only: how far from the centre line the ball lands, in metres. */
  landX?: number;
  wall: WallHit;
  /** Overrides the default margin needed to win the point outright. */
  winnerMargin?: number;
  /** Serves only: scales the pressure put on the receiver. */
  pressureMult?: number;
  desc: string;
}

export interface DirectionDef {
  id: Direction;
  name: string;
  /** Attack multiplier. */
  attack: number;
  /** Extra error chance. */
  risk: number;
  /** Defence multiplier for the receiver (<1 = confusion). */
  hesitation: number;
}

export interface BallState {
  height: Height;
  /** 0..0.4: how much the previous shot has weakened the next hit. */
  pressure: number;
}

/** Position on the court in metres: x across (-5..5), z along (0 = far baseline, 10 = net, 20 = near baseline). */
export interface CourtPos {
  x: number;
  z: number;
}

export type Rng = () => number;
