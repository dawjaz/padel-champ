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

export interface MoveDef {
  id: string;
  name: string;
  /** Which stat drives the attack. */
  stat: StatKey;
  /** Attack multiplier. */
  power: number;
  /** Guts spent by the hitter. */
  cost: number;
  /** Response ids that are strong against this move. */
  counteredBy: string[];
  desc: string;
}

export interface ResponseDef {
  id: string;
  name: string;
  /** Defence multiplier. */
  mod: number;
  /** Guts spent by the defender. */
  cost: number;
  desc: string;
}

/** Index of a side: 0 = player, 1 = CPU. */
export type SideIndex = 0 | 1;

export type Outcome = 'winner' | 'intercept' | 'continue';

export interface ExchangeResult {
  outcome: Outcome;
  attackScore: number;
  defenseScore: number;
  countered: boolean;
  tired: boolean;
}

export type Rng = () => number;
