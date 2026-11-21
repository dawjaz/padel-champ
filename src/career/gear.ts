// Gear and consumables of the hero. Pure (no Phaser), tested. Data: src/data/gear.json, src/data/consumables.json.
// Rule: total attribute = base + skill points + gear (+ a boost for one match), never above `levels.statMax`.
// An item can be equipped only from its `minLevel`; items with `unlock` come to the inventory at that level (packs add more in B4).

import consumablesData from '../data/consumables.json';
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
}

export interface Inventory {
  owned: string[];
  equipped: Partial<Record<Slot, string>>;
  /** Consumables in stock. */
  stock: Record<string, number>;
  /** Consumables chosen for the next match (used up when it starts). */
  queued: string[];
}

export const SLOTS = gearData.slots as Slot[];
export const GEAR = gearData.items as GearItem[];
export const CONSUMABLES = consumablesData.items as Consumable[];
export const MAX_QUEUED = consumablesData.maxQueued;

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
  return syncUnlocks({ owned: [], equipped: {}, stock: { ...consumablesData.starter }, queued: [] }, 1);
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

// ---------- consumables ----------

export function toggleQueued(inv: Inventory, id: string): Inventory {
  if (inv.queued.includes(id)) return { ...inv, queued: inv.queued.filter((q) => q !== id) };
  if (inv.queued.length >= MAX_QUEUED || (inv.stock[id] ?? 0) <= 0 || !consumableById(id)) return inv;
  return { ...inv, queued: [...inv.queued, id] };
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

/** Uses up the queued consumables (the match starts). */
export function consumeQueued(inv: Inventory): Inventory {
  const stock = { ...inv.stock };
  for (const id of inv.queued) stock[id] = Math.max(0, (stock[id] ?? 0) - 1);
  return { ...inv, stock, queued: [] };
}

/** Makes a stored inventory safe: known items only, equipped items must be owned, stock whole numbers, queued must be in stock. */
export function sanitizeInventory(raw: unknown, level: number): Inventory {
  const o = (raw ?? null) as Partial<Record<string, unknown>> | null;
  if (!o) return newInventory();
  const ids = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const owned = syncUnlocks({ owned: [...new Set(ids(o.owned).filter((id) => gearById(id)))], equipped: {}, stock: {}, queued: [] }, level).owned;
  const equipped: Partial<Record<Slot, string>> = {};
  const eq = (o.equipped ?? {}) as Record<string, unknown>;
  for (const slot of SLOTS) {
    const id = eq[slot];
    if (typeof id === 'string' && owned.includes(id) && gearById(id)?.slot === slot && level >= (gearById(id)?.minLevel ?? 99)) equipped[slot] = id;
  }
  const stock: Record<string, number> = {};
  const st = (o.stock ?? {}) as Record<string, unknown>;
  for (const c of CONSUMABLES) {
    const v = st[c.id];
    stock[c.id] = typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  }
  const queued = [...new Set(ids(o.queued).filter((id) => (stock[id] ?? 0) > 0))].slice(0, MAX_QUEUED);
  return { owned, equipped, stock, queued };
}
