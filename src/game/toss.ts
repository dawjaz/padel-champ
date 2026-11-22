import type { Rng, SideIndex } from './types';

export type CoinFace = 'heads' | 'tails';

/** Flips the coin: the randomness comes from the injected rng so tests are deterministic. */
export function flipCoin(rng: Rng): CoinFace {
  return rng() < 0.5 ? 'heads' : 'tails';
}

/** The side that wins the toss serves first. `caller` is the side that called heads or tails. */
export function tossWinner(call: CoinFace, result: CoinFace, caller: SideIndex): SideIndex {
  if (call === result) return caller;
  return caller === 0 ? 1 : 0;
}
