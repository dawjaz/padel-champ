// Gear and consumables of the hero. Pure (no Phaser), tested. Data: src/data/gear.json, src/data/consumables.json.
// Rule: total attribute = base + skill points + gear (+ a boost for one match), never above `levels.statMax`.
// An item can be equipped only from its `minLevel`; items with `unlock` come to the inventory at that level (packs add more in B4).

import consumablesData from '../data/consumables.json';
import packsData from '../data/packs.json';
import gearData from '../data/gear.json';
import type { Appearance, StatKey } from '../game/types';

export type Slot = 'head' | 'top' | 'shorts' | 'shoes' | 'racket' | 'wristband' | 'bag' | 'balls';
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
  /** Colour shown on the character (not for the bag and the balls). */
  color?: string;
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
  head: 'CAP',
  top: 'SHIRT',
  shorts: 'SHORTS',
  shoes: 'SHOES',
  racket: 'RACKET',
  wristband: 'WRISTBAND',
  bag: 'BAG',
  balls: 'BALLS',
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

/** The sum of the bonuses of everything that is equipped. */
export function gearBonus(inv: Inventory): Record<StatKey, number> {
  const sum = { power: 0, spin: 0, technique: 0, accuracy: 0, stamina: 0, speed: 0, defense: 0 } as Record<StatKey, number>;
  for (const slot of SLOTS) {
    const g = inv.equipped[slot] ? gearById(inv.equipped[slot]!) : undefined;
    if (!g) continue;
    for (const [k, v] of Object.entries(g.bonus)) sum[k as StatKey] += v ?? 0;
  }
  return sum;
}

/** The look of the hero with the colours of the equipped items. */
export function applyLook(base: Appearance, inv: Inventory): Appearance {
  const a: Appearance = { ...base };
  const col = (slot: Slot): string | undefined => (inv.equipped[slot] ? gearById(inv.equipped[slot]!)?.color : undefined);
  const cap = col('head');
  if (cap) a.cap = cap;
  const top = col('top');
  if (top) a.shirt = top;
  const shorts = col('shorts');
  if (shorts) a.bottom = shorts;
  const shoes = col('shoes');
  if (shoes) a.shoes = shoes;
  const racket = col('racket');
  if (racket) a.racket = racket;
  const band = col('wristband');
  if (band) a.wristband = band;
  return a;
}

// ---------- new gear (the star in the GEAR screen) ----------

/** Owned gear of a slot that can be worn now and has not been looked at yet. */
export function newItemsOfSlot(inv: Inventory, slot: Slot, level: number): GearItem[] {
  return itemsOfSlot(slot).filter((g) => inv.owned.includes(g.id) && level >= g.minLevel && !inv.seen.includes(g.id));
}

export const hasNewIn = (inv: Inventory, slot: Slot, level: number): boolean => newItemsOfSlot(inv, slot, level).length > 0;

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
