import { describe, expect, it } from 'vitest';
import { activeBracket, buyPartner, choosePartner, enterEvent, entryCheck, reportMatch, skipWeek, tournamentActive, withdraw } from './careerFlow';
import { award, levelOf, newProfile, sanitizeProfile, xpToReach, type Profile } from './profile';
import { advanceWeek, entryProblem, eventsOfWeek, EVENTS, newCareer, PARTNERS, sanitizeCareer, WEEKS } from './season';
import { divisionById } from './tournament';

const clubWeek1 = EVENTS.find((e) => e.id === 'club-w1')!;

describe('calendar', () => {
  it('every week has an event and every division appears', () => {
    for (let w = 1; w <= WEEKS; w++) expect(eventsOfWeek(w).length, `week ${w}`).toBeGreaterThan(0);
    for (const id of ['club', 'regional', 'rise', 'bronze', 'silver', 'gold', 'platinum', 'p2', 'p1', 'major', 'finals']) {
      expect(EVENTS.some((e) => e.division === id), id).toBe(true);
    }
  });

  it('a new season starts after the last week and part of the ranking carries over', () => {
    let c = { ...newCareer(), week: WEEKS, rankPoints: 1001 };
    c = advanceWeek(c);
    expect(c.season).toBe(2);
    expect(c.week).toBe(1);
    expect(c.rankPoints).toBe(500);
    expect(advanceWeek(newCareer()).week).toBe(2);
  });

  it('entry gates: week, level, ranking points, coins, one tournament at a time', () => {
    const c = newCareer();
    expect(entryProblem(c, 1, 0, clubWeek1)).toBeNull();
    const major = EVENTS.find((e) => e.division === 'major')!;
    expect(entryProblem(c, 1, 0, major)).toBe('not this week');
    const reg = EVENTS.find((e) => e.id === 'regional-w2')!;
    expect(/level/.test(entryProblem({ ...c, week: 2 }, 2, 999, reg) ?? '')).toBe(true);
    expect(/fee/.test(entryProblem({ ...c, week: 2 }, 3, 5, reg) ?? '')).toBe(true);
    expect(entryProblem({ ...c, week: 2 }, 3, 20, reg)).toBeNull();
    const p1 = EVENTS.find((e) => e.division === 'p2')!;
    expect(/ranking/.test(entryProblem({ ...c, week: p1.week }, 30, 9999, p1) ?? '')).toBe(true);
    expect(/finish/.test(entryProblem({ ...c, active: { eventId: 'club-w1', seed: 1, results: [] } }, 1, 0, clubWeek1) ?? '')).toBe(true);
    expect(entryProblem({ ...c, week: 3 }, 1, 0, clubWeek1)).toBe('already played');
  });
});

