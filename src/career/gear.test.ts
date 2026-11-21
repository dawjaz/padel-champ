import { describe, expect, it } from 'vitest';
import levels from '../data/levels.json';
import { STAT_KEYS } from '../game/attributes';
import type { Appearance, PlayerDef } from '../game/types';
import { addBoost, applyLook, boostOf, canEquip, consumeQueued, type Inventory, CONSUMABLES, equip, GEAR, gearBonus, gearById, hasNewIn, itemsOfSlot, markSeen, MAX_BOOSTS, MAX_QUEUED, newInventory, sanitizeInventory, SLOTS, syncUnlocks, toggleQueued, unequip, unlockedBetween } from './gear';
import { award, heroFrom, newProfile, spend, xpToReach } from './profile';

const look: Appearance = { gender: 'male', skin: '#c68642', hairStyle: 'short', hairColor: '#111111', shirt: '#e8554e', bottom: '#2b2b5e', bottomStyle: 'shorts', shoes: '#ffffff', racket: '#f2a33a' };

const own = (inv: Inventory, ...ids: string[]): Inventory => ({ ...inv, owned: [...inv.owned, ...ids] });

describe('gear data', () => {
  it('every slot has a common, a rare, an epic and a legendary item; bonuses grow with rarity and use real attributes', () => {
    const size = { common: 1, rare: 2, epic: 3, legendary: 4 } as Record<string, number>;
    for (const slot of SLOTS) {
      expect(itemsOfSlot(slot).map((g) => g.rarity)).toEqual(['common', 'rare', 'epic', 'legendary']);
    }
    for (const g of GEAR) {
      const total = Object.values(g.bonus).reduce((a, b) => a + (b ?? 0), 0);
      expect(total, g.id).toBe(size[g.rarity]);
      for (const k of Object.keys(g.bonus)) expect(STAT_KEYS, g.id).toContain(k);
      if (g.slot !== 'bag' && g.slot !== 'balls') expect(/^#[0-9a-f]{6}$/.test(g.color ?? ''), g.id).toBe(true);
    }
    expect(new Set(GEAR.map((g) => g.id)).size).toBe(GEAR.length);
  });
});

describe('inventory', () => {
  it('a new hero owns the common gear only; the rest comes from packs', () => {
    const inv = newInventory();
    expect(inv.owned).toContain('sho_club');
    expect(inv.owned).not.toContain('sho_power');
    expect(syncUnlocks(inv, 30)).toBe(inv);
    expect(unlockedBetween(1, 30)).toEqual([]);
  });

  it('equip needs ownership and the level, replaces the slot, and unequip clears it', () => {
    let inv = newInventory();
    expect(canEquip(inv, 'sho_power', 1)).toBe(false);
    expect(equip(inv, 'sho_power', 1)).toBe(inv);
    inv = own(inv, 'sho_power');
    expect(canEquip(inv, 'sho_power', 4)).toBe(false);
    inv = equip(equip(inv, 'sho_club', 5), 'sho_power', 5);
    expect(inv.equipped.shoes).toBe('sho_power');
    expect(gearBonus(inv).power).toBe(2);
    expect(unequip(inv, 'shoes').equipped.shoes).toBeUndefined();
  });

  it('colours of equipped items go into the look, the rest stays', () => {
    let inv = own(newInventory(), 'cap_pro', 'sho_power', 'wb_pro');
    inv = equip(equip(equip(inv, 'cap_pro', 12), 'sho_power', 12), 'wb_pro', 12);
    const a = applyLook(look, inv);
    expect(a.cap).toBe(gearById('cap_pro')!.color);
    expect(a.shoes).toBe(gearById('sho_power')!.color);
    expect(a.wristband).toBe(gearById('wb_pro')!.color);
    expect(a.shirt).toBe(look.shirt);
    expect(applyLook(look, newInventory())).toEqual(look);
  });
});

describe('the hero with gear and boosts', () => {
  const base = { id: 'toro', name: 'Toro', stats: {}, maxGuts: 1, appearance: look } as unknown as PlayerDef;

  it('gear adds to the attributes and never past the maximum', () => {
    let p = award(newProfile(), { xp: xpToReach(5), coins: 0 });
    p = { ...p, inventory: equip(own(p.inventory, 'sho_power'), 'sho_power', 5) };
    expect(heroFrom(base, p).stats.power).toBe(levels.startStat + 2);
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
    const bad = sanitizeInventory({ owned: ['nope', 'sho_club'], packs: { gear: 2.7, nope: 5 }, pity: { gear: -1 }, equipped: { shoes: 'sho_power', head: 'cap_club', top: 'sho_club' }, boosts: ['gel', 'nope', 'isotonic', 'gel'], queued: ['gel', 'isotonic', 'isotonic'] }, 1);
    expect(bad.equipped.shoes).toBeUndefined(); // not owned or not unlocked yet
    expect(bad.equipped.top).toBeUndefined(); // wrong slot
    expect(bad.equipped.head).toBe('cap_club'); // common gear is unlocked at level 1 and so owned
    expect(bad.packs).toEqual({ gear: 2 });
    expect(bad.pity).toEqual({});
    expect(bad.boosts).toEqual(['gel', 'isotonic']); // unknown dropped, at most two
    expect(bad.queued).toEqual(['gel']); // one pick, and it has to be in the bag
  });
});
