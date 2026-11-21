import { describe, expect, it } from 'vitest';
import levels from '../data/levels.json';
import { STAT_KEYS } from '../game/attributes';
import type { Appearance, PlayerDef } from '../game/types';
import { applyLook, boostOf, canEquip, consumeQueued, CONSUMABLES, equip, GEAR, gearBonus, gearById, itemsOfSlot, MAX_QUEUED, newInventory, sanitizeInventory, SLOTS, syncUnlocks, toggleQueued, unequip, unlockedBetween } from './gear';
import { award, heroFrom, newProfile, spend, xpToReach } from './profile';

const look: Appearance = { gender: 'male', skin: '#c68642', hairStyle: 'short', hairColor: '#111111', shirt: '#e8554e', bottom: '#2b2b5e', bottomStyle: 'shorts', shoes: '#ffffff', racket: '#f2a33a' };

describe('gear data', () => {
  it('every slot has a common, a rare and an epic item; bonuses grow with rarity and use real attributes', () => {
    const size = { common: 1, rare: 2, epic: 3 } as Record<string, number>;
    for (const slot of SLOTS) {
      expect(itemsOfSlot(slot).map((g) => g.rarity)).toEqual(['common', 'rare', 'epic']);
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
  it('a new hero owns the common gear, rare and epic come with the level', () => {
    const inv = newInventory();
    expect(inv.owned).toContain('sho_club');
    expect(inv.owned).not.toContain('sho_power');
    const lvl5 = syncUnlocks(inv, 5);
    expect(lvl5.owned).toContain('sho_power');
    expect(lvl5.owned).not.toContain('rk_pro');
    expect(unlockedBetween(1, 5).map((g) => g.id)).toContain('sho_power');
    expect(syncUnlocks(lvl5, 5)).toBe(lvl5);
  });

  it('equip needs ownership and the level, replaces the slot, and unequip clears it', () => {
    let inv = newInventory();
    expect(canEquip(inv, 'sho_power', 1)).toBe(false);
    expect(equip(inv, 'sho_power', 1)).toBe(inv);
    inv = syncUnlocks(inv, 5);
    expect(canEquip(inv, 'sho_power', 4)).toBe(false);
    inv = equip(equip(inv, 'sho_club', 5), 'sho_power', 5);
    expect(inv.equipped.shoes).toBe('sho_power');
    expect(gearBonus(inv).power).toBe(2);
    expect(unequip(inv, 'shoes').equipped.shoes).toBeUndefined();
  });

  it('colours of equipped items go into the look, the rest stays', () => {
    let inv = syncUnlocks(newInventory(), 12);
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
    p = { ...p, inventory: equip(p.inventory, 'sho_power', 5) };
    expect(heroFrom(base, p).stats.power).toBe(levels.startStat + 2);
    for (let i = 0; i < 20; i++) p = spend(p, 'power');
    expect(heroFrom(base, p).stats.power).toBeLessThanOrEqual(levels.statMax);
  });

  it('queued consumables boost one match and are used up', () => {
    let inv = newInventory();
    inv = toggleQueued(toggleQueued(inv, 'grip_tape'), 'gel');
    const boost = boostOf(inv);
    expect(boost.stats.technique).toBe(2);
    expect(boost.maxGuts).toBe(2);
    const p = { ...newProfile(), inventory: inv };
    expect(heroFrom(base, p, boost).stats.technique).toBe(levels.startStat + 2);
    expect(heroFrom(base, p).stats.technique).toBe(levels.startStat);
    const after = consumeQueued(inv);
    expect(after.queued).toEqual([]);
    expect(after.stock.grip_tape).toBe(inv.stock.grip_tape - 1);
    expect(toggleQueued(inv, 'grip_tape').queued).not.toContain('grip_tape');
  });

  it('you cannot queue more than the limit, nor something you do not have', () => {
    let inv = newInventory();
    for (const c of CONSUMABLES) inv = toggleQueued(inv, c.id);
    expect(inv.queued.length).toBe(MAX_QUEUED);
    expect(toggleQueued({ ...newInventory(), stock: {} }, 'gel').queued).toEqual([]);
  });
});

describe('storage safety', () => {
  it('junk becomes a valid inventory, unknown or unowned or too-high items are dropped', () => {
    expect(sanitizeInventory(null, 1)).toEqual(newInventory());
    const bad = sanitizeInventory({ owned: ['nope', 'sho_club'], equipped: { shoes: 'sho_power', head: 'cap_club', top: 'sho_club' }, stock: { gel: -4, isotonic: 2.9 }, queued: ['gel', 'isotonic', 'isotonic'] }, 1);
    expect(bad.equipped.shoes).toBeUndefined(); // not owned or not unlocked yet
    expect(bad.equipped.top).toBeUndefined(); // wrong slot
    expect(bad.equipped.head).toBe('cap_club'); // common gear is unlocked at level 1 and so owned
    expect(bad.stock.gel).toBe(0);
    expect(bad.stock.isotonic).toBe(2);
    expect(bad.queued).toEqual(['isotonic']);
  });
});
