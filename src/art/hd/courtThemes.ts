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
  /** The surroundings stay dark (the owner's choice), only tinted: sky above the stands, ground, and the LED board along the court. */
  skyTop: string;
  skyBottom: string;
  groundTop: string;
  groundBottom: string;
  adTop: string;
  adMid: string;
  adBottom: string;
  /** Spotlight cones, as 'r,g,b'. */
  spot: string;
  /** Crowd: distance between people (smaller = fuller stands) and blob strength (hex alpha, '55'..'99'). */
  crowdStep: number;
  crowdAlpha: string;
}

const WARM = ['#ff9f6e', '#ffd36e', '#6ec8ff', '#b58cff', '#ff6e9a', '#8affc1'];

export const COURT_THEMES: Record<string, CourtTheme> = {
  blue: { id: 'blue', top: '#6aaaf8', bottom: '#3a78dc', slabTop: '#1d4f9a', slabBottom: '#0d2757', slabLeft: '#163f7e', slabRight: '#112f63', crowd: WARM, skyTop: '#1c2f5c', skyBottom: '#3b5a94', groundTop: '#2c4676', groundBottom: '#1b2f58', adTop: '#1f55c4', adMid: '#173f98', adBottom: '#0b2160', spot: '255,244,214', crowdStep: 7, crowdAlpha: '77' },
  teal: { id: 'teal', top: '#62c2c0', bottom: '#2f8f9a', slabTop: '#1d6a76', slabBottom: '#0d3a47', slabLeft: '#175a66', slabRight: '#124a56', crowd: ['#8affc1', '#6ec8ff', '#ffd36e', '#b58cff', '#ff9f6e', '#6effe0'], skyTop: '#16345a', skyBottom: '#336a8f', groundTop: '#244a6e', groundBottom: '#163350', adTop: '#1b6a8c', adMid: '#145678', adBottom: '#0a2f4a', spot: '235,250,255', crowdStep: 6.5, crowdAlpha: '77' },
  green: { id: 'green', top: '#74c492', bottom: '#3f9868', slabTop: '#1f6b49', slabBottom: '#0d3a28', slabLeft: '#185a3c', slabRight: '#134a31', crowd: ['#ffd36e', '#8affc1', '#ff9f6e', '#6ec8ff', '#ffe98a', '#ff6e9a'], skyTop: '#173a4c', skyBottom: '#3a7088', groundTop: '#264a62', groundBottom: '#17323f', adTop: '#1f7a5c', adMid: '#17624a', adBottom: '#0a3326', spot: '255,248,210', crowdStep: 6, crowdAlpha: '88' },
  clay: { id: 'clay', top: '#dc9a7c', bottom: '#b86a4e', slabTop: '#9a4a30', slabBottom: '#4f2112', slabLeft: '#843f28', slabRight: '#6e3320', crowd: ['#ffd36e', '#ff9f6e', '#ffb59a', '#6ec8ff', '#ff6e9a', '#fff0c0'], skyTop: '#2a2c58', skyBottom: '#5a5a8c', groundTop: '#3a4570', groundBottom: '#262c52', adTop: '#b25a3a', adMid: '#8c452c', adBottom: '#4a2216', spot: '255,226,180', crowdStep: 7.5, crowdAlpha: '77' },
  plum: { id: 'plum', top: '#9d8ae0', bottom: '#6c58b8', slabTop: '#4a3a8a', slabBottom: '#251b4f', slabLeft: '#3f3178', slabRight: '#33275f', crowd: ['#b58cff', '#ff6e9a', '#6ec8ff', '#ffd36e', '#ffb0e0', '#8affc1'], skyTop: '#272556', skyBottom: '#4e4c90', groundTop: '#35386e', groundBottom: '#222550', adTop: '#5a46b8', adMid: '#44349a', adBottom: '#221a5a', spot: '240,226,255', crowdStep: 6.5, crowdAlpha: '88' },
  steel: { id: 'steel', top: '#92a9c6', bottom: '#627ea2', slabTop: '#3d567a', slabBottom: '#1d2d47', slabLeft: '#344a6b', slabRight: '#2b3d58', crowd: ['#6ec8ff', '#dfe8ff', '#ffd36e', '#b58cff', '#ff9f6e', '#8affc1'], skyTop: '#1e2d46', skyBottom: '#43597e', groundTop: '#2c4262', groundBottom: '#1b2c47', adTop: '#46608a', adMid: '#364c72', adBottom: '#1a2840', spot: '230,238,255', crowdStep: 8, crowdAlpha: '66' },
};

export const DEFAULT_THEME_ID = 'blue';

/** The theme id of a tournament city (the default blue for sparring, practice and unknown cities). */
export function themeIdOfCity(city: string | null | undefined): string {
  const id = city ? (citiesData as Record<string, string>)[city] : undefined;
  return id !== undefined && id in COURT_THEMES ? id : DEFAULT_THEME_ID;
}

export const themeById = (id: string): CourtTheme => COURT_THEMES[id] ?? COURT_THEMES[DEFAULT_THEME_ID];
