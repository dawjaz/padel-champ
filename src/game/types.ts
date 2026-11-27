/** The seven attributes (see attributes.ts). 5 is neutral. */
export type StatKey = 'power' | 'spin' | 'technique' | 'accuracy' | 'stamina' | 'speed' | 'defense';

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
  /** Cap (head slot): colour of the crown; the brim is a darker shade. */
  cap?: string;
  /** Shape of the racket head (default: oval). */
  racketShape?: 'diamond' | 'teardrop' | 'round';
  /** Wristband on the racket hand. */
  wristband?: string;
}

export interface PlayerDef {
  id: string;
  name: string;
  /** Nickname shown after the name (every player has one). */
  nick?: string;
  /** Attributes on the mechanics scale 1-10, half steps allowed (5 = neutral); the player sees them doubled, 1-20 (see `STAT_SCALE`). */
  stats: Record<StatKey, number>;
  /** Derived from stamina (`gutsFor`); kept here so that the scenes read one number. */
  maxGuts: number;
  appearance: Appearance;
  /** His special shots (shot ids of kind 'special'): the hero has every one he has unlocked, a CPU player one. */
  specials?: string[];
}

/** Index of a side: 0 = player (near end of the court), 1 = CPU (far end). */
export type SideIndex = 0 | 1;

/** Ball height after a shot. */
export type Height = 'high' | 'mid' | 'low';
export type Direction = 'parallel' | 'middle' | 'cross';
/** A team plays up at the net, in the middle of its half (after a short lob), or back at the baseline. */
export type Formation = 'net' | 'mid' | 'back';
/** 'special': the special shots (one per player, see `SPECIALS`); never offered with the rally shots. */
export type ShotKind = 'serve' | 'return' | 'rally' | 'special';
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
  /** Deadens the floor bounce (multiplies the bounce height and the speed kept): 1 = normal, 0.7 = a ball that dies on the court. */
  deaden?: number;
  /** Multiplies only the bounce height off the floor (the speed along the court is kept): a cut ball that stays low. */
  bounceMul?: number;
  /** Multiplies the height of the rebound off the back glass (1 = normal, 0.6 = a cut ball that comes off low). */
  reboundMul?: number;
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
  /** true: the ball must be played out of the air, before it has bounced (a volley, a bandeja, a vibora). false: only after the bounce (flat shot, contrapared). */
  air?: boolean;
  /** The opponents' team must be in one of these formations (the drop shot needs them deep). */
  oppFormations?: Formation[];
  /** The incoming ball must have been hit at least this fast (m/s): a block only answers a hard ball. */
  minBallSpeed?: number;
  /** true: the ball must come down right by a side wall (the contrapared). */
  nearWall?: boolean;
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
/** How a lost ball ends: into the net, into the back glass (low) or the back mesh (high), or straight into a side wall (a ball aimed at the side). */
export type ErrorKind = 'net' | 'glass' | 'mesh' | 'side' | 'long' | 'bouncemesh';
// long: bounces beyond the line (out); bouncemesh: bounces in the court, then lands on the mesh (out). Serves use all of them.
export type ErrorKinds = Partial<Record<ErrorKind, number>>;

/**
 * Quality of a lob: deep into the court (it bounces; bajada after the glass), medium (lands in the back third and is played out of the
 * air: vibora or bandeja) or weak (lands mid-court or close to the net: smash).
 */
export type LobQuality = 'deep' | 'medium' | 'weak';

export interface ShotDef {
  id: string;
  name: string;
  kind: ShotKind;
  /** A key shot hit with the timing ring (smashes, vibora, bandeja, serves): how well it is timed changes its risk and power. */
  timed?: boolean;
  /** Special shots: the ordinary shot it is a version of (its stroke, sound and look in the scene). */
  base?: string;
  /** Special shots: the hero's level that unlocks it. */
  unlockLevel?: number;
  /** Special shots: how much harder than usual it is to get back (multiplies `specialAnswerChance`; default 1). */
  answerMul?: number;
  /** Hit from above and downwards (volley, dejada, bajada, bandeja, vibora, smash): the racket is up and the stroke goes down, the ball comes down steeply and is taken low. */
  downward?: boolean;
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
  /** Share of the winners of this shot that are the second kind of winner: deeper, off the back glass and back over the opponents' heads (Por Cuatro). */
  reboundWin?: number;
  /** True: this shot never flies back over the net off the glass, however hard it is hit (the flat shot: it would look unnatural). */
  noReboundBack?: boolean;
  /** A serve that beats the receiver by more than this is an ace (default `ACE_MARGIN`). */
  aceMargin?: number;
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
  /** Where (m from the net) a medium lob lands; default [5.8, 7.4]. */
  mediumDepth?: [number, number];
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
  /** Scales the pressure put on the next player (serves: on the receiver; rally shots since v0.158, e.g. the flat drive 0.5). */
  pressureMult?: number;
  /** Drop shot: the defender has to run for it, so speed counts for more than defence and a defender at the back is badly placed. */
  drop?: boolean;
  /** Block: the hitter is not weakened by the pressure of the ball that comes in (he only absorbs it). */
  ignorePressure?: boolean;
  /** Contrapared: the ball is first hit into the side wall next to the hitter, comes off it and crosses the net. */
  ownWall?: boolean;
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
  /** The ball is played out of the air (it has not bounced). Missing = it has bounced (or come off the glass). */
  air?: boolean;
  /** How fast the shot that sent this ball was hit (m/s, its launch speed). */
  speed?: number;
  /** The ball comes down right by a side wall (|x| of 3 m or more), so it can be played into that wall (contrapared). */
  nearWall?: boolean;
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
