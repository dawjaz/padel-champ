import { describe, expect, it } from 'vitest';
import { lookup } from './i18n';

/** Every literal text passed to T('...') in the code has a Spanish version (names that stay the same are in the table too). */
const sources = import.meta.glob(['./**/*.ts', '!./**/*.test.ts', '!./i18n.ts', '!./i18n/**'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('T() literals in the source', () => {
  it('all have a Spanish entry', () => {
    const gaps = new Set<string>();
    for (const src of Object.values(sources)) {
      for (const m of src.matchAll(/\bT\(\s*'((?:[^'\\]|\\.)*)'/g)) {
        const text = m[1].replace(/\\'/g, "'").replace(/\\n/g, '\n');
        if (/[A-Za-z]{3,}/.test(text) && lookup(text) === undefined) gaps.add(text);
      }
    }
    expect([...gaps]).toEqual([]);
  });
});
