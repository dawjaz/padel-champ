// Gear and consumables of the hero. Pure (no Phaser), tested. Data: src/data/gear.json, src/data/consumables.json.
// Rule: total attribute = base + skill points + gear (+ a boost for one match), never above `levels.statMax`.
// An item can be equipped only from its `minLevel`; items with `unlock` come to the inventory at that level (packs add more in B4).

import consumablesData from '../data/consumables.json';
import packsData from '../data/packs.json';
import gearData from '../data/gear.json';
import brandsData from '../data/brands.json';
import type { Appearance, StatKey } from '../game/types';

export type Slot = 'top' | 'shorts' | 'shoes' | 'racket' | 'bag';
export type RacketShape = 'diamond' | 'teardrop' | 'round';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type Bonus = Partial<Record<StatKey, number>>;

export interface GearItem {
  id: string;
  slot: Slot;
  name: string;
  rarity: Rarity;
  minLevel: number;
  unlock?: number;
  bonus: Bonus;
  /** The maker (see brands.json). */
  brand: string;
  /** Colour shown on the character (the bag shows it only as an icon). */
  color?: string;
  /** Rackets only: the shape of the head, drawn on the character. */
  shape?: RacketShape;
}

export interface Brand {
  id: string;
  name: string;
  /** What the brand is good at, as a short label. */
  tag: string;
  /** Light, main, dark and accent colour. */
  colors: string[];
  /** Set bonus: +1 to the first stat with 3 pieces of the brand equipped, +1 to both with 5. */
  set: StatKey[];
}

export interface Consumable {
  id: string;
  name: string;
  desc: string;
  stats?: Bonus;
  maxGuts?: number;
  recoveryPct?: number;
  /** Short effect text for buttons. */
  short: string;
  /** Price in coins in the shop. */
  price: number;
}

export interface Inventory {
  owned: string[];
  equipped: Partial<Record<Slot, string>>;
  /** Unopened packs (from level-ups): pack id -> count. */
  packs: Record<string, number>;
  /** Packs opened since the last item of the pity rarity, per pack id (see packs.ts). */
  pity: Record<string, number>;
  /** Boosts in the bag (consumable ids, at most `MAX_BOOSTS`): bought in the shop, used one per tournament match. */
  boosts: string[];
  /** The boost chosen for the next tournament match (used up when it starts); it is still in `boosts` until then. */
  queued: string[];
  /** Gear the player has already looked at in the GEAR screen: anything owned, wearable and not in here is NEW (a star on its category). */
  seen: string[];
}

export const SLOTS = gearData.slots as Slot[];
export const GEAR = gearData.items as GearItem[];
export const BRANDS = brandsData as Brand[];
export const brandById = (id: string): Brand | undefined => BRANDS.find((b) => b.id === id);
/** The four models of a brand in a slot, from basic to elite. */
export const itemsOfBrand = (slot: Slot, brand: string): GearItem[] => GEAR.filter((g) => g.slot === slot && g.brand === brand);
export const CONSUMABLES = consumablesData.items as Consumable[];
const packIds = packsData.packs.map((p) => p.id);
/** At most this many boosts in the bag (so two for a tournament). */
export const MAX_BOOSTS: number = consumablesData.maxBoosts;
/** One boost per match. */
export const MAX_QUEUED = 1;

export const gearById = (id: string): GearItem | undefined => GEAR.find((g) => g.id === id);
export const consumableById = (id: string): Consumable | undefined => CONSUMABLES.find((c) => c.id === id);
export const itemsOfSlot = (slot: Slot): GearItem[] => GEAR.filter((g) => g.slot === slot);

export const SLOT_LABEL: Record<Slot, string> = {
  top: 'SHIRT',
  shorts: 'SHORTS',
  shoes: 'SHOES',
  racket: 'RACKET',
  bag: 'BAG',
};

export function newInventory(): Inventory {
  const inv = syncUnlocks({ owned: [], equipped: {}, packs: {}, pity: {}, boosts: [], queued: [], seen: [] }, 1);
  return { ...inv, seen: [...inv.owned] }; // the starting gear is not news
}

/** Adds the items that unlock at or below this level. */
export function syncUnlocks(inv: Inventory, level: number): Inventory {
  const add = GEAR.filter((g) => g.unlock !== undefined && g.unlock <= level && !inv.owned.includes(g.id)).map((g) => g.id);
  return add.length === 0 ? inv : { ...inv, owned: [...inv.owned, ...add] };
}

/** Items newly unlocked by going from `from` to `to`. */
export const unlockedBetween = (from: number, to: number): GearItem[] => GEAR.filter((g) => g.unlock !== undefined && g.unlock > from && g.unlock <= to);

export function canEquip(inv: Inventory, id: string, level: number): boolean {
  const g = gearById(id);
  return !!g && inv.owned.includes(id) && level >= g.minLevel;
}

export function equip(inv: Inventory, id: string, level: number): Inventory {
  const g = gearById(id);
  if (!g || !canEquip(inv, id, level)) return inv;
  return { ...inv, equipped: { ...inv.equipped, [g.slot]: id } };
}

