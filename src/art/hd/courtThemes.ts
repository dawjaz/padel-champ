// Court colour themes: every tournament city has one, so a week in another city looks different. Pure, tested.
// The city -> theme map is data (src/data/cities.json); the colours live here. Colours are muted on purpose (no neon).

import citiesData from '../../data/cities.json';

export interface CourtTheme {
  id: string;
  /** Court surface, far end and near end. */
  top: string;
  bottom: string;
  /** Front face of the raised slab: top and bottom colour; then its two side faces (left, right). */
  slabTop: string;
  slabBottom: string;
  slabLeft: string;
  slabRight: string;
  /** Crowd bokeh tones. */
  crowd: string[];
}

const WARM = ['#ff9f6e', '#ffd36e', '#6ec8ff', '#b58cff', '#ff6e9a', '#8affc1'];

export const COURT_THEMES: Record<string, CourtTheme> = {
  blue: { id: 'blue', top: '#6aaaf8', bottom: '#3a78dc', slabTop: '#1d4f9a', slabBottom: '#0d2757', slabLeft: '#163f7e', slabRight: '#112f63', crowd: WARM },
  teal: { id: 'teal', top: '#62c2c0', bottom: '#2f8f9a', slabTop: '#1d6a76', slabBottom: '#0d3a47', slabLeft: '#175a66', slabRight: '#124a56', crowd: ['#8affc1', '#6ec8ff', '#ffd36e', '#b58cff', '#ff9f6e', '#6effe0'] },
  green: { id: 'green', top: '#74c492', bottom: '#3f9868', slabTop: '#1f6b49', slabBottom: '#0d3a28', slabLeft: '#185a3c', slabRight: '#134a31', crowd: ['#ffd36e', '#8affc1', '#ff9f6e', '#6ec8ff', '#ffe98a', '#ff6e9a'] },
  clay: { id: 'clay', top: '#dc9a7c', bottom: '#b86a4e', slabTop: '#9a4a30', slabBottom: '#4f2112', slabLeft: '#843f28', slabRight: '#6e3320', crowd: ['#ffd36e', '#ff9f6e', '#ffb59a', '#6ec8ff', '#ff6e9a', '#fff0c0'] },
  plum: { id: 'plum', top: '#9d8ae0', bottom: '#6c58b8', slabTop: '#4a3a8a', slabBottom: '#251b4f', slabLeft: '#3f3178', slabRight: '#33275f', crowd: ['#b58cff', '#ff6e9a', '#6ec8ff', '#ffd36e', '#ffb0e0', '#8affc1'] },
  steel: { id: 'steel', top: '#92a9c6', bottom: '#627ea2', slabTop: '#3d567a', slabBottom: '#1d2d47', slabLeft: '#344a6b', slabRight: '#2b3d58', crowd: ['#6ec8ff', '#dfe8ff', '#ffd36e', '#b58cff', '#ff9f6e', '#8affc1'] },
};

export const DEFAULT_THEME_ID = 'blue';

/** The theme id of a tournament city (the default blue for sparring, practice and unknown cities). */
export function themeIdOfCity(city: string | null | undefined): string {
  const id = city ? (citiesData as Record<string, string>)[city] : undefined;
  return id !== undefined && id in COURT_THEMES ? id : DEFAULT_THEME_ID;
}

export const themeById = (id: string): CourtTheme => COURT_THEMES[id] ?? COURT_THEMES[DEFAULT_THEME_ID];
