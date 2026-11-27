// Language of the interface. Pure (no Phaser), tested.
//
// The key of every text is the English text itself: `T('SETTINGS')` gives 'SETTINGS' in English and the Spanish entry from
// `src/i18n/es.ts` when the language is Spanish. A missing entry falls back to English (a test lists the gaps). Placeholders
// are `{0}`, `{1}`... : `T('LEVEL {0}', 5)`.
//
// Names that are Spanish padel terms (Bandeja, Vibora, Bajada, Dejada, Chiquita, Rulo, Por Tres, Por Cuatro, Contrapared,
// Bloqueo...) are the same in both languages: they are not in the Spanish table on purpose.

import { ES, patternEs } from './i18n/es';
import { phrase } from './i18n/phrases';

export type Lang = 'en' | 'es';
export const LANGS: Lang[] = ['en', 'es'];
export const LANG_LABEL: Record<Lang, string> = { en: 'ENGLISH', es: 'ESPAÑOL' };

let current: Lang = 'en';
let spanishValues: Set<string> | null = null;
/** Texts that were built from translated parts and are final (not looked up again). */
const finals = new Set<string>();
/** Marks a text built from translated parts (e.g. `done(`${T('LEVEL')} 5`)`): shown as it is, not reported as a gap. */
export const done = (text: string): string => {
  finals.add(text);
  return text;
};

/** True when the text already is a Spanish translation (so it is not a gap). */
const isSpanish = (text: string): boolean => {
  if (!spanishValues) spanishValues = new Set(Object.values(ES));
  return spanishValues.has(text);
};
/** Keys looked up in Spanish that have no Spanish text yet (collected for the test, see `missingTexts`). */
const missing = new Set<string>();

export const getLang = (): Lang => current;
export const setLang = (l: Lang): void => {
  current = l === 'es' ? 'es' : 'en';
  if (import.meta.env.DEV) devShared().lang = current;
};

const norm = (t: string): string => t.replace(/\s+/g, ' ').trim().toLowerCase();
let ci: Map<string, string> | null = null;
const isUpper = (t: string): boolean => t === t.toUpperCase() && t !== t.toLowerCase();
const sentence = (t: string): string => (t.length === 0 ? t : t[0] + t.slice(1).toLowerCase());

/** One line: the exact entry, else the same words in another case or spacing (shown in the case it was asked in), else a gear name or a sentence built from parts. */
function lookupLine(text: string, depth = 0): string | undefined {
  const exact = ES[text];
  if (exact !== undefined) return exact;
  if (!ci) {
    ci = new Map();
    for (const [k, v] of Object.entries(ES)) if (!ci.has(norm(k))) ci.set(norm(k), v);
  }
  const v = ci.get(norm(text)) ?? patternEs(text) ?? phrase(text, (part, d) => lookupLine(part, d) ?? part, depth);
  if (v === undefined) return undefined;
  if (isUpper(text)) return v.toUpperCase();
  return isUpper(v) ? sentence(v) : v;
}

/** The Spanish text for an English one (several lines are translated line by line), or undefined when nothing in it is known. */
export function lookup(text: string): string | undefined {
  const whole = lookupLine(text);
  if (whole !== undefined || !text.includes('\n')) return whole;
  const lines = text.split('\n');
  const out = lines.map((l) => lookupLine(l));
  return out.some((o) => o !== undefined) ? lines.map((l, i) => out[i] ?? l).join('\n') : undefined;
}

/** Lines of a text (or the text itself) with no Spanish version, for the gap report. */
function unknownParts(text: string): string[] {
  if (lookupLine(text) !== undefined) return [];
  if (!text.includes('\n')) return [text];
  return text.split('\n').filter((l) => lookupLine(l) === undefined && /[A-Za-z]{4,}/.test(l));
}

/** The translation of an English text in the current language (English when there is none). */
export function T(text: string, ...args: unknown[]): string {
  const es = current === 'es' ? lookup(text) : undefined;
  if (current === 'es' && text.trim() !== '' && !isSpanish(text) && !finals.has(text)) {
    for (const part of unknownParts(text)) {
      if (part.trim() === '' || isSpanish(part)) continue;
      missing.add(part);
      if (import.meta.env.DEV) devShared().missing.add(part);
    }
  }
  const out = es ?? text;
  return args.length === 0 ? out : out.replace(/\{(\d+)\}/g, (m, i: string) => (args[Number(i)] !== undefined && args[Number(i)] !== null ? String(args[Number(i)]) : m));
}

/** The Spanish text for display (no placeholders, no gap report): used for texts that were already translated once or are set directly. */
export function show(text: string): string {
  if (current !== 'es') return text;
  if (import.meta.env.DEV) for (const part of unknownParts(text)) if (!isSpanish(part) && /[A-Za-z]{4,}/.test(part)) devShared().direct.add(part);
  return lookup(text) ?? text;
}

/** Like `T` for a name from a data file: the English name with an optional Spanish one given by the data (`es` field). */
export function N(en: string, es?: string): string {
  return current === 'es' && es ? es : en;
}

/** A language setting from storage: anything but 'es' is English. */
export const parseLang = (v: unknown): Lang => (v === 'es' ? 'es' : 'en');

/** The texts shown in Spanish that have no translation yet (for tests and the gap report). */
export const missingTexts = (): string[] => [...missing].sort();

/** Dev only: one state shared by every copy of this module the dev server loads, so the browser walk test can read it. */
function devShared(): { lang: Lang; missing: Set<string>; direct: Set<string> } {
  const g = globalThis as unknown as { __i18nDev?: { lang: Lang; missing: Set<string>; direct: Set<string> } };
  g.__i18nDev ??= { lang: 'en', missing: new Set(), direct: new Set() };
  return g.__i18nDev;
}

