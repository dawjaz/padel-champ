// Which recording a racket hit uses. Pure (no audio), so it is tested.

export type RacketKind = 'racket_strong' | 'racket_soft' | 'racket_spin' | 'racket_serve';

const SOFT = new Set(['chiquita', 'rally_chiquita', 'lob', 'rally_lob', 'bandeja', 'bajada_slow', 'dejada', 'bloqueo']);
const SPIN = new Set(['vibora', 'spin_glass', 'rulo', 'bounce_shot', 'bajada_fast', 'contrapared']);

/** `isServe`: the hit is the serve. `speed`: the shot's flight speed, used for the shots that are not listed. */
export function racketKind(shotId: string, isServe: boolean, speed: number): RacketKind {
  if (isServe) return 'racket_serve';
  if (shotId.startsWith('smash_')) return 'racket_strong';
  if (SPIN.has(shotId)) return 'racket_spin';
  if (SOFT.has(shotId)) return 'racket_soft';
  return speed >= 22 ? 'racket_strong' : 'racket_soft';
}