export function unequip(inv: Inventory, slot: Slot): Inventory {
  const equipped = { ...inv.equipped };
  delete equipped[slot];
  return { ...inv, equipped };
}

/** Pieces needed for the first and the full set bonus. */
export const SET_PIECES = [3, 5] as const;

export interface SetBonus {
  brand: Brand;
  pieces: number;
  /** The stats that get +1 now (empty below 3 pieces). */
  stats: StatKey[];
}

/** The brand with the most equipped pieces and its set bonus (null when nothing is equipped). Ties go to the brand listed first. */
export function setBonusOf(inv: Inventory): SetBonus | null {
  const count: Record<string, number> = {};
  for (const slot of SLOTS) {
    const g = inv.equipped[slot] ? gearById(inv.equipped[slot]!) : undefined;
    if (g) count[g.brand] = (count[g.brand] ?? 0) + 1;
  }
  let best: SetBonus | null = null;
  for (const brand of BRANDS) {
    const pieces = count[brand.id] ?? 0;
    if (pieces === 0 || (best && pieces <= best.pieces)) continue;
    best = { brand, pieces, stats: brand.set.slice(0, pieces >= SET_PIECES[1] ? 2 : pieces >= SET_PIECES[0] ? 1 : 0) };
  }
  return best;
}

/** The sum of the bonuses of everything that is equipped, plus the set bonus. */
export function gearBonus(inv: Inventory): Record<StatKey, number> {
  const sum = { power: 0, spin: 0, technique: 0, accuracy: 0, stamina: 0, speed: 0, defense: 0 } as Record<StatKey, number>;
  for (const slot of SLOTS) {
    const g = inv.equipped[slot] ? gearById(inv.equipped[slot]!) : undefined;
    if (!g) continue;
    for (const [k, v] of Object.entries(g.bonus)) sum[k as StatKey] += v ?? 0;
  }
  for (const k of setBonusOf(inv)?.stats ?? []) sum[k] += 1;
  return sum;
}

/** How many of the brand's 20 items (5 slots x 4 models) are owned. */
export const ownedOfBrand = (inv: Inventory, brand: string): number => GEAR.filter((g) => g.brand === brand && inv.owned.includes(g.id)).length;

/** The look of the hero with the colours of the equipped items (and the shape of the racket). */
export function applyLook(base: Appearance, inv: Inventory): Appearance {
  const a: Appearance = { ...base };
  const item = (slot: Slot): GearItem | undefined => (inv.equipped[slot] ? gearById(inv.equipped[slot]!) : undefined);
  const col = (slot: Slot): string | undefined => item(slot)?.color;
  const top = col('top');
  if (top) a.shirt = top;
  const shorts = col('shorts');
  if (shorts) a.bottom = shorts;
  const shoes = col('shoes');
  if (shoes) a.shoes = shoes;
  const racket = item('racket');
  if (racket?.color) a.racket = racket.color;
  if (racket?.shape) a.racketShape = racket.shape;
  return a;
}

/**
 * Items of the first release (before brands) that are gone. A save that owned one of the better ones gets coins back
 * (the duplicate price of its rarity); the free starting items are not paid back.
 */
const LEGACY: Record<string, Rarity> = {
  cap_visor: 'rare', top_tech: 'rare', sh_flex: 'rare', sho_power: 'rare', rk_spin: 'rare', wb_grip: 'rare', bag_tour: 'rare', ball_pro: 'rare',
  cap_pro: 'epic', top_pro: 'epic', sh_pro: 'epic', sho_grip: 'epic', rk_pro: 'epic', wb_pro: 'epic', bag_team: 'epic', ball_tour: 'epic',
  cap_champ: 'legendary', top_champ: 'legendary', sh_champ: 'legendary', sho_champ: 'legendary', rk_champ: 'legendary', wb_champ: 'legendary', bag_champ: 'legendary', ball_champ: 'legendary',
};

/** Coins for the old (removed) items in a stored inventory. */
export function legacyRefund(raw: unknown): number {
  const owned = (raw as { owned?: unknown } | null)?.owned;
  if (!Array.isArray(owned)) return 0;
  const dup = packsData.dup as Record<Rarity, number>;
  return [...new Set(owned)].reduce<number>((sum, id) => sum + (typeof id === 'string' && LEGACY[id] ? dup[LEGACY[id]] : 0), 0);
}

// ---------- new gear (the star in the GEAR screen) ----------

/** Owned gear of a slot that can be worn now and has not been looked at yet. */
export function newItemsOfSlot(inv: Inventory, slot: Slot, level: number): GearItem[] {
  return itemsOfSlot(slot).filter((g) => inv.owned.includes(g.id) && level >= g.minLevel && !inv.seen.includes(g.id));
}

export const hasNewIn = (inv: Inventory, slot: Slot, level: number): boolean => newItemsOfSlot(inv, slot, level).length > 0;

/** This model is new: owned, can be worn now, not looked at yet (the star on its row, on its brand tab and on its slot). */
export const isNewItem = (inv: Inventory, g: GearItem, level: number): boolean => inv.owned.includes(g.id) && level >= g.minLevel && !inv.seen.includes(g.id);