describe('a tournament run', () => {
  it('entering charges the fee, winning every round pays the title, ranks you up and moves the week', () => {
    const p0: Profile = { ...newProfile(), coins: 100 };
    const reg = EVENTS.find((e) => e.id === 'regional-w2')!;
    let p: Profile = award(skipWeek(p0), { xp: xpToReach(3), coins: 0 });
    expect(entryCheck(p, reg)).toBeNull();
    p = enterEvent(p, reg.id, 77)!;
    expect(p.coins).toBe(100 - divisionById('regional')!.fee);
    expect(enterEvent(p, reg.id, 1)).toBeNull(); // already in
    expect(activeBracket(p)!.status).toBe('active');
    const coinsBefore = p.coins;
    let finished;
    for (let r = 0; r < 4; r++) {
      const rep = reportMatch(p, true);
      p = rep.profile;
      finished = rep.finished;
    }
    expect(finished).toBeDefined();
    expect(finished!.champion).toBe(true);
    expect(finished!.lostFinal).toBe(false);
    expect(p.career.active).toBeNull();
    expect(p.career.week).toBe(3);
    expect(p.career.titles).toBe(1);
    expect(p.career.rankPoints).toBe(divisionById('regional')!.title.rank);
    expect(p.coins).toBe(coinsBefore + divisionById('regional')!.title.coins);
    expect(p.inventory.packs.gear).toBeGreaterThan(0);
    expect(p.career.history[p.career.history.length - 1].champion).toBe(true);
  });

  it('a first-round loss ends it with no prize but the week moves on; skipping a week needs no tournament', () => {
    let p = enterEvent(newProfile(), 'club-w1', 5)!;
    const rep = reportMatch(p, false);
    expect(rep.finished!.roundsWon).toBe(0);
    expect(rep.finished!.lostFinal).toBe(false);
    expect(rep.finished!.prize.coins).toBe(0);
    expect(rep.profile.career.week).toBe(2);
    expect(rep.profile.career.titles).toBe(0);
    p = enterEvent(newProfile(), 'club-w1', 5)!;
    expect(skipWeek(p)).toBe(p);
    expect(reportMatch(newProfile(), true).finished).toBeUndefined();
  });

  it('losing the final is a lost final (the runner-up), not an early exit', () => {
    let p = enterEvent(newProfile(), 'club-w1', 7)!;
    const rounds = activeBracket(p)!.roundNames.length;
    let fin;
    for (let r = 0; r < rounds; r++) {
      const rep = reportMatch(p, r < rounds - 1);
      p = rep.profile;
      fin = rep.finished;
    }
    expect(fin!.champion).toBe(false);
    expect(fin!.lostFinal).toBe(true);
  });

  it('withdrawing pays for the rounds won so far', () => {
    let p = enterEvent(newProfile(), 'club-w1', 9)!;
    p = reportMatch(p, true).profile;
    const f = withdraw(p)!;
    expect(f.roundsWon).toBe(1);
    expect(f.champion).toBe(false);
    expect(f.prize.coins).toBe(Math.round(divisionById('club')!.title.coins * 0.2));
    expect(f.profile.career.active).toBeNull();
    expect(withdraw(newProfile())).toBeNull();
  });
});

describe('rewards during a tournament', () => {
  it('match rewards are kept until the tournament ends: no XP, coins, level or packs change before', () => {
    let p = enterEvent({ ...newProfile(), coins: 50 }, 'club-w1', 3)!;
    expect(tournamentActive(p)).toBe(true);
    const before = { xp: p.xp, coins: p.coins, packs: { ...p.inventory.packs } };
    const rep = reportMatch(p, true, { xp: 40, coins: 25 });
    expect(rep.finished).toBeUndefined();
    p = rep.profile;
    expect(p.xp).toBe(before.xp);
    expect(p.coins).toBe(before.coins);
    expect(p.inventory.packs).toEqual(before.packs);
    expect(p.career.active!.pending).toEqual({ xp: 40, coins: 25 });
  });

  it('they are paid out with the prize at the end, and a level up (with its free pack) comes only then', () => {
    let p = enterEvent(newProfile(), 'club-w1', 3)!;
    const big = xpToReach(3);
    let finished;
    for (let r = 0; r < 4 && !finished; r++) {
      const rep = reportMatch(p, true, { xp: big, coins: 10 });
      p = rep.profile;
      finished = rep.finished;
      if (!finished) expect(levelOf(p.xp)).toBe(1);
    }
    expect(finished).toBeDefined();
    expect(finished!.matches.coins).toBeGreaterThanOrEqual(10);
    expect(finished!.matches.xp).toBeGreaterThanOrEqual(big);
    expect(levelOf(p.xp)).toBeGreaterThan(1);
    expect(p.coins).toBe(finished!.matches.coins + finished!.prize.coins);
    expect(p.inventory.packs.gear ?? 0).toBeGreaterThan(0);
    expect(tournamentActive(p)).toBe(false);
  });

  it('a lost match ends the tournament and pays what the matches earned; withdrawing pays the pending reward too', () => {
    const lost = reportMatch(enterEvent(newProfile(), 'club-w1', 5)!, false, { xp: 20, coins: 15 });
    expect(lost.finished!.matches).toEqual({ xp: 20, coins: 15 });
    expect(lost.profile.xp).toBe(20);
    expect(lost.profile.coins).toBe(15);
    let p = enterEvent(newProfile(), 'club-w1', 9)!;
    p = reportMatch(p, true, { xp: 30, coins: 12 }).profile;
    const f = withdraw(p)!;
    expect(f.profile.coins).toBe(12 + f.prize.coins);
    expect(f.profile.xp).toBe(30 + f.prize.xp);
  });

  it('the pending reward survives a save (sanitize) and bad values are cut', () => {
    let p = enterEvent(newProfile(), 'club-w1', 3)!;
    p = reportMatch(p, true, { xp: 40, coins: 25 }).profile;
    expect(sanitizeCareer(JSON.parse(JSON.stringify(p.career))).active!.pending).toEqual({ xp: 40, coins: 25 });
    const bad = JSON.parse(JSON.stringify(p.career));
    bad.active.pending = { xp: -5, coins: 'x' };
    expect(sanitizeCareer(bad).active!.pending).toEqual({ xp: 0, coins: 0 });
  });
});

