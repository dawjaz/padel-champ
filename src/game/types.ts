export type StatKey = 'power' | 'technique' | 'speed' | 'defense';

export interface PlayerDef {
  id: string;
  name: string;
  /** Stats on a 1-10 scale. */
  stats: Record<StatKey, number>;
  maxGuts: number;
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
