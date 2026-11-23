import { describe, expect, it } from 'vitest';
import { seededRng } from '../game/rng';
import { CONSUMABLES, gearById, newInventory } from './gear';
import { boostProblem, buyBoost, buyPack, canBuy, DUPLICATE_COINS, LEVEL_UP_PACK, oddsOf, openPack, openStockPack, packById, PACKS, priceOf, rollRarity } from './packs';
import { award, levelOf, newProfile, xpToReach, type Profile } from './profile';

describe('pack data', () => {
  it('odds add up to 100% and every pack gives something', () => {
    for (const p of PACKS) {
      expect(p.items ?? 0, p.id).toBeGreaterThan(0);
      if (p.items) expect(oddsOf(p).reduce((a, o) => a + o.percent, 0), p.id).toBeCloseTo(100, 0);
      expect(p.price, p.id).toBeGreaterThan(0);
    }
    expect(packById(LEVEL_UP_PACK)).toBeDefined();
  });
});

describe('rolls', () => {
  it('follow the odds over many rolls', () => {
    const rng = seededRng(7);
    const counts = { common: 0, rare: 0, epic: 0, legendary: 0 };
    const n = 20000;
    for (let i = 0; i < n; i++) counts[rollRarity({ common: 70, rare: 26, epic: 4 }, rng)]++;
    expect(counts.common / n).toBeGreaterThan(0.67);
    expect(counts.common / n).toBeLessThan(0.73);
    expect(counts.epic / n).toBeGreaterThan(0.03);
    expect(counts.epic / n).toBeLessThan(0.05);
    expect(counts.legendary).toBe(0);
  });

  it('a minimum rarity cuts the lower ones', () => {
    const rng = seededRng(3);
    for (let i = 0; i < 300; i++) expect(rollRarity({ common: 90, rare: 9, epic: 1 }, rng, 'rare')).not.toBe('common');
  });
});

describe('opening', () => {
  it('a gear pack gives its items; new items are owned, a duplicate pays coins', () => {
    const p = { ...newProfile(), coins: 0 };
    const r = openPack(p, 'gear', seededRng(1));
    expect(r.drops.length).toBe(2);
    for (const d of r.drops) {
      if (d.kind !== 'gear') throw new Error('gear only');
      expect(r.profile.inventory.owned).toContain(d.item.id);
      if (d.duplicate) expect(d.coins).toBe(DUPLICATE_COINS[d.item.rarity]);
    }
    const coins = r.drops.reduce((a, d) => a + (d.kind === 'gear' ? d.coins : 0), 0);
    expect(r.profile.coins).toBe(coins);
  });

  it('opening never loses an item and ownership has no repeats', () => {
    let p = newProfile();
    for (let i = 0; i < 200; i++) p = openPack(p, i % 2 === 0 ? 'gear' : 'premium', seededRng(i)).profile;
    expect(new Set(p.inventory.owned).size).toBe(p.inventory.owned.length);
    for (const id of p.inventory.owned) expect(gearById(id)).toBeDefined();
  });

  it('the pity rule: after enough packs without a rare the next one has one', () => {
    // An rng that always rolls the lowest value: always common without pity.
    const low = (): number => 0;
    let p = newProfile();
    const gear = packById('gear')!;
    for (let i = 0; i < gear.pity!.after - 1; i++) {
      const r = openPack(p, 'gear', low);
      expect(r.drops.every((d) => d.kind === 'gear' && d.item.rarity === 'common')).toBe(true);
      p = r.profile;
    }
    expect(p.inventory.pity.gear).toBe(gear.pity!.after - 1);
    const r = openPack(p, 'gear', low);
    const first = r.drops[0];
    expect(first.kind === 'gear' && first.item.rarity !== 'common').toBe(true);
    expect(r.profile.inventory.pity.gear).toBeUndefined();
  });

  it('boosts are bought one by one into a bag of two', () => {
    const price = CONSUMABLES[0].price;
    const poor = { ...newProfile(), coins: price - 1 };
    expect(boostProblem(poor, CONSUMABLES[0].id)).toMatch(/coins/);
    expect(buyBoost(poor, CONSUMABLES[0].id)).toBeNull();
    let p: Profile = { ...newProfile(), coins: 10000 };
    p = buyBoost(p, CONSUMABLES[0].id)!;
    expect(p.coins).toBe(10000 - price);
    p = buyBoost(p, CONSUMABLES[1].id)!;
    expect(p.inventory.boosts).toEqual([CONSUMABLES[0].id, CONSUMABLES[1].id]);
    expect(boostProblem(p, CONSUMABLES[2].id)).toBe('bag full');
    expect(buyBoost(p, CONSUMABLES[2].id)).toBeNull();
    expect(buyBoost(p, 'nope')).toBeNull();
  });
  it('there is no random boost bundle any more', () => {
    expect(packById('boost')).toBeUndefined();
  });
});

describe('buying and free packs', () => {
  it('buying needs the coins and takes the price', () => {
    const price = packById('gear')!.price;
    const poor = { ...newProfile(), coins: price - 1 };
    expect(canBuy(poor, 'gear')).toBe(false);
    expect(buyPack(poor, 'gear', seededRng(1))).toBeNull();
    const rich = { ...newProfile(), coins: price };
    const bought = buyPack(rich, 'gear', seededRng(1))!;
    const refunds = bought.drops.reduce((a, d) => a + (d.kind === 'gear' ? d.coins : 0), 0);
    expect(bought.profile.coins).toBe(refunds);
  });

  it('a level up brings a free pack, which can be opened once', () => {
    let p = award(newProfile(), { xp: xpToReach(3), coins: 0 });
    expect(levelOf(p.xp)).toBe(3);
    expect(p.inventory.packs[LEVEL_UP_PACK]).toBe(2);
    expect(award(p, { xp: 0, coins: 5 }).inventory.packs[LEVEL_UP_PACK]).toBe(2);
    const r1 = openStockPack(p, LEVEL_UP_PACK, seededRng(2))!;
    expect(r1.profile.inventory.packs[LEVEL_UP_PACK]).toBe(1);
    const r2 = openStockPack(r1.profile, LEVEL_UP_PACK, seededRng(3))!;
    expect(r2.profile.inventory.packs[LEVEL_UP_PACK]).toBeUndefined();
    expect(openStockPack(r2.profile, LEVEL_UP_PACK, seededRng(4))).toBeNull();
    p = newProfile();
    expect(p.inventory).toEqual(newInventory());
  });
});

describe('brand packs', () => {
  it('only drop items of the chosen brand and cost a surcharge', () => {
    const gear = packById('gear')!;
    expect(priceOf(gear, 'noctra')).toBeGreaterThan(gear.price);
    expect(priceOf(gear)).toBe(gear.price);
    const rng = seededRng(7);
    for (let i = 0; i < 40; i++) {
      const r = openPack({ ...newProfile(), coins: 0 }, 'premium', rng, 'noctra');
      for (const d of r.drops) expect(d.item.brand).toBe('noctra');
    }
  });
  it('buying a brand pack charges the surcharge', () => {
    const gear = packById('gear')!;
    const p = { ...newProfile(), coins: 1000 };
    const r = buyPack(p, 'gear', seededRng(1), 'syrix')!;
    expect(r.profile.coins + r.drops.reduce((a, d) => a + d.coins, 0)).toBe(1000 - priceOf(gear, 'syrix'));
    expect(buyPack({ ...p, coins: gear.price }, 'gear', seededRng(1), 'syrix')).toBeNull();
  });
});
