import { describe, expect, it } from 'vitest';
import levels from '../data/levels.json';
import { STAT_KEYS } from '../game/attributes';
import type { Appearance, PlayerDef } from '../game/types';
import { addBoost, applyLook, boostOf, canEquip, consumeQueued, type Inventory, CONSUMABLES, equip, GEAR, gearBonus, gearById, hasNewIn, BRANDS, ownedOfBrand, setBonusOf, itemsOfBrand, itemsOfSlot, legacyRefund, markSeen, MAX_BOOSTS, MAX_QUEUED, newInventory, sanitizeInventory, SLOTS, syncUnlocks, toggleQueued, unequip, unlockedBetween } from './gear';
import { award, heroFrom, newProfile, spend, xpToReach } from './profile';

const look: Appearance = { gender: 'male', skin: '#c68642', hairStyle: 'short', hairColor: '#111111', shirt: '#e8554e', bottom: '#2b2b5e', bottomStyle: 'shorts', shoes: '#ffffff', racket: '#f2a33a' };

const own = (inv: Inventory, ...ids: string[]): Inventory => ({ ...inv, owned: [...inv.owned, ...ids] });

describe('gear data', () => {
  it('five slots, six brands, four models each (common to legendary): 120 items; bonuses grow with rarity and use real attributes', () => {
    const size = { common: 1, rare: 2, epic: 3, legendary: 4 } as Record<string, number>;
    expect(SLOTS).toEqual(['top', 'shorts', 'shoes', 'racket', 'bag']);
    expect(BRANDS).toHaveLength(6);
    expect(GEAR).toHaveLength(120);
    for (const slot of SLOTS) {
      expect(itemsOfSlot(slot)).toHaveLength(24);
      for (const b of BRANDS) expect(itemsOfBrand(slot, b.id).map((g) => g.rarity), `${b.id} ${slot}`).toEqual(['common', 'rare', 'epic', 'legendary']);
    }
    for (const g of GEAR.filter((x) => x.slot === 'racket')) expect(['diamond', 'teardrop', 'round'], g.id).toContain(g.shape);
    for (const g of GEAR.filter((x) => x.slot !== 'racket')) expect(g.shape, g.id).toBeUndefined();
    for (const g of GEAR) {
      const total = Object.values(g.bonus).reduce((a, b) => a + (b ?? 0), 0);
      expect(total, g.id).toBe(size[g.rarity]);
      for (const k of Object.keys(g.bonus)) expect(STAT_KEYS, g.id).toContain(k);
      expect(/^#[0-9a-f]{6}$/.test(g.color ?? ''), g.id).toBe(true);
      expect(BRANDS.map((b) => b.id), g.id).toContain(g.brand);
    }
    expect(new Set(GEAR.map((g) => g.id)).size).toBe(GEAR.length);
  });
});

describe('inventory', () => {
  it('a new hero owns the five basic items of the all-round brand only; the rest comes from packs', () => {
    const inv = newInventory();
    expect([...inv.owned].sort()).toEqual(SLOTS.map((s) => `adaro_${s}_1`).sort());
    expect(inv.owned).not.toContain('toropad_shoes_2');
    expect(syncUnlocks(inv, 30)).toBe(inv);
    expect(unlockedBetween(1, 30)).toEqual([]);
  });

  it('equip needs ownership and the level, replaces the slot, and unequip clears it', () => {
    let inv = newInventory();
    expect(canEquip(inv, 'toropad_shoes_2', 1)).toBe(false);
    expect(equip(inv, 'toropad_shoes_2', 1)).toBe(inv);
    inv = own(inv, 'toropad_shoes_2');
    expect(canEquip(inv, 'toropad_shoes_2', 4)).toBe(false);
    inv = equip(equip(inv, 'adaro_shoes_1', 5), 'toropad_shoes_2', 5);
    expect(inv.equipped.shoes).toBe('toropad_shoes_2');
    expect(gearBonus(inv).power).toBe(1);
    expect(gearBonus(inv).defense).toBe(1);
    expect(unequip(inv, 'shoes').equipped.shoes).toBeUndefined();
  });

  it('colours and the racket shape of equipped items go into the look, the rest stays', () => {
    let inv = own(newInventory(), 'toropad_racket_4', 'noctra_shoes_3');
    inv = equip(equip(inv, 'toropad_racket_4', 20), 'noctra_shoes_3', 20);
    const a = applyLook(look, inv);
    expect(a.racket).toBe(gearById('toropad_racket_4')!.color);
    expect(a.racketShape).toBe('diamond');
    expect(a.shoes).toBe(gearById('noctra_shoes_3')!.color);
    expect(a.shirt).toBe(look.shirt);
    expect(applyLook(look, newInventory())).toEqual(look);
  });

  it('old gear (first release) is gone and pays coins back by rarity; free starters pay nothing', () => {
    expect(legacyRefund({ owned: ['cap_club', 'sho_club', 'rk_spin', 'cap_pro', 'rk_champ', 'rk_champ', 'nope'] })).toBe(40 + 100 + 250);
    expect(legacyRefund(null)).toBe(0);
    expect(legacyRefund({ owned: ['adaro_racket_1'] })).toBe(0);
    const inv = sanitizeInventory({ owned: ['cap_pro', 'sho_club'], equipped: { shoes: 'sho_club' } }, 30);
    expect(inv.owned).not.toContain('cap_pro');
    expect(inv.equipped.shoes).toBeUndefined();
  });
});

describe('the hero with gear and boosts', () => {
  const base = { id: 'toro', name: 'Toro', stats: {}, maxGuts: 1, appearance: look } as unknown as PlayerDef;

  it('gear adds to the attributes and never past the maximum', () => {
    let p = award(newProfile(), { xp: xpToReach(5), coins: 0 });
    p = { ...p, inventory: equip(own(p.inventory, 'toropad_shoes_2'), 'toropad_shoes_2', 5) };
    expect(heroFrom(base, p).stats.power).toBe(levels.startStat + 1);
    for (let i = 0; i < 20; i++) p = spend(p, 'power');
    expect(heroFrom(base, p).stats.power).toBeLessThanOrEqual(levels.statMax);
  });

  it('the chosen boost lifts one match and is used up', () => {
    let inv = addBoost(addBoost(newInventory(), 'grip_tape'), 'gel');
    inv = toggleQueued(inv, 'grip_tape');
    const boost = boostOf(inv);
    expect(boost.stats.technique).toBe(2);
    expect(boost.maxGuts).toBe(0); // the gel was not chosen
    const p = { ...newProfile(), inventory: inv };
    expect(heroFrom(base, p, boost).stats.technique).toBe(levels.startStat + 2);
    expect(heroFrom(base, p).stats.technique).toBe(levels.startStat);
    const after = consumeQueued(inv);
    expect(after.queued).toEqual([]);
    expect(after.boosts).toEqual(['gel']);
    expect(toggleQueued(inv, 'grip_tape').queued).toEqual([]); // tapping again takes the pick back
  });

  it('the bag holds two boosts at most, one can be picked per match, and only a boost from the bag', () => {
    let inv = newInventory();
    expect(inv.boosts).toEqual([]);
    for (const c of CONSUMABLES) inv = addBoost(inv, c.id);
    expect(inv.boosts.length).toBe(MAX_BOOSTS);
    expect(MAX_BOOSTS).toBe(2);
    expect(addBoost(newInventory(), 'nope').boosts).toEqual([]);
    inv = toggleQueued(toggleQueued(inv, inv.boosts[0]), inv.boosts[1]);
    expect(inv.queued).toEqual([inv.boosts[1]]);
    expect(inv.queued.length).toBeLessThanOrEqual(MAX_QUEUED);
    expect(toggleQueued(newInventory(), 'gel').queued).toEqual([]);
  });

  it('new gear that can be worn marks its category until the slot is opened', () => {
    let inv = newInventory();
    for (const s of SLOTS) expect(hasNewIn(inv, s, 1), s).toBe(false); // the starting gear is not news
    const rare = GEAR.find((g) => g.rarity === 'rare' && g.minLevel <= 5)!;
    inv = { ...inv, owned: [...inv.owned, rare.id] };
    expect(hasNewIn(inv, rare.slot, 1)).toBe(false); // owned, but cannot be worn yet
    expect(hasNewIn(inv, rare.slot, rare.minLevel)).toBe(true);
    for (const s of SLOTS) if (s !== rare.slot) expect(hasNewIn(inv, s, rare.minLevel), s).toBe(false);
    const opened = markSeen(inv, rare.slot, rare.minLevel);
    expect(hasNewIn(opened, rare.slot, rare.minLevel)).toBe(false);
    expect(markSeen(opened, rare.slot, rare.minLevel)).toBe(opened);
  });
});

describe('old saves', () => {
  it('a stock of boosts becomes a bag of at most two, and all owned gear counts as seen (no surprise stars)', () => {
    const old = sanitizeInventory({ owned: ['sho_club', 'cap_club'], stock: { isotonic: 2, gel: 2, grip_tape: 2 }, queued: ['gel'] }, 1);
    expect(old.boosts).toEqual(['isotonic', 'isotonic']);
    expect(old.queued).toEqual([]); // not in the bag any more
    for (const s of SLOTS) expect(hasNewIn(old, s, 30), s).toBe(false);
    const saved = sanitizeInventory(JSON.parse(JSON.stringify({ ...old, seen: [] })), 1);
    expect(saved.seen).toEqual([]); // a save that has `seen` keeps it: those items are new
  });
});

describe('storage safety', () => {
  it('junk becomes a valid inventory, unknown or unowned or too-high items are dropped', () => {
    expect(sanitizeInventory(null, 1)).toEqual(newInventory());
    const bad = sanitizeInventory({ owned: ['nope', 'adaro_shoes_1'], packs: { gear: 2.7, nope: 5 }, pity: { gear: -1 }, equipped: { shoes: 'toropad_shoes_2', racket: 'adaro_racket_1', top: 'adaro_shoes_1', head: 'cap_club' }, boosts: ['gel', 'nope', 'isotonic', 'gel'], queued: ['gel', 'isotonic', 'isotonic'] }, 1);
    expect(bad.equipped.shoes).toBeUndefined(); // not owned or not unlocked yet
    expect(bad.equipped.top).toBeUndefined(); // wrong slot
    expect(bad.equipped.racket).toBe('adaro_racket_1'); // a starter is unlocked at level 1 and so owned
    expect(Object.keys(bad.equipped)).not.toContain('head'); // the cap slot is gone
    expect(bad.packs).toEqual({ gear: 2 });
    expect(bad.pity).toEqual({});
    expect(bad.boosts).toEqual(['gel', 'isotonic']); // unknown dropped, at most two
    expect(bad.queued).toEqual(['gel']); // one pick, and it has to be in the bag
  });
});

describe('brand set bonus', () => {
  const wear = (brand: string, slots: readonly string[]): Inventory => {
    let inv = newInventory();
    for (const s of slots) {
      inv = own(inv, `${brand}_${s}_1`);
      inv = equip(inv, `${brand}_${s}_1`, 1);
    }
    return inv;
  };
  const SIX = ['top', 'shorts', 'shoes', 'racket', 'bag'] as const;
  const base = (inv: Inventory): number => Object.values(gearBonus(inv)).reduce((a, b) => a + b, 0);
  const rawSum = (inv: Inventory): number => SLOTS.reduce((a, s) => a + Object.values(gearById(inv.equipped[s] ?? '')?.bonus ?? {}).reduce((x, y) => x + (y ?? 0), 0), 0);
  it('two pieces give nothing, three give +1 to the first stat, five +1 to two', () => {
    expect(setBonusOf(wear('bavole', SIX.slice(0, 2)))?.stats).toEqual([]);
    expect(base(wear('bavole', SIX.slice(0, 2)))).toBe(rawSum(wear('bavole', SIX.slice(0, 2))));
    const three = wear('bavole', SIX.slice(0, 3));
    expect(setBonusOf(three)?.stats).toEqual(['power']);
    expect(base(three)).toBe(rawSum(three) + 1);
    const five = wear('bavole', SIX);
    expect(setBonusOf(five)?.stats).toEqual(['power', 'spin']);
    expect(base(five)).toBe(rawSum(five) + 2);
  });
  it('mixed brands: the brand with the most pieces counts; nothing equipped gives none', () => {
    expect(setBonusOf({ ...newInventory(), equipped: {} })).toBeNull();
    let inv = wear('toropad', ['top', 'shorts', 'shoes']);
    inv = equip(own(inv, 'syrix_racket_1'), 'syrix_racket_1', 1);
    expect(setBonusOf(inv)?.brand.id).toBe('toropad');
  });
  it('every brand has two set stats and owned counts per brand', () => {
    for (const b of BRANDS) expect(b.set).toHaveLength(2);
    expect(ownedOfBrand(newInventory(), 'adaro')).toBe(5);
    expect(ownedOfBrand(newInventory(), 'bavole')).toBe(0);
  });
});