describe('partners', () => {
  it('there are 10, the default is the weakest and free, and they get better and dearer in order', () => {
    expect(PARTNERS).toHaveLength(10);
    const rating = (i: number): number => Object.values(PARTNERS[i].stats).reduce((a, b) => a + b, 0);
    expect(PARTNERS[0].price).toBe(0);
    for (let i = 1; i < PARTNERS.length; i++) {
      expect(PARTNERS[i].price).toBeGreaterThan(PARTNERS[i - 1].price);
      expect(rating(i)).toBeGreaterThanOrEqual(rating(i - 1));
    }
    expect(Math.min(...PARTNERS.map((_, i) => rating(i)))).toBe(rating(0));
  });
  it('the hero starts with the default, buys others with coins and can switch between owned ones', () => {
    const p = { ...newProfile(), coins: 1000, xp: xpToReach(3) };
    expect(p.career.partnerId).toBe(PARTNERS[0].id);
    expect(buyPartner({ ...p, coins: 10 }, 'lena')).toBeNull();
    const bought = buyPartner(p, 'lena')!;
    expect(bought.career.partnerId).toBe('lena');
    expect(bought.coins).toBe(1000 - 200);
    expect(buyPartner(bought, 'lena')).toBeNull();
    expect(choosePartner(bought, 'olek').career.partnerId).toBe('olek');
    expect(choosePartner(bought, 'diego')).toBe(bought);
  });
  it('a stronger partner needs the level of the divisions he is made for, however many coins there are', () => {
    const rich = { ...newProfile(), coins: 100000 };
    expect(buyPartner(rich, 'lena')).toBeNull();
    expect(buyPartner({ ...rich, xp: xpToReach(3) }, 'lena')).not.toBeNull();
    expect(buyPartner({ ...rich, xp: xpToReach(26) }, 'ana')).toBeNull();
    expect(buyPartner({ ...rich, xp: xpToReach(27) }, 'ana')).not.toBeNull();
  });
});

describe('storage safety', () => {
  it('junk becomes a valid career and cheating on the partner or the week is cut', () => {
    expect(sanitizeCareer(null)).toEqual(newCareer());
    const c = sanitizeCareer({ season: -2, week: 99, rankPoints: 'x', partnerId: 'diego', partners: ['nope', 'lena'], active: { eventId: 'zzz', seed: 1, results: [true] }, history: [{ event: 'x', division: 'zzz' }] });
    expect(c.season).toBe(1);
    expect(c.week).toBe(WEEKS);
    expect(c.rankPoints).toBe(0);
    expect(c.partners).toEqual(['olek', 'lena']);
    expect(c.partnerId).toBe('olek');
    expect(c.active).toBeNull();
    expect(c.history).toEqual([]);
    const ok = sanitizeProfile({ career: { active: { eventId: 'club-w1', seed: 4.7, results: [true, 'x', false] } } });
    expect(ok.career.active).toEqual({ eventId: 'club-w1', seed: 4, results: [true, false] });
  });
});