/** Is there a new model of this brand in this slot (the star on the brand tab)? */
export const hasNewInBrand = (inv: Inventory, slot: Slot, brand: string, level: number): boolean => itemsOfBrand(slot, brand).some((g) => isNewItem(inv, g, level));

/** The player looked at this model (tapped it): it is not news any more. */
export function markItemSeen(inv: Inventory, id: string): Inventory {
  return inv.seen.includes(id) ? inv : { ...inv, seen: [...inv.seen, id] };
}

/** The player opened this slot: what is new in it counts as seen. */
export function markSeen(inv: Inventory, slot: Slot, level: number): Inventory {
  const fresh = newItemsOfSlot(inv, slot, level);
  return fresh.length === 0 ? inv : { ...inv, seen: [...inv.seen, ...fresh.map((g) => g.id)] };
}

// ---------- boosts ----------

/** Adds a bought boost to the bag, or returns the inventory unchanged when the bag is full or the boost is unknown. */
export function addBoost(inv: Inventory, id: string): Inventory {
  if (!consumableById(id) || inv.boosts.length >= MAX_BOOSTS) return inv;
  return { ...inv, boosts: [...inv.boosts, id] };
}

/** Picks the boost for the next match (one only), or takes the pick back. Only a boost in the bag can be picked. */
export function toggleQueued(inv: Inventory, id: string): Inventory {
  if (inv.queued.includes(id)) return { ...inv, queued: [] };
  if (!inv.boosts.includes(id)) return inv;
  return { ...inv, queued: [id] };
}

export interface Boost {
  stats: Bonus;
  maxGuts: number;
  recoveryPct: number;
}

/** What the queued consumables add for one match. */
export function boostOf(inv: Inventory): Boost {
  const boost: Boost = { stats: {}, maxGuts: 0, recoveryPct: 0 };
  for (const id of inv.queued) {
    const c = consumableById(id);
    if (!c) continue;
    for (const [k, v] of Object.entries(c.stats ?? {})) boost.stats[k as StatKey] = (boost.stats[k as StatKey] ?? 0) + (v ?? 0);
    boost.maxGuts += c.maxGuts ?? 0;
    boost.recoveryPct += c.recoveryPct ?? 0;
  }
  return boost;
}

/** Uses up the chosen boost (the match starts): one copy leaves the bag. */
export function consumeQueued(inv: Inventory): Inventory {
  const boosts = [...inv.boosts];
  for (const id of inv.queued) {
    const at = boosts.indexOf(id);
    if (at >= 0) boosts.splice(at, 1);
  }
  return { ...inv, boosts, queued: [] };
}

/** Makes a stored inventory safe: known items only, equipped items must be owned, at most `MAX_BOOSTS` known boosts, the pick must be in the bag. */
export function sanitizeInventory(raw: unknown, level: number): Inventory {
  const o = (raw ?? null) as Partial<Record<string, unknown>> | null;
  if (!o) return newInventory();
  const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const owned = syncUnlocks({ owned: [...new Set(ids(o.owned).filter((id) => gearById(id)))], equipped: {}, packs: {}, pity: {}, boosts: [], queued: [], seen: [] }, level).owned;
  const equipped: Partial<Record<Slot, string>> = {};
  const eq = (o.equipped ?? {}) as Record<string, unknown>;
  for (const slot of SLOTS) {
    const id = eq[slot];
    if (typeof id === 'string' && owned.includes(id) && gearById(id)?.slot === slot && level >= (gearById(id)?.minLevel ?? 99)) equipped[slot] = id;
  }
  let boosts = ids(o.boosts).filter((id) => consumableById(id));
  if (!Array.isArray(o.boosts)) {
    // An old save kept a stock per boost: keep at most what the bag holds now.
    const st = (o.stock ?? {}) as Record<string, unknown>;
    boosts = [];
    for (const c of CONSUMABLES) {
      const v = st[c.id];
      for (let i = 0; typeof v === 'number' && Number.isFinite(v) && i < Math.floor(v); i++) boosts.push(c.id);
    }
  }
  boosts = boosts.slice(0, MAX_BOOSTS);
  const left = [...boosts];
  const queued: string[] = [];
  for (const id of ids(o.queued)) {
    const at = left.indexOf(id);
    if (at >= 0 && queued.length < MAX_QUEUED) {
      queued.push(id);
      left.splice(at, 1);
    }
  }
  // An old save has no `seen`: everything owned counts as seen, so nothing shows a star by surprise.
  const seen = Array.isArray(o.seen) ? [...new Set(ids(o.seen).filter((id) => owned.includes(id)))] : [...owned];
  const counts = (v: unknown): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const [k, n] of Object.entries((v ?? {}) as Record<string, unknown>)) {
      if (typeof n === 'number' && Number.isFinite(n) && n > 0 && packIds.includes(k)) out[k] = Math.floor(n);
    }
    return out;
  };
  return { owned, equipped, packs: counts(o.packs), pity: counts(o.pity), boosts, queued, seen };
}
