import { describe, expect, it, beforeEach } from 'vitest';
import { LESSONS } from './tutorial/lessons';
import { lookup, T, N, done, setLang, getLang, parseLang, LANGS, LANG_LABEL, missingTexts } from './i18n';
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

  it('finds the same words in another case and translates gear names by pattern', () => {
    setLang('es');
    expect(T('Play 2 career matches')).toBe('Juega 2 partidos de carrera');
    expect(T('PLAY 2 CAREER MATCHES')).toBe('JUEGA 2 PARTIDOS DE CARRERA');
    expect(T('Bavolé Pro Shirt')).toBe('Camiseta Pro Bavolé');
    expect(T('Toropad Basic Shorts')).toBe('Pantalón corto Básico Toropad');
    expect(T('BAVOLÉ ELITE SHOES')).toBe('ZAPATILLAS ÉLITE BAVOLÉ');
    setLang('en');
    expect(T('Bavolé Pro Shirt')).toBe('Bavolé Pro Shirt');
  });

  it('translates the match commentary built from parts and keeps names', () => {
    setLang('es');
    expect(T('Bruno: Bajada Low Speed middle!')).toBe('Bruno: Bajada baja velocidad centro!');
    expect(T('Ines: Lob parallel! (risky)')).toBe('Ines: Globo paralela! (arriesgado)');
    expect(T('Lucy wins the point with a winner!')).toBe('¡Lucy gana el punto con un golpe ganador!');
    expect(T('Dani did not decide in time and never touched it. ACE!  >  POINT TO YOU')).toContain('PUNTO PARA TÚ');
    expect(T('HEADS! You win the toss and serve first.')).toBe('¡CARA! Ganas el sorteo y sacas primero.');
    expect(T('Bruno: Por Tres, which way?')).toBe('Bruno: Por Tres, ¿hacia dónde?');
    expect(T('Dani: Chiquita middle!\n[12] RISKY')).toBe('Dani: Chiquita centro!\n[12] ARRIESGADO');
    setLang('en');
    expect(T('Bruno: Bajada Low Speed middle!')).toBe('Bruno: Bajada Low Speed middle!');
  });

  it('fits the Spanish lesson texts on a card (lines up to 52 characters)', () => {
    for (const l of LESSONS) {
      for (const pg of l.pages) {
        const es = lookup(pg.text);
        expect(es, `${l.id}: ${pg.head}`).toBeDefined();
        for (const line of (es ?? '').split('\n')) expect(line.length, `${l.id}: ${line}`).toBeLessThanOrEqual(52);
      }
    }
  });
});

