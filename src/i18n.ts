// Language of the interface. Pure (no Phaser), tested.
//
// The key of every text is the English text itself: `T('SETTINGS')` gives 'SETTINGS' in English and the Spanish entry from
// `src/i18n/es.ts` when the language is Spanish. A missing entry falls back to English (a test lists the gaps). Placeholders
// are `{0}`, `{1}`... : `T('LEVEL {0}', 5)`.
//
// Names that are Spanish padel terms (Bandeja, Vibora, Bajada, Dejada, Chiquita, Rulo, Por Tres, Por Cuatro, Contrapared,
// Bloqueo...) are the same in both languages: they are not in the Spanish table on purpose.

import { ES } from './i18n/es';

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

/** The translation of an English text in the current language (English when there is none). */
export function T(text: string, ...args: unknown[]): string {
  if (current === 'es' && ES[text] === undefined && text.trim() !== '' && !isSpanish(text) && !finals.has(text)) {
    missing.add(text);
    if (import.meta.env.DEV) devShared().missing.add(text);
  }
  const out = current === 'es' && ES[text] !== undefined ? ES[text] : text;
  return args.length === 0 ? out : out.replace(/\{(\d+)\}/g, (m, i: string) => (args[Number(i)] !== undefined && args[Number(i)] !== null ? String(args[Number(i)]) : m));
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
function devShared(): { lang: Lang; missing: Set<string> } {
  const g = globalThis as unknown as { __i18nDev?: { lang: Lang; missing: Set<string> } };
  g.__i18nDev ??= { lang: 'en', missing: new Set() };
  return g.__i18nDev;
}

