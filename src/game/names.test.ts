import { describe, expect, it } from 'vitest';
import playersData from '../data/players.json';
import partners from '../data/partners.json';
import opponents from '../data/opponents.json';
import { sanitizeProfile } from '../career/profile';
import { cleanName, MAX_NAME, MAX_NICK, withNick } from './names';

describe('cleanName', () => {
  it('title-cases and trims', () => expect(cleanName('  dANi   boy ', 20, 'x')).toBe('Dani Boy'));
  it('drops odd characters', () => expect(cleanName('Da<n>i!', 10, 'x')).toBe('Dani'));
  it('cuts to the maximum', () => expect(cleanName('abcdefghijklmnop', MAX_NAME, 'x')).toBe('Abcdefghij'));
  it('falls back when nothing is left', () => {
    expect(cleanName('   ', 10, 'Dani')).toBe('Dani');
    expect(cleanName(42, 10, 'Dani')).toBe('Dani');
    expect(cleanName('!!!', 10, 'Dani')).toBe('Dani');
  });
  it('keeps hyphens and apostrophes', () => expect(cleanName("o'neil-jr", MAX_NICK, 'x')).toBe("O'Neil-Jr"));
});

describe('withNick', () => {
  it('puts the nickname in quotes after the name', () => expect(withNick({ name: 'Adam', nick: 'Anvil' })).toBe('Adam "Anvil"'));
  it('is just the name without a nickname', () => expect(withNick({ name: 'Adam' })).toBe('Adam'));
});

describe('every player has a nickname', () => {
  it('hero choices and CPU players', () => {
    for (const p of [...playersData.you, ...playersData.cpu]) expect(p.nick, p.id).toBeTruthy();
  });
  it('partners', () => {
    for (const p of partners.partners) expect(p.nick, p.id).toBeTruthy();
  });
  it('every opponent first name', () => {
    for (const f of opponents.first) expect((opponents.nicks as Record<string, string>)[f], f).toBeTruthy();
  });
  it('nicknames fit the field', () => {
    const all = [...playersData.you, ...playersData.cpu, ...partners.partners].map((p) => p.nick).concat(Object.values(opponents.nicks));
    for (const n of all) expect(n.length).toBeLessThanOrEqual(MAX_NICK);
  });
});

describe('profile name', () => {
  it('has a default name and nickname', () => {
    const p = sanitizeProfile(undefined);
    expect(p.name).toBe('Dani');
    expect(p.nick).toBe('Thunder');
  });
  it('keeps a valid custom name and cleans a bad one', () => {
    expect(sanitizeProfile({ name: 'Pawel', nick: 'The Boss' })).toMatchObject({ name: 'Pawel', nick: 'The Boss' });
    expect(sanitizeProfile({ name: '###', nick: 7 })).toMatchObject({ name: 'Dani', nick: 'Thunder' });
  });
});
