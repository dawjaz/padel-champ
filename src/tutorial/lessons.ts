/**
 * The graphic tutorial: lessons of one to three pages, each page a short text and a drawing (see art/tutorialArt.ts).
 * A lesson is shown by itself the first time the player reaches the place it belongs to (a "tip"), unless tips are switched off,
 * and any time from SETTINGS > HOW TO PLAY. Pure data and state: no Phaser, so it is unit-tested.
 */

/** Which drawing a page uses (see art/tutorialArt.ts). */
export type ArtId =
  | 'court' | 'menu' | 'guts' | 'serve' | 'receive' | 'ring' | 'glass' | 'aim' | 'runout' | 'runout2' | 'special' | 'hero' | 'gear'
  | 'career' | 'practice' | 'camp' | 'targets' | 'smash' | 'toss' | 'retire' | 'shop' | 'partner' | 'tasks' | 'season';

export interface LessonPage {
  head: string;
  /** Short lines, shown centred under the drawing. */
  text: string;
  art: ArtId;
}

export type LessonGroup = 'MATCH' | 'SHOTS' | 'HERO' | 'CAREER' | 'CAMP';

export interface Lesson {
  id: string;
  group: LessonGroup;
  title: string;
  pages: LessonPage[];
}

export const LESSONS: Lesson[] = [
  {
    id: 'basics', group: 'MATCH', title: 'THE BASICS',
    pages: [
      { head: 'THE POINT', art: 'court', text: 'Padel is played in pairs, with walls.\nEvery ball must cross the net and\nbounce in the court before it touches\nanything. After that the walls are yours.' },
      { head: 'PICK YOUR SHOT', art: 'menu', text: 'The menu is in columns: DEFENCE on the left,\nNEUTRAL in the middle, ATTACK on the right,\nspecials in gold on top. Pick the shot,\nthen touch where it should land.' },
      { head: 'GUTS (G)', art: 'guts', text: 'Every shot costs guts. A tired player\nis slower, weaker and less accurate.\nSoft shots recover; a shot you cannot\npay for is RISKY (red).' },
    ],
  },
  {
    id: 'serve', group: 'MATCH', title: 'SERVING AND RECEIVING',
    pages: [
      { head: 'THE SERVE', art: 'serve', text: 'Serve to the body, the T or the glass.\nA fault gives a slower, easier second\nserve. Hit the serve as the ring closes.' },
      { head: 'RECEIVING', art: 'receive', text: 'When the opponent serves, the ball flies\nin slow motion: read its speed, spin and\ndirection, THEN pick how to return it.' },
    ],
  },
  {
    id: 'toss', group: 'MATCH', title: 'COIN TOSS AND LEAVING',
    pages: [
      { head: 'CALL IT', art: 'toss', text: 'Before the first point, call HEADS or TAILS.\nWho wins the toss serves first. After that\nthe teams change sides every odd game.' },
      { head: 'LEAVING A MATCH', art: 'retire', text: 'Before the toss you can go back, nothing\nis lost. After it, END THE GAME gives the\nmatch to your opponents and pays nothing.' },
    ],
  },
  {
    id: 'ring', group: 'SHOTS', title: 'THE TIMING RING',
    pages: [
      { head: 'TOUCH AS IT CLOSES', art: 'ring', text: 'Serves, smashes, viboras and bandejas\nare hit with a ring that closes on the\nball. Touch when it is GREEN for the\nfull shot; early or late weakens it.' },
    ],
  },
  {
    id: 'shots', group: 'SHOTS', title: 'WHAT CAN I PLAY?',
    pages: [
      { head: 'THE MENU FITS THE BALL', art: 'glass', text: 'VOLLEY, VIBORA, BANDEJA: only out of\nthe air. BAJADA: only off the back glass.\nSMASH: weak lobs. LOB: any time.' },
      { head: 'AIMING', art: 'aim', text: 'Touch the court where the ball should\nland. A tired or rushed player spreads\nthe ball: aim for the middle of the gap.' },
    ],
  },
  {
    id: 'runout', group: 'SHOTS', title: 'RUN OUT',
    pages: [
      { head: 'AFTER THE GLASS', art: 'runout', text: 'A Por Tres can leave the court over the\nside fence. The ball hangs: touch RUN OUT!\nand your player chases it outside.' },
      { head: 'LOB OR DOOR', art: 'runout2', text: 'Hit the ring, then send it back high (LOB)\nor flat through the door, if the angle\nallows. Such balls are very hard to hold.' },
    ],
  },
  {
    id: 'special', group: 'SHOTS', title: 'SPECIAL SHOTS',
    pages: [
      { head: 'YOUR SIGNATURE SHOTS', art: 'special', text: 'Levels 3, 6, 10 and 15 unlock a special\nshot each, and none ever expires.\nThey cost a lot of G and need your own\nball, but almost always win the point.' },
    ],
  },
  {
    id: 'hero', group: 'HERO', title: 'HERO AND SKILL POINTS',
    pages: [
      { head: 'SKILL POINTS', art: 'hero', text: 'Every level gives 2 skill points.\nSpend them on the seven attributes.\nThe shaded part of a bar unlocks at\nlevels 5, 10, 15 and so on.' },
    ],
  },
  {
    id: 'gear', group: 'HERO', title: 'GEAR',
    pages: [
      { head: 'FIVE SLOTS, FOUR GRADES', art: 'gear', text: 'Shirt, shorts, shoes, racket and bag.\nEach maker has Basic, Pro, Technical and\nElite models. A star marks something new.\nA full set of one brand adds a bonus.' },
    ],
  },
  {
    id: 'career', group: 'CAREER', title: 'THE CAREER',
    pages: [
      { head: 'WEEK BY WEEK', art: 'career', text: 'Each week offers tournaments. Win your\nties (one match each) to climb the draw,\nearn XP, coins and trophies, and rise\nin the ranking.' },
    ],
  },
  {
    id: 'partner', group: 'CAREER', title: 'YOUR PARTNER',
    pages: [
      { head: 'PLAY AS A PAIR', art: 'partner', text: 'Padel is played in pairs. Your partner plays\nthe other half of the court, and the pair\nrating counts both of you. Better partners\nneed a higher level and some coins.' },
    ],
  },
  {
    id: 'shop', group: 'CAREER', title: 'SHOP AND PACKS',
    pages: [
      { head: 'SPEND YOUR COINS', art: 'shop', text: 'Gear Packs and Premium Packs hold random\ngear (the better pack, the better odds).\nBoosts help in one match. The shop is closed\nwhile a tournament is on.' },
    ],
  },
  {
    id: 'tasks', group: 'CAREER', title: 'DAILY AND WEEKLY TASKS',
    pages: [
      { head: 'SMALL GOALS, BIG REWARDS', art: 'tasks', text: 'Three tasks every day and three every week,\nplayed in career matches. Each pays coins.\nFinish all three for a bonus, and a daily\nlogin gives more every day in a row.' },
    ],
  },
  {
    id: 'season', group: 'CAREER', title: 'THE END OF A SEASON',
    pages: [
      { head: 'SEASON COMPLETE', art: 'season', text: 'A season is 24 weeks. At the end you get\nyour place in the world ranking, and coins\nand packs for it, plus more for every title.\nPlay at least 8 tournaments to earn it.' },
    ],
  },
  {
    id: 'practice', group: 'CAREER', title: 'PRACTICE COURT',
    pages: [
      { head: 'TRAIN ANY SITUATION', art: 'practice', text: 'Pick a situation (a lob, a Por Tres, a run\nout...) and play it again and again.\nIt shows what each shot would have done.' },
    ],
  },
  {
    id: 'camp', group: 'CAMP', title: 'TRAINING CAMP',
    pages: [
      { head: 'FOUR MINIGAMES', art: 'camp', text: 'Three tries a week when no tournament\nis on. Stars pay coins, boosts and Gear\nPack fragments. GOALS adds two daily\nand two weekly targets.' },
    ],
  },
  {
    id: 'camp_targets', group: 'CAMP', title: 'TARGET PRACTICE',
    pages: [
      { head: 'LAND IT IN THE ZONE', art: 'targets', text: 'The zone moves. Choose the shot, touch\nthe court where the ball should land\nand keep it inside the zone.' },
    ],
  },
  {
    id: 'camp_serve', group: 'CAMP', title: 'SERVE AND RETURN',
    pages: [
      { head: 'SERVE INTO THE GAP', art: 'serve', text: 'The receiver stands off-centre. Serve\ninto the gap, then hit the ball as it\ncomes up. On his serve, pick the return\nthat fits the ball.' },
    ],
  },
  {
    id: 'camp_timing', group: 'CAMP', title: 'TIMING',
    pages: [
      { head: 'EVERY BALL IS DIFFERENT', art: 'ring', text: 'Touch as the ring closes on the ball.\nGreen is a perfect hit. The pace changes\nfrom ball to ball.' },
    ],
  },
  {
    id: 'camp_smash', group: 'CAMP', title: 'SMASH SHOW',
    pages: [
      { head: 'PICK, THEN HIT', art: 'smash', text: 'See where the lob will land, pick Por Tres,\nPor Cuatro or Vibora, then touch as the\nring closes. The deeper the lob, the harder\nthe Por Cuatro.' },
    ],
  },
];

