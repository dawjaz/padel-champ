// Packs: bought with coins in the shop or won (one Gear Pack per level up). Drop odds are shown in the shop. Pure, tested; randomness
// comes only from the injected `rng`. Data: src/data/packs.json.

import packsData from '../data/packs.json';
import { CONSUMABLES, GEAR, type GearItem, type Inventory, type Rarity } from './gear';
import type { Rng } from '../game/types';
import type { Profile } from './profile';

export interface PackDef {
  id: string;
  name: string;
  price: number;
  /** Gear items in the pack. */
  items?: number;
  /** Consumables in the pack. */
  consumables?: number;
  /** Percent weights per rarity (sum 100). */
  odds?: Partial<Record<Rarity, number>>;
  /** After `after - 1` packs without an item of `min` or better, the next pack gives one for sure. */
  pity?: { after: number; min: Rarity };
}

export type Drop =
  | { kind: 'gear'; item: GearItem; duplicate: boolean; coins: number }
  | { kind: 'consumable'; id: string; name: string };

export const PACKS = packsData.packs as PackDef[];
export const LEVEL_UP_PACK: string = packsData.levelUpPack;
export const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
export const DUPLICATE_COINS = packsData.dup as Record<Rarity, number>;

export const packById = (id: string): PackDef | undefined => PACKS.find((p) => p.id === id);

const rank = (r: Rarity): number => RARITIES.indexOf(r);

/** Rolls a rarity from the odds; `min` cuts away everything below it (the pity rule). */
export function rollRarity(odds: Partial<Record<Rarity, number>>, rng: Rng, min?: Rarity): Rarity {
  const list = RARITIES.filter((r) => (odds[r] ?? 0) > 0 && (min === undefined || rank(r) >= rank(min)));
  const pool = list.length > 0 ? list : RARITIES.filter((r) => min === undefined || rank(r) >= rank(min));
  const weight = (r: Rarity): number => (list.length > 0 ? (odds[r] ?? 0) : 1);
  const total = pool.reduce((a, r) => a + weight(r), 0);
  let roll = rng() * total;
  for (const r of pool) {
    roll -= weight(r);
    if (roll < 0) return r;
  }
  return pool[pool.length - 1];
}

export interface Opened {
  profile: Profile;
  drops: Drop[];
}

/** Opens one pack (the price is not charged here). New items go to the inventory; a duplicate turns into coins. */
export function openPack(profile: Profile, packId: string, rng: Rng): Opened {
  const def = packById(packId);
  if (!def) return { profile, drops: [] };
  let inv: Inventory = profile.inventory;
  let coins = profile.coins;
  const drops: Drop[] = [];
  const pityMin = def.pity?.min;
  const forced = def.pity !== undefined && (inv.pity[def.id] ?? 0) >= def.pity.after - 1;
  let gotPity = false;
  for (let i = 0; i < (def.items ?? 0); i++) {
    const min = forced && i === 0 && !gotPity ? pityMin : undefined;
    const rarity = rollRarity(def.odds ?? { common: 100 }, rng, min);
    const pool = GEAR.filter((g) => g.rarity === rarity);
    const item = pool[Math.floor(rng() * pool.length)];
    const duplicate = inv.owned.includes(item.id);
    const refund = duplicate ? DUPLICATE_COINS[item.rarity] : 0;
    coins += refund;
    if (!duplicate) inv = { ...inv, owned: [...inv.owned, item.id] };
    if (pityMin && rank(item.rarity) >= rank(pityMin)) gotPity = true;
    drops.push({ kind: 'gear', item, duplicate, coins: refund });
  }
  const stock = { ...inv.stock };
  for (let i = 0; i < (def.consumables ?? 0); i++) {
    const c = CONSUMABLES[Math.floor(rng() * CONSUMABLES.length)];
    stock[c.id] = (stock[c.id] ?? 0) + 1;
    drops.push({ kind: 'consumable', id: c.id, name: c.name });
  }
  const pity = { ...inv.pity };
  if (def.pity) {
    if (gotPity) delete pity[def.id];
    else pity[def.id] = (pity[def.id] ?? 0) + 1;
  }
  return { profile: { ...profile, coins, inventory: { ...inv, stock, pity } }, drops };
}

export const canBuy = (p: Profile, packId: string): boolean => {
  const def = packById(packId);
  return !!def && p.coins >= def.price;
};

/** Pays for the pack and opens it, or returns null when there are not enough coins. */
export function buyPack(profile: Profile, packId: string, rng: Rng): Opened | null {
  const def = packById(packId);
  if (!def || profile.coins < def.price) return null;
  return openPack({ ...profile, coins: profile.coins - def.price }, packId, rng);
}

/** Opens one of the unopened (free) packs, or returns null when there is none. */
export function openStockPack(profile: Profile, packId: string, rng: Rng): Opened | null {
  const n = profile.inventory.packs[packId] ?? 0;
  if (n <= 0) return null;
  const packs = { ...profile.inventory.packs };
  if (n === 1) delete packs[packId];
  else packs[packId] = n - 1;
  return openPack({ ...profile, inventory: { ...profile.inventory, packs } }, packId, rng);
}

/** The odds of a pack for the shop screen: percent per rarity that can drop, in order. */
export function oddsOf(def: PackDef): { rarity: Rarity; percent: number }[] {
  const odds = def.odds ?? {};
  const total = RARITIES.reduce((a, r) => a + (odds[r] ?? 0), 0);
  return RARITIES.filter((r) => (odds[r] ?? 0) > 0).map((r) => ({ rarity: r, percent: Math.round(((odds[r] ?? 0) / total) * 1000) / 10 }));
}
