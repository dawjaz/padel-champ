import { writeFileSync } from 'node:fs';
import { buildToon } from '../../../src/art/toon/character';
import { toSvg } from '../../../src/art/toon/ops';
import { heroLook } from '../../../src/career/profile';
const look = heroLook({ gender: 'male', inventory: { owned: [], equipped: {} } } as never);
console.log(JSON.stringify(look));
for (const pose of ['smashHit', 'smashPrep', 'idle', 'fhHit', 'ovHit'] as const) {
  writeFileSync(`design/brand-proposals/tools/hero_${pose}.svg`, toSvg(buildToon(look, 'front', pose, false), 720));
}