export const lessonById = (id: string): Lesson | undefined => LESSONS.find((l) => l.id === id);

/** The lessons a new player gets in a row before the first match. */
export const FIRST_RUN = ['basics', 'serve'];

/** What the player has seen and whether he wants the tips at all. */
export interface TipState {
  seen: string[];
  off: boolean;
}

export const newTips = (): TipState => ({ seen: [], off: false });

/** A tip is shown if tips are on and this one has not been seen. */
export const tipDue = (t: TipState, id: string): boolean => !t.off && !t.seen.includes(id) && lessonById(id) !== undefined;

export const markTip = (t: TipState, id: string): TipState => (t.seen.includes(id) ? t : { ...t, seen: [...t.seen, id] });

export const setTipsOff = (t: TipState, off: boolean): TipState => ({ ...t, off });

/** Junk becomes a valid state; an old save that finished the old tutorial has already seen the basics. */
export function sanitizeTips(raw: unknown, tutorialSeen = false): TipState {
  const o = (raw ?? null) as Partial<Record<string, unknown>> | null;
  const seen = Array.isArray(o?.seen) ? [...new Set((o.seen as unknown[]).filter((x): x is string => typeof x === 'string' && lessonById(x) !== undefined))] : [];
  if (tutorialSeen) for (const id of FIRST_RUN) if (!seen.includes(id)) seen.push(id);
  return { seen, off: o?.off === true };
}
