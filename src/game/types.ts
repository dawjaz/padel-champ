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
/** A team plays up at the net, in the middle of its half (after a short lob), or back at the baseline. */
export type Formation = 'net' | 'mid' | 'back';
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

/**
 * Real-world ball flight of a shot (used by src/art/ballPath.ts, not by the rules).
 * Speeds are what a decent amateur/pro hits, in metres per second (km/h / 3.6).
 */
export interface FlightDef {
  /** Horizontal ball speed off the racket, m/s. The ball is slowed (a higher arc) if it needs more time to clear the net. */
  speed: number;
  /** Minimum height of the arc above the higher end of the flight, in metres (a lob needs 5-6 m, a flat shot 0). */
  apex: number;
  /** -1 = heavy backspin/slice (bounces short and low, dies against the wall), 0 = flat, +1 = heavy topspin (kicks forward). */
  spin: number;
  /** Multiplier of the ball's speed along a wall after it bounces off it (side-spin shots such as the vibora run along the glass). */
  wallKick: number;
  /**
   * Side spin (the spin about the vertical axis), seen by the player: 0 = none, +1 = heavy slice with the racket going across
   * the ball from right to left (clockwise seen from above; a vibora or a kick serve). Used for the rotation of the ball on screen.
   */
  side: number;
  /** Extra speed (share of `speed`) when the hitter is right at the net: a volley from the net is much faster than one from mid-court. */
  netBoost?: number;
}

/** When a shot can be played (all listed conditions must hold). Missing = always. */
export interface ShotRequires {
  /** The hitter's team must be in one of these formations. */
  formations?: Formation[];
  /** The incoming ball must have one of these heights when it is played. */
  heights?: Height[];
  /** true: the ball must have come off the back glass; false: it must be played before it reaches the glass. */
  glass?: boolean;
  /** The incoming ball must fall in one of these zones (see `BallState.zone`). */
  zones?: Zone[];
  /** The incoming ball must be a weak lob (one that lands in the middle of the court or near the net). */
  weakLob?: boolean;
  /** Hint (why this shot is not possible now). */
  hint: string;
}

/** Where the ball comes down on the hitter's half: close to the net, in the middle of the court, or deep by the back glass. */
export type Zone = 'net' | 'mid' | 'back';

/** How a lost ball ends: into the net, flying into the back glass without a bounce (out), or into the mesh above the glass (out). */
export type ErrorKind = 'net' | 'glass' | 'mesh';
export type ErrorKinds = Record<ErrorKind, number>;

/** Quality of a lob: deep into the court, or weak (lands mid-court or close to the net). */
export type LobQuality = 'deep' | 'weak';

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
  /** Metres past the net where a WINNING version of the shot first lands (default: `landDepth`). */
  winLandDepth?: number;
  /** Serves only: how far from the centre line the ball lands, in metres. */
  landX?: number;
  wall: WallHit;
  flight: FlightDef;
  /** Overrides the default margin needed to win the point outright. */
  winnerMargin?: number;
  /** Smash/rulo: a winning ball flies out over the glass or the fence instead of staying in play. */
  overFence?: boolean;
  /** Rulo: the ball lands this far from the centre line (just beside the side fence); the side comes from the direction. */
  edgeX?: number;
  /** Where a winning overFence ball should leave the court, when it matters: over the back glass or the side wall. */
  exitVia?: 'back' | 'side';
  requires?: ShotRequires;
  /** Chance (0..1) that the ball reaches the back glass and is played after it (default 0). */
  glassChance?: number;
  /** Weights of the height at which the ball comes off the back glass (default low 0.3, mid 0.4, high 0.3). */
  rebound?: Record<Height, number>;
  /** Lobs only: where a weak lob lands, in metres from the net (min, max). */
  weakDepth?: [number, number];
  /** Extra error chance when this shot is played off a low ball that has come off the glass (the lob is risky there). */
  /** Text of the menu button when the name does not fit (a line break is allowed). The cost is added. */
  menuLabel?: string;
  /** Relative weights of how a mistake with this shot ends (default: net 0.6, glass 0.25, mesh 0.15). */
  errorKinds?: ErrorKinds;
  /**
   * The ball comes off the opponent's back glass after this shot (the bajada): the defender can still run it down. Speed counts for
   * more than usual and so does where he stands (at the back he is well placed, at the net he has no chance).
   */
  reboundChase?: boolean;
  /** A defender at the net blocks this shot out of the air (it does not bounce, he does not let it go). */
  blockAtNet?: boolean;
  /** Half-range of the random landing depths around `landDepth` in metres (default 1.5). */
  depthSpread?: number;
  lowGlassRisk?: number;
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
  /** The ball comes from a lob: deep, or weak (lands mid-court or near the net). */
  lob?: LobQuality;
  /** The ball has come off (or will come off) the back glass before it is played. */
  glass?: boolean;
  /** Where the ball comes down (its first bounce, or the spot it is taken out of the air). */
  zone?: Zone;
  /** How fast the shot that sent this ball was hit (m/s, its launch speed). */
  speed?: number;
}

/** Where a CPU (or partner) hitter would like the ball to go: the aim points closest to these are preferred (x across, depth past the net). */
export interface AimPreference {
  x?: number;
  depth?: number;
}

/** Position on the court in metres: x across (-5..5), z along (0 = far baseline, 10 = net, 20 = near baseline). */
export interface CourtPos {
  x: number;
  z: number;
}

export type Rng = () => number;
