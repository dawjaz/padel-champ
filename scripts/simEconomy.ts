// Career pace simulation: how fast does a player climb the divisions? Run: npx vite-node scripts/simEconomy.ts [edge] [seasons] [runs]
// Model (rough): a player who plays the best event he can enter every week, spreads his points evenly up to the cap, buys the best
// partner he can afford and wins a match with a probability that depends on the strength of his pair against the division rating.
// `edge` = how much better than the CPU AI the human plays, in rating points (0 = as good as the AI). No gear (see the notes).
import partnersData from '../src/data/partners.json';
import { advanceWeek, entryProblem, eventsOfWeek, newCareer, WEEKS } from '../src/career/season';
import { divisionById, prizeFor } from '../src/career/tournament';
import { levelOf, matchReward, pointsEarned, statCap } from '../src/career/profile';
import { seededRng } from '../src/game/rng';

const edge = Number(process.argv[2] ?? 0.5);
const seasons = Number(process.argv[3] ?? 6);
const runs = Number(process.argv[4] ?? 200);
const XPS = Number(process.env.XPS ?? 1); // scales XP of prizes and matches (what-if)
const CS = Number(process.env.CS ?? 1); // scales coins of prizes and matches
const K = 1.1; // logistic slope fitted to the match simulation (scripts/simBalance.ts career)
const list = partnersData.partners as unknown as Array<{ id: string; price: number; minLevel: number; stats: Record<string, number> }>;
const avg = (s: Record<string, number>): number => Object.values(s).reduce((a, b) => a + b, 0) / Object.values(s).length;

interface Row { level: number; coins: number; rank: number; bestDiv: string; titles: number; partner: string; played: number; heroAvg: number }
const sum: Row[][] = Array.from({ length: seasons }, () => []);
const reach: Record<string, number[]> = {};

for (let run = 0; run < runs; run++) {
  const rng = seededRng(900 + run);
  let career = newCareer();
  let xp = 0, coins = 0, titles = 0, played = 0;
  let partner = list[0];
  const owned = new Set([partner.id]);
  let bestRank = 0;
  let bestDiv = 'none';
  for (let season = 1; season <= seasons; season++) {
    const startWeek = career.week;
    void startWeek;
    for (let w = 1; w <= WEEKS; w++) {
      const level = levelOf(xp);
      // best affordable partner (keep some coins for the entry fee)
      for (const p of list) if (!owned.has(p.id) && p.minLevel <= level && p.price <= coins - 60 && avg(p.stats) > avg(partner.stats)) { coins -= p.price; owned.add(p.id); partner = p; }
      const cap = statCap(level);
      const heroAvg = Math.min(cap, 4 + pointsEarned(level) / 7);
      const strength = (heroAvg + avg(partner.stats)) / 2 + edge;
      const options = eventsOfWeek(career.week).filter((e) => entryProblem(career, level, coins, e) === null);
      let event = options.sort((a, b) => (divisionById(b.division)!.rating - divisionById(a.division)!.rating))[0];
      if (event) {
        const div = divisionById(event.division)!;
        coins -= div.fee;
        let won = 0, mxp = 0, mcoins = 0;
        for (let r = 0; r < (div.draw === 8 ? 3 : 4); r++) {
          const p = 1 / (1 + Math.exp(-(strength - div.rating) * K));
          const win = rng() < p;
          const rw = matchReward({ won: win, pointsWon: win ? 8 : 5, pointsLost: win ? 5 : 8, longestRally: 10 });
          mxp += rw.xp; mcoins += rw.coins;
          if (!win) break;
          won++;
        }
        const prize = prizeFor(div, won);
        xp += (prize.xp + mxp) * XPS;
        coins += (prize.coins + mcoins) * CS;
        career = { ...career, rankPoints: career.rankPoints + prize.rank };
        played++;
        if (won === (div.draw === 8 ? 3 : 4)) titles++;
        if (div.rating > (divisionById(bestDiv)?.rating ?? 0)) bestDiv = div.id;
        (reach[div.id] ??= []);
        if (reach[div.id].length <= run) reach[div.id][run] = (season - 1) * WEEKS + w;
        bestRank = Math.max(bestRank, career.rankPoints);
      }
      career = advanceWeek(career);
    }
    sum[season - 1].push({ level: levelOf(xp), coins, rank: Math.round(career.rankPoints), bestDiv, titles, partner: partner.id, played, heroAvg: Math.min(statCap(levelOf(xp)), 4 + pointsEarned(levelOf(xp)) / 7) });
  }
}
console.log(`human edge ${edge}, ${runs} runs, ${WEEKS} weeks per season`);
const med = (a: number[]): number => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
sum.forEach((rows, i) => {
  const divs: Record<string, number> = {};
  rows.forEach((r) => (divs[r.bestDiv] = (divs[r.bestDiv] ?? 0) + 1));
  const top = Object.entries(divs).sort((a, b) => b[1] - a[1])[0][0];
  const partners: Record<string, number> = {};
  rows.forEach((r) => (partners[r.partner] = (partners[r.partner] ?? 0) + 1));
  const tp = Object.entries(partners).sort((a, b) => b[1] - a[1])[0][0];
  console.log(`end of season ${i + 1}: level ${med(rows.map((r) => r.level))}  coins ${med(rows.map((r) => r.coins))}  rank ${med(rows.map((r) => r.rank))}  titles ${med(rows.map((r) => r.titles))}  tournaments ${med(rows.map((r) => r.played))}  best division (most common) ${top}  partner ${tp}`);
});
console.log('median week (counted from the start) when a division was first entered:');
console.log(Object.entries(reach).map(([d, a]) => `${d} w${med(a.filter((x) => x !== undefined))} (${a.filter((x) => x !== undefined).length}/${runs})`).join('  '));
