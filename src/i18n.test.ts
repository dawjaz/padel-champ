import { describe, expect, it, beforeEach } from 'vitest';
import { T, N, done, setLang, getLang, parseLang, LANGS, LANG_LABEL, missingTexts } from './i18n';
import { ES } from './i18n/es';

describe('i18n', () => {
  beforeEach(() => setLang('en'));

  it('returns the English text unchanged in English', () => {
    expect(T('PLAY')).toBe('PLAY');
    expect(getLang()).toBe('en');
  });

  it('translates in Spanish mode and falls back to English for unknown text', () => {
    setLang('es');
    expect(T('PLAY')).toBe(ES['PLAY']);
    expect(T('NOT A REAL KEY XYZ')).toBe('NOT A REAL KEY XYZ');
  });

  it('fills {0}, {1} placeholders and leaves unknown ones in place', () => {
    expect(T('LEVEL {0}: {1}', 5, 'HERO')).toBe('LEVEL 5: HERO');
    expect(T('{0} / {1}', 3)).toBe('3 / {1}');
    setLang('es');
    expect(T('LEVEL {0}', 5)).toBe(`${ES['LEVEL {0}']}`.replace('{0}', '5'));
  });

  it('keeps Spanish padel shot names the same in both languages', () => {
    for (const name of ['CORNER LOCK', 'SKY ROCKET', 'FREEZE DROP']) {
      expect(T(name)).toBe(name);
      setLang('es');
      expect(T(name)).toBe(name);
      setLang('en');
    }
  });

  it('does not translate the English build (no Spanish entry is used)', () => {
    const sample = Object.keys(ES).slice(0, 50);
    for (const k of sample) expect(T(k)).toBe(k);
  });

  it('done() marks a composed Spanish string as final', () => {
    setLang('es');
    const text = done('NIVEL 5');
    expect(text).toBe('NIVEL 5');
    expect(missingTexts()).not.toContain('NIVEL 5');
  });

  it('N() picks the Spanish text in Spanish mode', () => {
    expect(N('YES', 'SÍ')).toBe('YES');
    setLang('es');
    expect(N('YES', 'SÍ')).toBe('SÍ');
  });

  it('parses only known languages and lists both labels', () => {
    expect(parseLang('es')).toBe('es');
    expect(parseLang('fr')).toBe('en');
    expect(parseLang(undefined)).toBe('en');
    expect(LANGS).toEqual(['en', 'es']);
    expect(LANG_LABEL.es).toBe('ESPAÑOL');
  });

  it('records untranslated texts only in Spanish mode', () => {
    setLang('en');
    T('ZZ ENGLISH ONLY PROBE');
    expect(missingTexts()).not.toContain('ZZ ENGLISH ONLY PROBE');
    setLang('es');
    T('ZZ SPANISH PROBE');
    expect(missingTexts()).toContain('ZZ SPANISH PROBE');
  });
});
