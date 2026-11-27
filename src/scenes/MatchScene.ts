import Phaser from 'phaser';
import { serveBallH, SERVE_DUE_MS, DROP_MS } from '../art/serveDrop';
import { ARRIVAL_HEIGHT, ballPoint, buildCoast, buildFlight, flightDuration, HIT_HEIGHT_M, speedAt, TIME_SCALE, type Coast, type Flight, type FlightEvent, type Sample } from '../art/ballPath';
import { project, unproject } from '../art/camera';
import { IDENTITY, launchSpin, rotate, type Mat3, type Vec3 } from '../art/spin';
import { poseOf, type Facing, type PoseName, type Stance } from '../art/pose';
import { placeToonSprite } from '../art/toonTexture';
import { buildToon } from '../art/toon/character';
import { drawOps, VIEW } from '../art/toon/ops';
import { celebrateSteps, disappointSteps, fistSteps, frustrationSteps, highFiveSteps, tiredReady, tiredSteps, type Step as RigStep, easeOut, forHeight, HIT_STOP, inOut, loadPose, lungePose, splitSteps, poseSignature, racketEnds, Rig, smashSteps, strokeSteps } from '../art/rig';
import { kickBody, newBody, runEase, stepBody, type BodyPose, type BodyState } from '../art/bodyDynamics';
import { POSES, runFrame, RUN_FRAMES, SHUFFLE_FRAMES, shuffleFrame } from '../art/toon/character';
import { chooseStance, standingSpot } from '../art/stance';
import { themeIdOfCity } from '../art/hd/courtThemes';
import { CHEER_GROUPS, standHeads } from '../art/hd/venueHd';
import { ARENA_NET_KEY, BALL_KEY, CHEER_STRIP_H, DOT_KEY, ensureArenaTextures, ensureCheerTexture, ensureBallTextures, ensureCoinTexture, ensureFlatTextures, GLOW_KEY, RING_KEY, SHADOW_KEY } from '../art/hdTextures';
import { impactSound, powerSmashSound, sfx } from '../audio';
import { racketKind } from '../sfxKind';
import { HEIGHT, WIDTH, HD_SCALE } from '../config';
import playersData from '../data/players.json';
import { applyHd } from '../hd';
import { eventStamp, touchTime } from '../touchTime';
import { DISPLAY, BODY, bakedShape, drawCard, makeSideSwitch, makeThemeButton, TC, themeText } from '../theme';
import { pickStarReceiver, pickHit, pickReceive, pickServe } from '../game/ai';
import { baseId, DIRECTIONS, shotsOfKind, SPECIALS } from '../game/catalog';
import { laneSign, landingX, landingZ, NET_Z, restPos, serveSetup, targetMissChance } from '../game/court';
import { GAME_BREAK_RECOVERY_MUL, recoverGuts, ringQuality, ringWindow, SECOND_SERVE_SPEED } from '../game/engine';
import { canRunOut, doorShot, isPowerfulSmash, playableShots, reachAgainst, RUN_OUT_COST, runOutReturn, type DoorShot, type RunOutMode, specialsFor, withSpecial, type ReachPositions, shotLabel, startPoint, stepHit, stepServe, targetSpreadFor, unavailableReason, type HitOptions, type PointState, type Step, type Teams } from '../game/point';
import { awardPoint, deuceLabel, isStarPoint, newScore, pointLabels, type MatchScore } from '../game/scoring';
import type { AimPreference, CourtPos, Direction, Formation, Height, PlayerDef, ReceiveMode, ShotDef, SideIndex } from '../game/types';
import { paceFactor } from '../game/pace';
import { seededRng } from '../game/rng';
import { showTip } from '../tutorial/tips';
import { practicePoint, situation, SITUATIONS, type SituationId } from '../game/practice';
import { tournamentEnd, type CutOccasion } from '../art/cutscenes';
import { CUPS } from '../career/cups';
import { playCutscene, type CutCast } from './CutsceneScene';
import { flipCoin, tossWinner, type CoinFace } from '../game/toss';
import { fatigueFactor, gutsRecovery, powerSpeedMul, receiveDecisionMs, spinMul } from '../game/attributes';
import { reportMatch, type Finished } from '../career/careerFlow';
import { partnerById } from '../career/season';
import { boostOf, consumeQueued } from '../career/gear';
import { heroFrom, heroLane, levelOf, matchReward, type Profile } from '../career/profile';
import { claim, newlyEarned, progressOf, recordMatch } from '../career/achievements';
import { addFacts, dayKey } from '../career/daily';
import { addWeeklyFacts, weekKey } from '../career/weekly';
import { positionOf } from '../career/ranking';
import { getSave, recordResult, updateSave } from '../save';

const BASE_YOU = playersData.you as unknown as PlayerDef[];
/** The teams of the current match: the human hero (idx 0) has the attributes of the career profile; set in create(). */
const DEFAULT_CPU = playersData.cpu as unknown as PlayerDef[];
let TEAMS: Teams = [BASE_YOU, DEFAULT_CPU];

/** A career match: the opponent pair of the bracket (the partner comes from the career). */
export interface CareerMatch {
  opponents: PlayerDef[];
  name: string;
  /** The tournament city: picks the court colours (see art/hd/courtThemes.ts). */
  city?: string;
  /** For the cutscenes: the round ("SEMIFINAL") and the tournament ("Regional Open Warsaw"). */
  round?: string;
  event?: string;
}

/** The one player you control. Your partner and the whole CPU team play automatically and quickly. */
const HUMAN_SIDE: SideIndex = 0;
/** The lane (player index) the hero plays in: 0 = left, 1 = right (the profile's side, see `heroLane`). */
let HUMAN_IDX = 0;
/** Pauses in milliseconds: relaxed, like the rallies at a real tournament. */
const CPU_DELAY = 28;
/** Pixels per figure unit of a player's own picture: near pair, far pair (smaller on the screen). */
const RIG_UNIT_NEAR = 0.55;
const RIG_UNIT_FAR = 0.42;
/** Milliseconds of picture drawing per frame; a player whose pose changed waits a frame when it is used up. */
const RIG_BUDGET_MS = 6;
/** Run and side-step cycles: metres per cycle (two steps). */
const RUN_CYCLE_M = 1.7;
const SHUFFLE_CYCLE_M = 0.9;
/** A winner passes at least this far (m) from where the beaten defender's run ends, so it never looks as if it went past his racket. */
const WINNER_MISS_M = 1.8;
/** ... and he covers at most this share of the way to it. */
const WINNER_RUN_SHARE = 0.7;
/** A run longer than this (m) ends in a lunge (a full one 2.4 m further). */
const LUNGE_FROM_M = 2.4;
const NEXT_HIT_DELAY = 88;
/** Before a CPU player plays the ball the pause is half as long: only the human has a choice to make. */
const CPU_NEXT_HIT_DELAY = NEXT_HIT_DELAY / 2;
const FAULT_PAUSE = 900;
const POINT_PAUSE = 1100;
const GAME_PAUSE = 1500;
/** A player who hits a ball off the back glass stands this far (m) behind the ball, so that it is at his side and a little in front. */
const REBOUND_BEHIND_BALL = 0.55;
const SIDE_NAME = ['YOU', 'CPU'] as const;
const DIRECTION_ORDER: Direction[] = ['parallel', 'middle', 'cross'];

/** How tall a character looks on screen, in court metres (chibi: big head, so a bit exaggerated). */
const VISUAL_HEIGHT_M = 1.75;

/** How far outside the court the run-out ball is kept (the screen ends there). */
const RUN_OUT_MAX_X = 6;
/** A run-out that can be played: where he meets the ball, how much slower than life the ball moves, when it is there, how long his two legs of the run take (ms). */
interface RunOutPlan {
  contact: CourtPos;
  stretch: number;
  hitMs: number;
  m1: number;
  m2: number;
}
/** The shot menu in columns by intent: where each shot stands (see `showShotMenu`). */
export type ShotFamily = 'd' | 'n' | 'a' | 's';
const FAMILY_OF: Record<string, [ShotFamily, number, string]> = {
  rally_lob: ['d', 0, 'Lob'], lob: ['d', 0, 'Lob'],
  rally_chiquita: ['d', 1, 'Chiquita'], chiquita: ['d', 1, 'Chiquita'],
  bajada_slow: ['d', 2, 'Bajada Low'], bloqueo: ['d', 3, 'Block'], contrapared: ['d', 4, 'Contrapared'],
  bounce_shot: ['n', 0, 'Flat shot'], flat: ['n', 0, 'Flat return'], volley: ['n', 1, 'Volley'], dejada: ['n', 2, 'Dejada'],
  bandeja: ['a', 0, 'Bandeja'], vibora: ['a', 1, 'Vibora'], rulo: ['a', 2, 'Rulo'], smash_x3: ['a', 3, 'Por Tres'], smash_x4: ['a', 4, 'Por Cuatro'], bajada_fast: ['a', 5, 'Bajada High'],
  sp_skyrocket: ['s', 0, 'Sky Rocket'], sp_venom: ['s', 1, 'Venom Vibora'], sp_cornerlock: ['s', 2, 'Corner Lock'], sp_freeze: ['s', 3, 'Freeze Drop'],
};
const FAM_FILL: Record<ShotFamily, number> = { d: 0xd6e5ff, n: 0xeef1f6, a: 0xffe0c7, s: 0xffe9a8 };
const FAM_STROKE: Record<ShotFamily, number> = { d: 0x2f6df0, n: 0x7b8aa3, a: 0xe0620d, s: 0xc98a00 };

type Tone = 'normal' | 'good' | 'poor' | 'tired' | 'off' | 'special';

const TONE_STROKE: Record<Tone, number> = { normal: 0x0b2a5b, good: 0x0e8f5c, poor: 0xd97a00, tired: 0xc62828, off: 0x9aa7bb, special: 0xc98a00 };
const TONE_FILL: Record<Tone, number> = { normal: 0xffffff, good: 0xdff7ea, poor: 0xfff0d9, tired: 0xfde1e1, off: 0xeef1f6, special: 0xffe9a8 };
const NAVY_CSS = '#0b2a5b';
/** Guts bar over/under a player: green when full, lime, orange, red below 30% of the bar. */
const GUTS_BAR_W = 38;
const GUTS_BAR_H = 7;
export function gutsBarColor(ratio: number): number {
  if (ratio < 0.3) return 0xff4d4d;
  if (ratio < 0.5) return 0xffa733;
  if (ratio < 0.75) return 0xd4e04a;
  return 0x4cd964;
}

const TONE_TEXT: Record<Tone, string> = { normal: '#0b2a5b', good: '#0a6b45', poor: '#9a5200', tired: '#a31f1f', off: '#8d9bb0', special: '#7a4a00' };

interface PlayerView {
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  /** Rounded guts bar next to the name (see `drawGutsBar`). */
  bar: Phaser.GameObjects.RenderTexture;
  /** Paints the bar again (it is a texture, see `drawGutsBar`). */
  barRepaint: (paint: (g: Phaser.GameObjects.Graphics) => void) => void;
  player: PlayerDef;
  side: SideIndex;
  /** Jump height in pixels (animated by the hit "hop"). */
  lift: number;
  pose: PoseName;
  /** Which way the player looks: towards the net by default, to the side when running. */
  facing: Facing;
  /** The player is playing a stroke (swing animation) until this time (ms), so running must not overwrite it. */
  busyUntil: number;
  /** The rig: the pose drawn every frame (rig.ts). */
  rig: Rig;
  /** The player's own picture, drawn again whenever the pose or the view changes (`drawRig`). */
  canvas: Phaser.Textures.CanvasTexture;
  unit: number;
  drawn: string;
  /** A reaction (after a point) plays until then (ms): a plain return to ready does not cut it short. */
  reactUntil: number;
  /** Recent racket positions for the smear (figure units), newest last. */
  trail: Array<[[number, number], [number, number]]>;
  /** Width in pixels of the guts bar as last drawn (-1: not drawn yet). */
  barShown: number;
  /** Lean, squash, step bob and breathing (see bodyDynamics.ts), stepped every frame in `update`. */
  body: BodyState;
  look: BodyPose;
  /** Feet on the screen in the last frame (null: not measured yet). */
  lastFeet: { x: number; y: number } | null;
}

interface ButtonSpec {
  label: string;
  tone: Tone;
  /** Greyed out and not clickable (the shot is not possible now). */
  disabled?: boolean;
  /** For the column layout: the family (d defence, n neutral, a attack, s special), the place inside it, and the short label. */
  fam?: ShotFamily;
  slot?: number;
  onPick: () => void;
}

const other = (s: SideIndex): SideIndex => (s === 0 ? 1 : 0);
/** Which toon view to draw: facing the camera or away; a player running sideways keeps the view of his team. */
/** A runner or a player turned sideways is shown in profile; everybody else from behind (the near team) or from the front. */
const toonViewOf = (facing: Facing, side: SideIndex): 'front' | 'back' | 'side' => (facing === 'left' || facing === 'right' ? 'side' : facing === 'front' || facing === 'back' ? facing : side === 0 ? 'back' : 'front');
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export class MatchScene extends Phaser.Scene {
  private matchScore: MatchScore = newScore(2);
  private career: CareerMatch | null = null;
  /** The inventory before the boost of this career match was used up: given back when the player leaves before the match starts. */
  private inventoryBefore: Profile['inventory'] | null = null;
  /** True once the coin toss has been called: from then on a career match cannot be left without forfeiting. */
  private started = false;
  private over = false;
  private exitButton: ReturnType<typeof makeThemeButton> | null = null;
  /** The text on the status line (it stays until the next shot replaces it). */
  private lastSaid = '';
  /** Set for the shot in the air: the court mark at its bounce is stronger (Por Cuatro, a strong Por Tres). */
  private powerStyle: 'x4' | 'x3' | null = null;
  /** Where everybody stands for the serve of this point (the second serve starts from the same spots). */
  private serveSpots: Record<string, CourtPos> = {};
  private pointsWon: [number, number] = [0, 0];
  private longestRally = 0;
  /** The cheering crowd over the stands, one picture per group (see crowdCheer); filled in shortly after the match opens. */
  private cheer: Phaser.GameObjects.Image[] = [];
  private headSpots: Array<{ x: number; y: number }> | null = null;
  /** Points the hero's side won with certain shots (for the daily tasks). */
  private dailyWins = { smash: 0, dejada: 0, viboraBandeja: 0, bajada: 0, ace: 0 };
  /** Extra guts recovery of the hero from consumables (0.1 = +10%). */
  private recoveryPct = 0;
  private server: SideIndex = 0;
  /** Which player of each team serves in their next service game. */
  private serverIdx: [number, number] = [0, 0];
  private point!: PointState;
  private guts: Record<string, number> = {};
  private busy = false;
  private menu: Phaser.GameObjects.GameObject[] = [];
  private views: Record<string, PlayerView> = {};
  private pos: Record<string, CourtPos> = {};
  /** How each player is set up for the next stroke (chosen when they run to the ball). */
  private stance: Record<string, Stance> = {};
  /** The ball's height (m) where the player will hit it (the stroke bends or stretches for it, see `forHeight`). */
  private hitHeight: Record<string, number> = {};
  /** A lunge at the end of a long run (picture direction, how far 0..1), valid until `until` (scene ms). */
  private lunge: Record<string, { dir: number; reach: number; until: number }> = {};
  /** Players who play the next ball after it has come off the back glass: they turn to it and hit side-on. */
  private activeId: string | null = null;
  private ballFloor: CourtPos = { x: 0, z: NET_Z };
  /** Height of the ball when it is played next (a lob arrives high, a chiquita low). */
  private ballH = HIT_HEIGHT_M;
  private coastTween: Phaser.Tweens.Tween | null = null;
  private coastRunning = false;
  /** Big "HIGH BALL / MID BALL / LOW BALL" in the lower part of the court while the human picks a shot. */
  private heightText!: Phaser.GameObjects.Text;
  private heightSub!: Phaser.GameObjects.Text;
  /** Orientation and angular velocity of the ball, and when it was last turned (scene clock, ms). */
  private ballR: Mat3 = IDENTITY;
  private ballOmega: Vec3 = [0, 0, 0];
  private ballTurnedAt = 0;
  private redrawBall: (m: Mat3) => void = () => undefined;
  /** Shadows under the players and the ball and the ring under the active player: pooled images (a Graphics redrawn every frame costs a polygon triangulation per ellipse). */
  private shadows: Record<string, Phaser.GameObjects.Image> = {};
  private ballShadow!: Phaser.GameObjects.Image;
  private ring!: Phaser.GameObjects.Image;
  private trailDots: Phaser.GameObjects.Image[] = [];
  private ballDrawnAt = 0;
  private ball!: Phaser.GameObjects.Image;
  private ballGlow!: Phaser.GameObjects.Image;
  /** Recent screen positions of the ball, for its fading trail. */
  private trail: Array<{ x: number; y: number; d: number }> = [];
  /** TV scoreboard: team names, games, points per row, the serve dot and the deuce note. */
  private sb!: { names: Phaser.GameObjects.Text[]; games: Phaser.GameObjects.Text[]; pts: Phaser.GameObjects.Text[]; dot: Phaser.GameObjects.Graphics; note: Phaser.GameObjects.Text; title: Phaser.GameObjects.Text; boxes: Phaser.GameObjects.RenderTexture };
  private logText!: Phaser.GameObjects.Text;

  /**
   * Free Practice: 'attack' = you play any shot at the opponents, 'defend' = the opponents play a shot of your choice at you (developer
   * tools, hidden). 'court' = the Practice Court of the main menu: ready-made situations, one shot again and again, with the timing
   * ring and the aiming of a match.
   */
  private practice: 'attack' | 'defend' | 'court' | null = null;
  /** Scene time when the running timing ring closes (for automated checks). */
  ringDueAt = 0;
  /** Practice Court: the situation being practised (null: choosing) and what the hero's shots did since it was chosen. */
  private court: { sit: SituationId | null; shots: number; winners: number; inPlay: number; errors: number; perfect: number } = {
    sit: null, shots: 0, winners: 0, inPlay: 0, errors: 0, perfect: 0,
  };
  private pr: {
    ball: Height; glass: boolean; weakLob: boolean; me: Formation; opp: Formation; result: 'auto' | HitOptions['force']; page: number;
    /** The ball has bounced (not played out of the air), comes in fast, comes down by a side wall, SETUP page. */
    bounced: boolean; hard: boolean; atWall: boolean; setupPage: number;
  } = {
    ball: 'mid', glass: false, weakLob: false, me: 'back', opp: 'back', result: 'auto', page: 0,
    bounced: false, hard: false, atWall: false, setupPage: 0,
  };

  constructor() {
    super('MatchScene');
  }

  // Phaser keeps the data of the previous start when a scene is started without any: a normal match is always started with { practice: null }.
  init(data?: { practice?: 'attack' | 'defend' | 'court' | null; career?: CareerMatch | null }): void {
    this.practice = data?.practice ?? null;
    this.court = { sit: null, shots: 0, winners: 0, inPlay: 0, errors: 0, perfect: 0 };
    this.career = data?.career ?? null;
    this.pr = { ball: 'mid', glass: false, weakLob: false, me: 'back', opp: 'back', result: 'auto', page: 0, bounced: false, hard: false, atWall: false, setupPage: 0 };
  }

  create(): void {
    applyHd(this);
    const profile = getSave().profile;
    // The boost chosen before a tournament match boosts that match only and is used up when it starts.
    this.inventoryBefore = this.career ? profile.inventory : null;
    this.started = false;
    this.over = false;
    const boost = this.career ? boostOf(profile.inventory) : undefined;
    this.recoveryPct = boost?.recoveryPct ?? 0;
    const partner = this.career ? (partnerById(profile.career.partnerId) ?? BASE_YOU[1]) : BASE_YOU[1];
    HUMAN_IDX = heroLane(profile);
    const hero = heroFrom(BASE_YOU[0], profile, boost);
    // the partner and the opponents have their special shots (the stronger ones; see `cpuSpecial`), the hero every one he has unlocked
    const mate = withSpecial(partner);
    TEAMS = [HUMAN_IDX === 0 ? [hero, mate] : [mate, hero], (this.career ? this.career.opponents : DEFAULT_CPU).map(withSpecial)];
    if (boost && profile.inventory.queued.length > 0) {
      updateSave((d) => ({ ...d, profile: { ...d.profile, inventory: consumeQueued(d.profile.inventory) } }));
    }
    this.pointsWon = [0, 0];
    this.longestRally = 0;
    this.dailyWins = { smash: 0, dejada: 0, viboraBandeja: 0, bajada: 0, ace: 0 };
    this.matchScore = newScore(2);
    this.server = 0;
    this.serverIdx = [HUMAN_IDX, 0];
    this.busy = false;
    this.menu = [];
    this.views = {};
    this.pos = {};
    this.activeId = null;
    this.guts = {};
    for (const p of TEAMS.flat()) this.guts[p.id] = p.maxGuts;

    this.trail = [];
    this.drawArenaHd();
    ensureFlatTextures(this);
    this.shadows = {};
    this.trailDots = [];
    this.ballShadow = this.add.image(0, 0, SHADOW_KEY).setDepth(1).setAlpha(0.4).setVisible(false);
    this.ring = this.add.image(0, 0, RING_KEY).setDepth(1).setVisible(false);
    this.createViews();
    this.redrawBall = ensureBallTextures(this).redrawBall;
    for (let i = 0; i < 14; i++) this.trailDots.push(this.add.image(0, 0, DOT_KEY).setDepth(4990).setVisible(false));
    this.ballGlow = this.add.image(0, 0, GLOW_KEY).setDepth(4999).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.8).setVisible(false);
    // Hidden until the first serve puts it down: before that it would show at its full texture size in the corner (coin toss).
    this.ball = this.add.image(0, 0, BALL_KEY).setDepth(5000).setVisible(false);

    // Control sheet under the court: the status line and the buttons sit on it.
    bakedShape(this, -4, 392, WIDTH + 8, 280, (g) => {
      g.fillStyle(TC.navy, 1);
      g.fillRoundedRect(0, 0, WIDTH + 8, 280, { tl: 20, tr: 20, bl: 0, br: 0 });
      g.lineStyle(3, TC.navyDark, 1);
      g.strokeRoundedRect(0, 0, WIDTH + 8, 280, { tl: 20, tr: 20, bl: 0, br: 0 });
    }).rt.setDepth(8000);

    // Scoreboard, TV style: navy bar, a row per side, games in a white box, points in gold, an orange dot by the server.
    const bx = WIDTH / 2 - 100;
    bakedShape(this, bx, 5, 200, 46, (g) => drawCard(g, 200, 46, { fill: TC.navy, stroke: TC.navyDark, radius: 12, shadow: 3 }), 6).rt.setDepth(9990);
    const rowY = [18, 38];
    const sbText = (x: number, y: number, str: string, size: number, color: string, ox: number): Phaser.GameObjects.Text =>
      this.add.text(x, y, str, { fontFamily: DISPLAY, resolution: HD_SCALE, fontSize: `${size}px`, color }).setOrigin(ox, 0.5).setDepth(10000);
    const gamesBoxes = bakedShape(this, bx + 118, rowY[0] - 9, 30, rowY[1] - rowY[0] + 18, (g) => {
      for (const y of rowY) {
        g.fillStyle(TC.white, 1);
        g.fillRoundedRect(0, y - rowY[0], 30, 18, 6);
      }
    }).rt.setDepth(9995);
    this.sb = {
      names: rowY.map((y, i) => this.fitName(sbText(bx + 24, y, this.teamLabel(i === 0 ? 1 : 0), 14, '#ffffff', 0), 92)),
      games: rowY.map((y) => sbText(bx + 133, y, '0', 15, NAVY_CSS, 0.5)),
      pts: rowY.map((y) => sbText(bx + 188, y, '0', 15, '#ffb800', 1)),
      dot: this.add.graphics().setDepth(10000),
      boxes: gamesBoxes,
      note: this.add.text(WIDTH / 2, 59, '', { fontFamily: DISPLAY, resolution: HD_SCALE, fontSize: '12px', color: '#ffffff' }).setOrigin(0.5).setStroke(NAVY_CSS, 4).setDepth(10000),
      title: sbText(WIDTH / 2, 28, '', 13, '#ffffff', 0.5).setVisible(false).setAlign('center'),
    };
    this.logText = this.add
      .text(WIDTH / 2, 399, '', {
        fontFamily: BODY, resolution: HD_SCALE,
        fontSize: '12px',
        fontStyle: '700',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: 330 },
      })
      .setOrigin(0.5, 0)
      .setDepth(10000);

    this.heightText = this.add
      .text(WIDTH / 2, 358, '', { fontFamily: DISPLAY, resolution: HD_SCALE, fontSize: '32px', color: '#ffffff' })
      .setOrigin(0.5)
      .setStroke(NAVY_CSS, 7)
      .setShadow(0, 3, '#000000', 4, true, true)
      .setDepth(9001)
      .setAlpha(0.92)
      .setVisible(false);
    this.heightSub = this.add
      .text(WIDTH / 2, 378, '', { fontFamily: DISPLAY, resolution: HD_SCALE, fontSize: '13px', color: '#ffffff' })
      .setOrigin(0.5)
      .setStroke(NAVY_CSS, 5)
      .setDepth(9001)
      .setVisible(false);

    this.makeExitButton();
    this.events.on('retire-confirmed', () => this.retire());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off('retire-confirmed');
      document.body.style.background = '';
    });

    this.refreshScore();
    this.refreshGuts();
    if (this.practice) {
      this.practiceMenu();
      this.time.delayedCall(400, () => showTip(this, 'practice'));
    }
    // a career match opens with the two pairs (now and then, see art/cutscenes.ts)
    else if (this.career) playCutscene(this, 'preMatch', this.cutCast(), () => this.coinToss());
    else this.coinToss();
  }

  // ---------- way out of the match ----------
  // Quick match and practice: GO TO MAIN MENU (tap twice). Career match: before the toss TOURNAMENT MENU (no harm done, the boost comes back),
  // after it END THE GAME, which asks first and then gives the match to the opponents by retirement.

  private makeExitButton(): void {
    const label = (): string => (!this.career ? 'GO TO\nMAIN MENU' : this.started ? 'END THE\nGAME' : 'TOURNAMENT\nMENU');
    let armed = false;
    const exit = makeThemeButton(this, 40, 27, 70, 36, label(), () => {
      if (this.over) return;
      if (!this.career) {
        if (!armed) {
          armed = true;
          exit.text.setText('SURE?');
          exit.text.setColor('#c62828');
          this.time.delayedCall(2500, () => {
            armed = false;
            exit.text.setText(label());
            exit.text.setColor(NAVY_CSS);
          });
          return;
        }
        this.leaveTo('TitleScene');
      } else if (!this.started) {
        // Nothing has happened yet: back to the tournament, with the boost of this match given back.
        if (this.inventoryBefore) {
          const inv = this.inventoryBefore;
          updateSave((d) => ({ ...d, profile: { ...d.profile, inventory: inv } }));
        }
        this.leaveTo('BracketScene');
      } else {
        this.scene.pause();
        this.scene.launch('ConfirmScene', {
          under: this.scene.key,
          title: 'RETIRE FROM THE MATCH?',
          text: 'You stop playing and your opponents win the match by retirement. This counts as a loss in the tournament.',
          yes: 'YES, RETIRE',
          no: 'KEEP PLAYING',
          event: 'retire-confirmed',
        });
      }
    }, 'secondary', 9);
    exit.text.setAlign('center').setLineSpacing(-2);
    this.exitButton = exit;
    for (const part of exit.parts) (part as Phaser.GameObjects.GameObject & { setDepth: (d: number) => unknown }).setDepth(10002);
    this.refreshExitLabel = (): void => {
      exit.text.setText(label());
    };
  }

  private refreshExitLabel: () => void = () => undefined;

  /** Leaves the match with a quick fade to light (the menus are light screens), not a hard cut. */
  private leaveTo(scene: string, data?: object): void {
    this.over = true;
    this.cameras.main.fadeOut(380, 234, 241, 250);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(scene, data));
  }

  /** END THE GAME confirmed: the hero retires and the match is lost by retirement. */
  private retire(): void {
    if (this.over) return;
    this.endMatch(1, true);
  }

  // ---------- coin toss: the side that wins it serves first ----------

  private coinToss(): void {
    ensureCoinTexture(this, 'H');
    ensureCoinTexture(this, 'T');
    this.setActive(null);
    this.say('COIN TOSS: call it!');
    this.time.delayedCall(350, () => showTip(this, 'toss'));
    this.showButtons('Coin toss', [
      { label: 'HEADS', tone: 'normal', onPick: () => this.flipCoinAnimation('heads') },
      { label: 'TAILS', tone: 'normal', onPick: () => this.flipCoinAnimation('tails') },
    ]);
    if (!this.career) {
      // A quick match: the side can still be changed here (a tournament match has it on the screen before; the boost of a match must not be used twice).
      const prof = getSave().profile;
      const label = themeText(this, 70, 582, 'I PLAY ON THE', { size: 11, color: TC.white, font: 'display', origin: [0, 0.5] }).setDepth(9996);
      this.menu.push(label);
      for (const b of makeSideSwitch(this, 258, 582, prof.heroSide, (side) => {
        updateSave((d) => ({ ...d, profile: { ...d.profile, heroSide: side } }));
        this.scene.restart({ practice: this.practice, career: this.career });
      }, 62, 24)) for (const o of b.parts as Phaser.GameObjects.GameObject[]) this.menu.push((o as Phaser.GameObjects.Graphics).setDepth(9996));
    }
    const hint = this.add
      .text(WIDTH / 2, 205, 'TOSS A COIN', { fontFamily: DISPLAY, resolution: HD_SCALE, fontSize: '34px', color: '#ffe066' })
      .setOrigin(0.5)
      .setStroke(NAVY_CSS, 8)
      .setDepth(9995);
    const sub = this.add
      .text(WIDTH / 2, 240, 'the winner serves first', { fontFamily: DISPLAY, resolution: HD_SCALE, fontSize: '14px', color: '#ffffff' })
      .setOrigin(0.5)
      .setStroke(NAVY_CSS, 5)
      .setDepth(9995);
    this.menu.push(hint, sub);
  }

  private flipCoinAnimation(call: CoinFace): void {
    this.clearMenu();
    this.started = true;
    this.refreshExitLabel();
    const result = flipCoin(Math.random);
    const winner = tossWinner(call, result, HUMAN_SIDE);
    const baseY = 330;
    const coin = this.add.image(WIDTH / 2, baseY, ensureCoinTexture(this, 'H')).setDepth(9996).setDisplaySize(60, 60);
    const coinKeys = { H: ensureCoinTexture(this, 'H'), T: ensureCoinTexture(this, 'T') };
    const shadow = this.add.image(WIDTH / 2, baseY + 36, SHADOW_KEY).setDisplaySize(40, 10).setAlpha(0.5).setDepth(9994);
    // Heads ends after whole turns, tails after a half turn more.
    const angleEnd = (result === 'heads' ? 5 : 5.5) * Math.PI * 2;
    sfx('coinFlip');
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 1500,
      ease: 'Sine.easeInOut',
      onUpdate: (tween: Phaser.Tweens.Tween) => {
        const t = tween.getValue() ?? 0;
        const a = angleEnd * t;
        const c = Math.cos(a);
        const grow = 1 + 0.25 * Math.sin(Math.PI * t);
        coin.setY(baseY - Math.sin(Math.PI * t) * 130);
        coin.setDisplaySize(60 * grow, 60 * Math.max(0.04, Math.abs(c)) * grow);
        coin.setTexture(c >= 0 ? coinKeys.H : coinKeys.T);
        shadow.setDisplaySize(40 * (1 - 0.5 * Math.sin(Math.PI * t)), 10 * (1 - 0.5 * Math.sin(Math.PI * t)));
      },
      onComplete: () => {
        coin.setDisplaySize(69, 69);
        this.tweens.add({ targets: coin, displayWidth: 60, displayHeight: 60, duration: 160 });
        sfx('coinLand');
        const word = result.toUpperCase();
        const you = winner === HUMAN_SIDE;
        this.say(`${word}! ${you ? 'You win the toss' : `${SIDE_NAME[winner]} wins the toss`} and serve${you ? '' : 's'} first.`);
        this.announce(you ? 'YOU SERVE FIRST!' : `${SIDE_NAME[winner]} SERVES FIRST`, you ? '#7dff9a' : '#ffb36a', `${word}: ${you ? 'you called it' : 'wrong call'}`, 205, 28);
        this.time.delayedCall(1900, () => {
          coin.destroy();
          shadow.destroy();
          this.server = winner;
          this.serverIdx = [0, 0];
          this.beginPoint();
        });
      },
    });
  }

  // ---------- arena: a pre-rendered, lit picture of the court (see art/hd/arenaHd.ts) ----------

  private drawArenaHd(): void {
    const themeId = themeIdOfCity(this.career?.city);
    const { netY, backKey } = ensureArenaTextures(this, themeId);
    this.add.image(0, 0, backKey).setOrigin(0, 0).setDisplaySize(WIDTH, HEIGHT).setDepth(-10);
    // The cheering crowd, in groups (each one another render of the stands), made one by one after the match has started so they do
    // not delay the opening.
    this.cheer = [];
    for (let k = 0; k < CHEER_GROUPS; k++) {
      this.time.delayedCall(600 + k * 400, () => {
        if (!this.scene.isActive()) return;
        this.cheer.push(this.add.image(0, 0, ensureCheerTexture(this, themeId, k)).setOrigin(0, 0).setDisplaySize(WIDTH, CHEER_STRIP_H).setDepth(-9).setAlpha(0));
      });
    }
    this.paintLetterbox(backKey);
    // The net is its own strip, sorted with the players: far players stand behind it, near players in front.
    const net = this.add.image(0, netY, ARENA_NET_KEY).setOrigin(0, 0).setDepth(project(0, NET_Z).y);
    net.setDisplaySize(WIDTH, net.height / HD_SCALE);
  }

  /**
   * On a phone taller than 9:16 the canvas is centred with bars above and below. The page behind it takes the colour of the
   * picture's top edge (crowd) above and of the command panel below, so the match looks like it fills the whole screen.
   */
  private paintLetterbox(backKey: string): void {
    try {
      const img = this.textures.get(backKey).getSourceImage() as HTMLCanvasElement;
      const g = img.getContext?.('2d');
      if (!g) return;
      const row = g.getImageData(0, 0, img.width, 2).data;
      let r = 0, gr = 0, b = 0, n = 0;
      for (let i = 0; i < row.length; i += 4) { r += row[i]; gr += row[i + 1]; b += row[i + 2]; n++; }
      const top = `rgb(${Math.round(r / n)},${Math.round(gr / n)},${Math.round(b / n)})`;
      document.body.style.background = `linear-gradient(to bottom, ${top} 50%, #0b2a5b 50%)`;
    } catch {
      /* the plain page colour stays */
    }
  }

  // ---------- players and ball ----------

  private createViews(): void {
    ([0, 1] as SideIndex[]).forEach((side) => {
      TEAMS[side].forEach((player, idx) => {
        this.pos[player.id] = restPos(side, idx, 'back');
        const facing: Facing = side === 0 ? 'back' : 'front';
        // Each player has one picture of his own, drawn again from the rig whenever the pose changes (far players at a lower resolution).
        const unit = side === 0 ? RIG_UNIT_NEAR : RIG_UNIT_FAR;
        const texKey = `rig:${player.id}`;
        if (this.textures.exists(texKey)) this.textures.remove(texKey);
        const canvas = this.textures.createCanvas(texKey, Math.round(VIEW.w * unit), Math.round(VIEW.h * unit))!;
        const sprite = this.add.image(0, 0, texKey);
        const label = this.add
          .text(0, 0, '', { fontFamily: BODY, resolution: HD_SCALE, fontSize: '10px', fontStyle: '800', color: '#ffffff', align: 'center' })
          .setOrigin(0.5, side === 0 ? 0 : 1)
          .setStroke(NAVY_CSS, 4)
          .setDepth(9000);
        const baked = bakedShape(this, 0, 0, GUTS_BAR_W, GUTS_BAR_H, () => undefined, 3);
        const bar = baked.rt.setDepth(9000);
        this.views[player.id] = { sprite, label, bar, barRepaint: baked.repaint, player, side, lift: 0, pose: 'ready', facing, busyUntil: 0, rig: new Rig(), canvas, unit, drawn: '', trail: [], reactUntil: 0, barShown: -1, body: newBody(Object.keys(this.views).length * 1.7), look: { rotation: 0, scaleX: 1, scaleY: 1, bob: 0, braked: false }, lastFeet: null };
        this.showSprite(player.id);
        this.placeView(player.id);
      });
    });
    this.redrawOverlay();
  }

  private placeView(id: string): void {
    const v = this.views[id];
    const pos = this.pos[id];
    const p = project(pos.x, pos.z);
    const spriteHeight = p.scale * VISUAL_HEIGHT_M;
    const bob = v.look.bob * p.scale;
    placeToonSprite(v.sprite, p.x, p.y - v.lift - bob, spriteHeight);
    v.sprite.setScale(v.sprite.scaleX * v.look.scaleX, v.sprite.scaleY * v.look.scaleY).setRotation(v.look.rotation);
    v.sprite.setDepth(p.y);
    // Hero: name below the feet, bar under the name. Opponents: bar right over the head, name above it.
    const top = p.y - spriteHeight - 2 - v.lift;
    v.label.setPosition(p.x, v.side === 0 ? p.y + 6 : top - GUTS_BAR_H - 3);
    this.drawGutsBar(v, p.x, v.side === 0 ? p.y + 6 + 18 : top - GUTS_BAR_H);
  }

  /** A rounded bar: the fill shrinks with the guts and changes colour from green to red. It is drawn around its own origin and only re-drawn when the guts change; moving it is just a position. */
  private drawGutsBar(v: PlayerView, cx: number, y: number): void {
    v.bar.setPosition(cx - GUTS_BAR_W / 2 - 3, y - 3);
    const ratio = Math.max(0, Math.min(1, (this.guts[v.player.id] ?? v.player.maxGuts) / v.player.maxGuts));
    const shown = Math.round(ratio * GUTS_BAR_W);
    if (v.barShown === shown) return;
    v.barShown = shown;
    v.barRepaint((g) => {
      g.fillStyle(TC.navy, 0.92).fillRoundedRect(-1.5, -1.5, GUTS_BAR_W + 3, GUTS_BAR_H + 3, (GUTS_BAR_H + 3) / 2);
      if (ratio > 0) {
        const w = Math.max(GUTS_BAR_H, Math.round(GUTS_BAR_W * ratio));
        g.fillStyle(gutsBarColor(ratio), 1).fillRoundedRect(0, 0, w, GUTS_BAR_H, GUTS_BAR_H / 2);
        g.fillStyle(0xffffff, 0.35).fillRoundedRect(2, 1, Math.max(2, w - 4), 2, 1);
      }
      g.lineStyle(1.2, 0xffffff, 0.9).strokeRoundedRect(-1.5, -1.5, GUTS_BAR_W + 3, GUTS_BAR_H + 3, (GUTS_BAR_H + 3) / 2);
    });
  }

  /** Shadows under players and ball, and the ring under the player who has to act. */
  private redrawOverlay(): void {
    for (const id of Object.keys(this.views)) {
      const p = project(this.pos[id].x, this.pos[id].z);
      let sh = this.shadows[id];
      if (!sh) sh = this.shadows[id] = this.add.image(0, 0, SHADOW_KEY).setDepth(1).setAlpha(0.35);
      sh.setPosition(p.x, p.y).setDisplaySize(p.scale * 1.1, p.scale * 0.4);
    }
    const b = project(this.ballFloor.x, this.ballFloor.z);
    this.ballShadow.setPosition(b.x, b.y).setDisplaySize(Math.max(5, b.scale * 0.35), Math.max(2, b.scale * 0.12)).setVisible(true);
    if (this.activeId) {
      const p = project(this.pos[this.activeId].x, this.pos[this.activeId].z);
      this.ring.setPosition(p.x, p.y).setDisplaySize(p.scale * 1.5 + 4, p.scale * 0.6 + 4).setVisible(true);
    } else {
      this.ring.setVisible(false);
    }
  }

  private setActive(id: string | null): void {
    this.activeId = id;
    this.redrawOverlay();
  }

  /** The ball of a serve is held in the server's free hand: in front of the body (towards the net) and on the side of that hand, at waist height. */
  private putServeBall(serverId: string, side: SideIndex): void {
    const pos = this.pos[serverId];
    // The hero is seen from behind and the opponents from the front (mirrored), so the free hand is on opposite sides of the screen.
    const dx = side === 0 ? -0.4 : 0.4;
    const dz = side === 0 ? -0.5 : 0.5;
    this.setBall(pos.x + dx, pos.z + dz, this.ballH, false);
  }

  /** Places the ball. `trail` = false puts it down without a trail (a new serve). */
  private setBall(x: number, z: number, h: number, trail = true): void {
    const p = project(x, z, h);
    const prev = this.ballFloor;
    this.ballFloor = { x, z };
    const d = Math.max(6, p.scale * 0.3);
    const now = this.time.now;
    if (trail) {
      const dt = Math.min(0.05, Math.max(0, (now - this.ballTurnedAt) / 1000));
      if (dt > 0) {
        // A ball on the ground turns only as fast as it rolls: it stops spinning when it stops moving.
        const rollSpeed = Math.hypot(x - prev.x, z - prev.z) / dt;
        const k = h < 0.06 ? Math.min(1, rollSpeed / 2.5) : 1;
        this.ballR = rotate(this.ballR, [this.ballOmega[0] * k, this.ballOmega[1] * k, this.ballOmega[2] * k], dt);
        // The picture of the ball is re-drawn and uploaded to the GPU: at most about 20 times a second is enough for a spinning ball.
        if (now - this.ballDrawnAt >= 50) {
          this.ballDrawnAt = now;
          this.redrawBall(this.ballR);
        }
      }
    }
    this.ballTurnedAt = now;
    this.ball.setPosition(p.x, p.y).setDisplaySize(d, d).setVisible(true);
    this.ballGlow.setVisible(true);
    this.ballGlow.setPosition(p.x, p.y).setDisplaySize(d * 3.4, d * 3.4);
    // A ball lying on (or just above) the floor is sorted with the players, so a player standing in front covers it.
    const low = h < 0.4;
    this.ball.setDepth(low ? p.y + 0.5 : 5000);
    this.ballGlow.setDepth(low ? p.y + 0.4 : 4999);
    if (trail) {
      this.trail.push({ x: p.x, y: p.y, d });
      if (this.trail.length > 14) this.trail.shift();
    } else {
      this.trail = [];
    }
    this.drawTrail();
    this.redrawOverlay();
  }

  private drawTrail(): void {
    const n = this.trail.length;
    this.trailDots.forEach((img, i) => {
      const t = this.trail[i];
      if (!t) {
        img.setVisible(false);
        return;
      }
      const k = (i + 1) / n;
      const d = t.d * (0.35 + 0.65 * k);
      img.setPosition(t.x, t.y).setDisplaySize(d, d).setAlpha(0.3 * k).setVisible(true);
    });
  }

  /** Dust where the ball bounces, a flash where it hits the glass or the net. */
  private impactFx(e: FlightEvent, path: Sample[]): void {
    const p = project(e.x, e.z, e.h);
    // The sound depends on the material and on how hard the ball arrives.
    const { v, vy } = speedAt(path, e.t);
    if (e.kind === 'bounce') {
      if (Math.abs(vy) > 0.6) impactSound('floor', Math.min(1, (Math.abs(vy) / 11) * 0.8 + (v / 40) * 0.2));
    } else if (e.kind === 'glass' || e.kind === 'mesh' || e.kind === 'net') {
      impactSound(e.kind, Math.min(1, v / (e.kind === 'net' ? 20 : 24)));
    }
    if (e.kind === 'bounce' && this.powerStyle !== null) {
      this.powerImpact(p, this.powerStyle);
      this.powerStyle = null;
    }
    if (e.kind === 'bounce') {
      const puff = this.add.ellipse(p.x, p.y, Math.max(4, p.scale * 0.22), Math.max(2, p.scale * 0.09), 0xffffff, 0.55).setDepth(p.y);
      this.tweens.add({ targets: puff, scaleX: 3.4, scaleY: 2, alpha: 0, duration: 340, ease: 'Quad.easeOut', onComplete: () => puff.destroy() });
    } else if (e.kind === 'glass' || e.kind === 'mesh') {
      const color = e.kind === 'glass' ? 0xcfeaff : 0xdde3f0;
      const flash = this.add.ellipse(p.x, p.y, Math.max(4, p.scale * 0.2), Math.max(8, p.scale * 0.8), color, 0.85).setDepth(4000);
      this.tweens.add({ targets: flash, scaleX: 2.6, scaleY: 1.3, alpha: 0, duration: 280, onComplete: () => flash.destroy() });
    } else if (e.kind === 'net') {
      const flash = this.add.circle(p.x, p.y, Math.max(3, p.scale * 0.15), 0xffffff, 0.8).setDepth(4000);
      this.tweens.add({ targets: flash, scale: 3, alpha: 0, duration: 260, onComplete: () => flash.destroy() });
    }
  }

  /**
   * Where a Por Cuatro / strong Por Tres hits the court: a bright flash, a shock ring on the floor, sparks flying out and a scuff mark,
   * and a small shake of the camera (Por Cuatro), so that one can feel the power go into the floor.
   */
  private powerImpact(p: { x: number; y: number; scale: number }, style: 'x4' | 'x3'): void {
    const big = style === 'x4';
    const k = big ? 1 : 0.7;
    const core = this.add.circle(p.x, p.y, Math.max(5, p.scale * 0.3) * k, 0xffffff, 0.95).setDepth(9990);
    this.tweens.add({ targets: core, scale: 3.2, alpha: 0, duration: 190, ease: 'Quad.easeOut', onComplete: () => core.destroy() });
    const glow = this.add.ellipse(p.x, p.y, Math.max(10, p.scale * 0.7) * k, Math.max(5, p.scale * 0.3) * k, 0xffb347, 0.75).setDepth(9989);
    this.tweens.add({ targets: glow, scaleX: 4.2, scaleY: 3, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => glow.destroy() });
    for (let i = 0; i < (big ? 3 : 2); i++) {
      const ring = this.add.ellipse(p.x, p.y, 16 * k, 7 * k, 0xffffff, 0).setStrokeStyle(big ? 3 : 2, i === 0 ? 0xffe066 : 0xffffff, 1).setDepth(9988);
      this.tweens.add({ targets: ring, scaleX: 3 + i * 1.6, scaleY: 3 + i * 1.6, alpha: 0, delay: i * 70, duration: 460, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    }
    const n = big ? 10 : 6;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + (i % 2) * 0.2;
      const len = (big ? 34 : 22) * (0.7 + 0.6 * ((i * 7) % 5) / 4);
      const spark = this.add.rectangle(p.x, p.y, 8 * k, 2.5 * k, i % 2 === 0 ? 0xffe066 : 0xffffff, 1).setDepth(9991).setRotation(ang);
      this.tweens.add({ targets: spark, x: p.x + Math.cos(ang) * len, y: p.y + Math.sin(ang) * len * 0.45, alpha: 0, scaleX: 0.3, duration: 330, ease: 'Quad.easeOut', onComplete: () => spark.destroy() });
    }
    const scuff = this.add.ellipse(p.x, p.y, 14 * k, 6 * k, 0x000000, 0.28).setDepth(p.y - 1);
    this.tweens.add({ targets: scuff, alpha: 0, delay: 700, duration: 900, onComplete: () => scuff.destroy() });
    this.cameras.main.shake(big ? 110 : 70, big ? 0.0035 : 0.002);
  }

  /** A big, short-lived banner such as ACE! in the middle of the court, with the shot that won it underneath. */
  private announce(text: string, color: string, sub?: string, y = 205, size = 34): void {
    const t = this.add
      .text(WIDTH / 2, y, text, { fontFamily: DISPLAY, resolution: HD_SCALE, fontSize: `${size}px`, color })
      .setOrigin(0.5)
      .setStroke(NAVY_CSS, 8)
      .setShadow(0, 4, NAVY_CSS, 0, true, true)
      .setDepth(9995)
      .setAlpha(0)
      .setScale(0.6);
    this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 170, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, delay: 1470, duration: 260, onComplete: () => t.destroy() });
    if (!sub) return;
    const chip = this.add.container(WIDTH / 2, y + 40).setDepth(9995).setAlpha(0).setScale(0.4);
    const label = this.add
      .text(0, 0, sub, { fontFamily: DISPLAY, resolution: HD_SCALE, fontSize: '17px', color: NAVY_CSS })
      .setOrigin(0.5);
    const bg = this.add.graphics();
    bg.fillStyle(0xffb800, 1);
    bg.fillRoundedRect(-label.width / 2 - 12, -label.height / 2 - 4, label.width + 24, label.height + 8, 12);
    bg.lineStyle(3, 0x0b2a5b, 1);
    bg.strokeRoundedRect(-label.width / 2 - 12, -label.height / 2 - 4, label.width + 24, label.height + 8, 12);
    chip.add([bg, label]);
    this.tweens.add({ targets: chip, alpha: 1, scale: 1, delay: 120, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: chip, alpha: 0, delay: 1530, duration: 260, onComplete: () => chip.destroy() });
  }

  /**
   * Powerful Smash: when a Por Cuatro comes off the back glass instead of flying out over it. An orange flash, a punch of the camera,
   * a burst of streaks around a flaming banner above the court, and a heavy boom.
   */
  /** A burst at the racket on contact, bigger for a harder shot (`power` 0..1): a flash, a ring and a few sparks for the hardest. */
  private hitFlash(id: string, power: number): void {
    const v = this.views[id];
    const p = project(this.pos[id].x, this.pos[id].z);
    const h = p.scale * VISUAL_HEIGHT_M;
    const x = p.x + (v.sprite.flipX ? -1 : 1) * h * 0.22;
    const y = p.y - v.lift - h * (this.stance[id] === 'smash' ? 1.05 : 0.55);
    const r = Math.max(3, h * (0.06 + 0.08 * power));
    const flash = this.add.circle(x, y, r, 0xffffff, 0.9).setDepth(p.y + 1);
    this.tweens.add({ targets: flash, scale: 2.2 + power * 1.5, alpha: 0, duration: 140 + 120 * power, ease: 'Quad.easeOut', onComplete: () => flash.destroy() });
    if (power < 0.6) return;
    const ring = this.add.circle(x, y, r, 0xffffff, 0).setStrokeStyle(2, 0xffe066, 1).setDepth(p.y + 1);
    this.tweens.add({ targets: ring, scale: 4 + power * 2, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2 + Math.random() * 0.6;
      const spark = this.add.rectangle(x, y, r * 1.6, 1.6, 0xfff3b0, 1).setRotation(ang).setDepth(p.y + 1);
      this.tweens.add({ targets: spark, x: x + Math.cos(ang) * r * 5, y: y + Math.sin(ang) * r * 5, alpha: 0, duration: 220, ease: 'Quad.easeOut', onComplete: () => spark.destroy() });
    }
  }

  private powerSmashFx(): void {
    powerSmashSound();
    this.cameras.main.flash(150, 255, 150, 60);
    this.cameras.main.shake(220, 0.006);
    const y = 150;
    const rays = this.add.graphics().setDepth(9993);
    const draw = (k: number): void => {
      rays.clear();
      const n = 16;
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * Math.PI * 2;
        const r0 = 38 + 120 * k;
        const r1 = r0 + 30 + 40 * (1 - k);
        rays.lineStyle(i % 2 === 0 ? 4 : 2, i % 2 === 0 ? 0xffe066 : 0xff7a3d, 1 - k);
        rays.lineBetween(WIDTH / 2 + Math.cos(ang) * r0, y + Math.sin(ang) * r0 * 0.55, WIDTH / 2 + Math.cos(ang) * r1, y + Math.sin(ang) * r1 * 0.55);
      }
    };
    draw(0);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 520,
      ease: 'Quad.easeOut',
      onUpdate: (tw: Phaser.Tweens.Tween) => draw(tw.getValue() ?? 0),
      onComplete: () => rays.destroy(),
    });
    this.announce('POWERFUL SMASH!', '#ff7a3d', undefined, y, 30);
  }

  /** A flash of light and a shock ring where the ball is when a point is won. */
  private winFlash(): void {
    this.cameras.main.flash(170, 255, 246, 170);
    const p = project(this.ballFloor.x, this.ballFloor.z);
    for (let i = 0; i < 2; i++) {
      const ring = this.add.circle(p.x, p.y, 10, 0xffffff, 0).setStrokeStyle(3, 0xffe066, 1).setDepth(9994).setScale(0.3);
      this.tweens.add({ targets: ring, scale: 4 + i * 2, alpha: 0, delay: i * 120, duration: 520, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    }
  }



  /**
   * Puts the right picture on the sprite for the player's pose and facing: front, back, or profile for a player running or turned sideways.
   */
  private showSprite(id: string): void {
    const v = this.views[id];
    const view = toonViewOf(v.facing, v.side);
    // The front view is mirrored (the racket is on the picture's right and everybody is right-handed); the profile faces right and is mirrored for a runner going left.
    v.sprite.setFlipX(view === 'front' || (view === 'side' && v.facing === 'left'));
    this.drawRig(id, true);
  }

  /**
   * Draws the player's picture from his rig when it changed (a new pose or view). `force`: now, even beyond the frame's budget.
   * Returns whether it drew. While the racket moves fast a smear of its last positions is drawn behind it.
   */
  private drawRig(id: string, force = false): boolean {
    const v = this.views[id];
    const view = toonViewOf(v.facing, v.side);
    const pose = v.rig.pose;
    const sig = `${view}|${v.trail.length}|${poseSignature(pose)}`;
    if (!force && sig === v.drawn) return false;
    v.drawn = sig;
    const ctx = v.canvas.getContext();
    const u = v.unit;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, v.canvas.width, v.canvas.height);
    ctx.setTransform(u, 0, 0, u, -VIEW.x * u, -VIEW.y * u);
    if (view !== 'side' && v.trail.length > 1) {
      for (let i = 1; i < v.trail.length; i++) {
        const [a1, b1] = v.trail[i - 1];
        const [a2, b2] = v.trail[i];
        ctx.globalAlpha = (i / v.trail.length) * 0.45;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(a1[0], a1[1]);
        ctx.lineTo(b1[0], b1[1]);
        ctx.lineTo(b2[0], b2[1]);
        ctx.lineTo(a2[0], a2[1]);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    drawOps(ctx, buildToon(v.player.appearance, view, pose, false));
    v.canvas.refresh();
    return true;
  }

  /** Moves every rig on and draws the pictures that changed, within a budget of milliseconds per frame (the rest wait a frame, in turn). */
  private stepRigs(now: number, dt: number): void {
    const ids = Object.keys(this.views);
    const t0 = performance.now();
    this.rigTurn = (this.rigTurn + 1) % Math.max(1, ids.length);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[(this.rigTurn + i) % ids.length];
      const v = this.views[id];
      const before = v.rig.pose;
      // eyes on the ball: the head turns towards it while the player waits (not in a stroke, a run or a reaction)
      const view = toonViewOf(v.facing, v.side);
      if (view !== 'side' && this.time.now >= v.busyUntil && this.time.now >= v.reactUntil && !v.rig.playing(now)) {
        const look = Math.round(Math.max(-1, Math.min(1, (this.ballFloor.x - this.pos[id].x) / 3)) * 2) / 2;
        v.rig.setLook(view === 'front' ? -look : look);
      } else v.rig.setLook(null);
      const pose = v.rig.update(now, dt);
      // the smear: racket ends while the racket moves fast during a stroke
      if (this.time.now < v.busyUntil && pose !== before) {
        const [n1, f1] = racketEnds(before);
        const [n2, f2] = racketEnds(pose);
        const speed = Math.hypot(f2[0] - f1[0], f2[1] - f1[1]) / Math.max(1, dt);
        if (speed > 0.9) v.trail.push([n2, f2]);
        else if (v.trail.length) v.trail.shift();
        if (v.trail.length > 6) v.trail.shift();
        void n1;
      } else if (v.trail.length) v.trail.shift();
      if (performance.now() - t0 > RIG_BUDGET_MS && i > 0) continue;
      this.drawRig(id);
    }
  }

  private rigTurn = 0;

  /**
   * A player who has to run far sideways for the ball ends the run in a lunge (`minReach`: at least this far, 1 for a ball he cannot reach).
   * The direction is the run's, in the picture's own x (the front view is mirrored).
   */
  private planLunge(id: string, target: CourtPos, ms: number, minReach: number): void {
    const v = this.views[id];
    const dx = target.x - this.pos[id].x;
    const dist = Math.hypot(dx, target.z - this.pos[id].z);
    const reach = Math.max(minReach, Math.min(1, (dist - LUNGE_FROM_M) / 2.4));
    if (reach <= 0 || Math.abs(dx) < 0.8) {
      delete this.lunge[id];
      return;
    }
    const mirrored = toonViewOf(this.defaultFacing(id), v.side) === 'front';
    this.lunge[id] = { dir: (dx > 0 ? 1 : -1) * (mirrored ? -1 : 1), reach, until: this.time.now + ms + 900 };
  }

  /** The lunge planned for the player, if it is still valid. */
  private lungeOf(id: string): { dir: number; reach: number } | null {
    const l = this.lunge[id];
    return l && this.time.now <= l.until ? l : null;
  }

  /** 0 for a player with guts to spare, up to 1 on an empty bar (below a third of it he shows it: lower, bent, breathing hard). */
  private tiredness(id: string): number {
    const p = TEAMS.flat().find((q) => q.id === id);
    const g = this.guts[id];
    if (!p || g === undefined) return 0;
    return Math.max(0, Math.min(1, (0.35 - g / p.maxGuts) / 0.35));
  }

  /** Plays a reaction on a player who is not in the middle of a stroke, facing the court. */
  private react(id: string, steps: RigStep[]): void {
    const v = this.views[id];
    if (this.time.now < v.busyUntil) return;
    this.setFacing(id, this.defaultFacing(id));
    v.rig.play(this.time.now, steps);
    v.reactUntil = this.time.now + steps.reduce((a, s) => a + s[0], 0);
  }

  /** Which side (in the picture's own x) the partner stands on, and whether he is close enough to slap hands. */
  private partnerSide(id: string): { dir: number; close: boolean } {
    const side = this.views[id].side;
    const mate = TEAMS[side].find((p) => p.id !== id);
    if (!mate) return { dir: 1, close: false };
    const dx = this.pos[mate.id].x - this.pos[id].x;
    const dist = Math.hypot(dx, this.pos[mate.id].z - this.pos[id].z);
    const mirrored = toonViewOf(this.defaultFacing(id), side) === 'front';
    return { dir: (dx >= 0 ? 1 : -1) * (mirrored ? -1 : 1), close: dist < 3.4 };
  }

  /**
   * Reactions when a point ends: the winner of the point pumps a fist (or slaps hands with a partner close by), the other winner is pleased;
   * the player who made the mistake holds his head, the others drop their shoulders, an exhausted one puts his hands on his knees.
   */
  private reactToPoint(step: Step, coastMs: number): void {
    const won = step.pointWinner;
    if (won === null || this.practice) return;
    const scorer = step.outcome === 'winner' || step.outcome === 'ace' ? TEAMS[step.side][step.attackerIdx].id : null;
    const culprit = step.outcome === 'error' || step.outcome === 'double-fault' ? TEAMS[step.side][step.attackerIdx].id : null;
    this.time.delayedCall(Math.max(420, Math.min(coastMs, 1600)), () => {
      if (this.over) return;
      for (const p of TEAMS[won]) {
        const ps = this.partnerSide(p.id);
        if (ps.close) this.react(p.id, highFiveSteps(ps.dir));
        else this.react(p.id, p.id === scorer ? fistSteps(true) : fistSteps(false));
      }
      for (const p of TEAMS[other(won)]) {
        if (p.id === culprit) this.react(p.id, frustrationSteps());
        else if (this.tiredness(p.id) > 0.5) this.react(p.id, tiredSteps());
        else this.react(p.id, disappointSteps());
      }
      // a high five shows where the hands meet
      const mates = TEAMS[won];
      if (this.partnerSide(mates[0].id).close) this.time.delayedCall(300, () => this.slapFx(mates[0].id, mates[1].id));
    });
  }

  /** A small burst between two players' raised hands. */
  private slapFx(a: string, b: string): void {
    const pa = project(this.pos[a].x, this.pos[a].z);
    const pb = project(this.pos[b].x, this.pos[b].z);
    const h = ((pa.scale + pb.scale) / 2) * VISUAL_HEIGHT_M;
    const x = (pa.x + pb.x) / 2;
    const y = (pa.y + pb.y) / 2 - h * 1.08;
    const star = this.add.star(x, y, 6, h * 0.05, h * 0.12, 0xffffff, 0.95).setDepth(9000);
    this.tweens.add({ targets: star, scale: 2, alpha: 0, angle: 40, duration: 320, ease: 'Quad.easeOut', onComplete: () => star.destroy() });
  }

  /** A game or the match won: the winners raise their rackets (both arms and a few bounces for the match), the losers hang their heads. */
  private celebrate(winner: SideIndex, match: boolean): void {
    for (const p of TEAMS[winner]) {
      this.react(p.id, celebrateSteps(match));
      this.jump(p.id, match ? 14 : 8, match ? 320 : 260);
      if (match) this.time.delayedCall(420, () => this.jump(p.id, 12, 300));
    }
    if (match) for (const p of TEAMS[other(winner)]) this.react(p.id, disappointSteps());
  }

  /**
   * The crowd reacts once a point is over (never during a rally, so nothing pulls the eye from the ball). It is split into groups:
   * after an ordinary point nobody, one, two or now and then three groups stand up and cheer (more often when the hero's team won it,
   * and at least two after a long rally); after a game most of them, after the match everyone, with camera flashes on bigger moments.
   * Each group stands up a little after the other, so it never looks like one switch.
   */
  private crowdCheer(moment: 'point' | 'rally' | 'game' | 'match', heroWon: boolean): void {
    const r = Math.random() - (heroWon ? 0.12 : 0);
    let groups = r < 0.28 ? 0 : r < 0.64 ? 1 : r < 0.9 ? 2 : 3;
    if (moment === 'rally') groups = Math.max(groups, 2);
    if (moment === 'game') groups = Math.random() < 0.5 ? 3 : CHEER_GROUPS;
    if (moment === 'match') groups = CHEER_GROUPS;
    const hold = moment === 'match' ? 1800 : moment === 'game' ? 1300 : moment === 'rally' ? 1000 : 650;
    const order = Phaser.Utils.Array.Shuffle([...this.cheer]);
    order.slice(0, groups).forEach((img, i) => {
      this.tweens.killTweensOf(img);
      this.tweens.chain({
        targets: img,
        tweens: [
          { alpha: 1, duration: 160, delay: i * 90 + Math.random() * 160, ease: 'Quad.easeOut' },
          { alpha: 1, duration: hold + (Math.random() - 0.5) * 400 },
          { alpha: 0, duration: 550 + Math.random() * 300, ease: 'Quad.easeIn' },
        ],
      });
    });
    const flashes = moment === 'match' ? 18 : moment === 'game' ? 9 : groups >= 2 ? Math.floor(Math.random() * 4) : 0;
    if (flashes <= 0) return;
    this.headSpots ??= standHeads();
    const heads = this.headSpots;
    for (let i = 0; i < flashes; i++) {
      const at = heads[Math.floor(Math.random() * heads.length)];
      if (!at) break;
      this.time.delayedCall(80 + Math.random() * (hold + 300), () => {
        const f = this.add.image(at.x, at.y - 2, DOT_KEY).setDepth(-8).setTint(0xffffff).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(5, 5).setAlpha(0.95);
        this.tweens.add({ targets: f, alpha: 0, displayWidth: 2, displayHeight: 2, duration: 160, ease: 'Quad.easeIn', onComplete: () => f.destroy() });
      });
    }
  }

  /** Shows the player in a pose (glides into it; a stroke's preparation is wound up a little further, see `loadPose`). */
  private setPose(id: string, pose: PoseName): void {
    const v = this.views[id];
    if (pose === 'ready' && this.time.now < v.reactUntil) return;
    v.pose = pose;
    const prep = pose.endsWith('Prep');
    let spec = prep ? loadPose(pose, this.hitHeight[id]) : pose.endsWith('Hit') ? forHeight(POSES[pose], this.hitHeight[id]) : pose === 'ready' ? tiredReady(this.tiredness(id)) : POSES[pose];
    const lunge = pose === 'ready' ? null : this.lungeOf(id);
    if (lunge && toonViewOf(v.facing, v.side) !== 'side') spec = lungePose(spec, lunge.dir, lunge.reach);
    v.rig.to(this.time.now, spec, lunge ? 200 : prep ? 220 : 150, lunge ? easeOut : inOut);
  }

  /** Shows the run cycle at `frame` (fractional: the in-betweens); seen from the side in profile, else running towards or away. */
  private setRunFrame(id: string, frame: number): void {
    const v = this.views[id];
    v.rig.drive(runFrame(frame, toonViewOf(v.facing, v.side) === 'side'));
  }

  /** Where a player who watches the ball turns his head: -1, 0 or 1 in screen terms (the ball is clearly to his left or right, or ahead). */
  private lookToward(id: string): number {
    const dx = this.ballFloor.x - this.pos[id].x;
    return Math.abs(dx) < 1.3 ? 0 : dx > 0 ? 1 : -1;
  }

  /** Shows the side-step shuffle at `frame` (fractional); the player keeps his face to the court and his eyes on the ball. */
  private setShuffleFrame(id: string, frame: number, screenDir: number): void {
    const v = this.views[id];
    const flip = toonViewOf(v.facing, v.side) === 'front' ? -1 : 1;
    v.rig.drive(shuffleFrame(frame, flip * screenDir, flip * this.lookToward(id)));
  }

  update(time: number, delta: number): void {
    this.stepBodies(time / 1000, delta / 1000);
    this.stepRigs(this.time.now, delta);
  }

  /** Weight and momentum: every player's picture leans, squashes, bobs and breathes with the way his feet move (bodyDynamics.ts). */
  private stepBodies(time: number, dt: number): void {
    if (dt <= 0) return;
    for (const [id, v] of Object.entries(this.views)) {
      const pos = this.pos[id];
      if (!pos) continue;
      const p = project(pos.x, pos.z);
      const last = v.lastFeet ?? p;
      v.lastFeet = { x: p.x, y: p.y };
      const ppm = Math.max(1, p.scale);
      v.look = stepBody(v.body, (p.x - last.x) / ppm, (p.y - last.y) / ppm, dt, time, this.time.now >= v.busyUntil, this.tiredness(id));
      if (v.look.braked) this.brakeDust(p.x, p.y, p.scale, v.body.vx);
      this.placeView(id);
    }
  }

  /** Two small puffs of sand behind the feet of a player who stops hard. */
  private brakeDust(x: number, y: number, scale: number, vx: number): void {
    for (let i = 0; i < 2; i++) {
      const dir = vx >= 0 ? -1 : 1;
      const puff = this.add.ellipse(x + dir * scale * (0.12 + i * 0.12), y - 1, Math.max(4, scale * 0.2), Math.max(2, scale * 0.08), 0xf3e6c8, 0.7).setDepth(y - 1);
      this.tweens.add({ targets: puff, x: puff.x + dir * scale * 0.25, scaleX: 2.6, scaleY: 1.8, alpha: 0, delay: i * 40, duration: 380, ease: 'Quad.easeOut', onComplete: () => puff.destroy() });
    }
  }

  private defaultFacing(id: string): Facing {
    return this.views[id].side === 0 ? 'back' : 'front';
  }

  private setFacing(id: string, facing: Facing): void {
    const v = this.views[id];
    if (v.facing === facing) return;
    v.facing = facing;
    this.showSprite(id);
  }

  /** A runner looks where he runs: sideways in profile, otherwise towards or away from the camera. */
  private runFacing(dx: number, dz: number): Facing {
    if (Math.abs(dx) >= Math.abs(dz) * 1.1) return dx > 0 ? 'right' : 'left';
    return dz > 0 ? 'front' : 'back';
  }

  /** The stroke: contact pose, follow-through, then back to ready. Overhead shots are played with a jump. */
  private swing(id: string, shot: ShotDef | null, aimDx = 0): void {
    const v = this.views[id];
    const bid = shot === null ? null : baseId(shot);
    const smashing = bid === null || bid.startsWith('smash_') || bid === 'rulo';
    const grounded = bid === 'bandeja' || bid === 'vibora';
    // The rulo is hit overhead with the body turned sideways, towards the fence it is played to.
    if (shot?.id === 'rulo') this.setFacing(id, aimDx >= 0 ? 'right' : 'left');
    const prep = this.stance[id];
    // Which way the racket goes: a jumping smash, an overhead on the ground (bandeja, vibora), from above and downwards (volley, dejada, bajada;
    // a high ball is taken overhead), or an ordinary forehand / backhand (the ball's side).
    const side = prep === 'bh' || prep === 'bhv' ? 'bh' : 'fh';
    const stance: Stance = smashing ? 'smash' : grounded ? 'ov' : shot?.downward === true ? (prep === 'smash' ? 'ov' : side === 'bh' ? 'bhv' : 'fhv') : prep === undefined || prep === 'smash' || prep === 'ov' ? 'fh' : side;
    v.busyUntil = this.time.now + 520;
    kickBody(v.body, stance === 'smash' ? 0.6 : 1);
    v.trail = [];
    const lunge = this.lungeOf(id);
    const legs = lunge && stance !== 'smash' ? lungePose(POSES.ready, lunge.dir, lunge.reach) : null;
    delete this.lunge[id];
    const height = this.hitHeight[id];
    delete this.hitHeight[id];
    if (shot === null) {
      // The serve: hit low after a bounce, like a forehand, no jump.
      v.rig.play(this.time.now, strokeSteps('fh', 0.6));
    } else if (stance === 'smash') {
      // A jump off the left leg: up quickly, the racket meets the ball on the way up, a longer fall, the landing squashes the body.
      const air = 330;
      v.rig.play(this.time.now, smashSteps(air));
      this.jump(id, 24, air);
      this.cameras.main.shake(90, 0.0035);
    } else {
      v.rig.play(this.time.now, strokeSteps(stance as 'fh' | 'bh' | 'ov' | 'fhv' | 'bhv', stance === 'ov' ? undefined : height, legs));
    }
    v.pose = 'ready';
    this.time.delayedCall(520, () => {
      if (this.views[id].busyUntil <= this.time.now) this.setFacing(id, this.defaultFacing(id));
    });
  }

  /** A jump of `height` px lasting `ms`: a quick take-off, a slower fall (a parabola eased a little). */
  private jump(id: string, height: number, ms: number): void {
    const v = this.views[id];
    kickBody(v.body, 1.4);
    this.tweens.add({ targets: v, lift: height, duration: ms * 0.42, ease: 'Quad.easeOut', onUpdate: () => this.placeView(id) });
    this.tweens.add({ targets: v, lift: 0, delay: ms * 0.42, duration: ms * 0.58, ease: 'Quad.easeIn', onUpdate: () => this.placeView(id), onComplete: () => kickBody(v.body, -2) });
  }

  /** 1 for a fresh player, down to 0.7 on an empty guts bar (see `fatigueFactor`). */
  private freshness(id: string): number {
    const p = TEAMS.flat().find((q) => q.id === id);
    return p && this.guts[id] !== undefined ? fatigueFactor(this.guts[id], p.maxGuts) : 1;
  }

  /** Walks players to the given court positions, running (two alternating leg poses) while they move. */
  private movePlayers(
    targets: Record<string, CourtPos>,
    duration: number,
    onDone?: () => void,
    endPose: Record<string, PoseName> = {},
    endFacing: Record<string, Facing> = {},
    chasers: string[] = Object.keys(endPose),
  ): void {
    const ids = Object.keys(targets);
    // Tired players run slower: the move takes longer (by up to 30%) when the slowest of them is on the bar's last legs.
    const slowest = Math.min(1, ...ids.map((id) => this.freshness(id)));
    duration = duration / Math.max(0.77, slowest);
    const starts: Record<string, CourtPos> = {};
    for (const id of ids) starts[id] = { ...this.pos[id] };
    const running = new Set(ids.filter((id) => Math.hypot(targets[id].x - starts[id].x, targets[id].z - starts[id].z) > 0.35));
    for (const id of running) {
      if (this.time.now >= this.views[id].busyUntil) {
        // Only a player running for the ball turns to run (sideways in profile); everybody else (a partner covering, a pair
        // going back to its place, a player returning after a shot) shuffles with the face to the court and never turns his back on the ball.
        this.setFacing(id, chasers.includes(id) ? this.runFacing(targets[id].x - starts[id].x, targets[id].z - starts[id].z) : this.defaultFacing(id));
      }
    }
    for (const id of running) if (chasers.includes(id)) kickBody(this.views[id].body, -0.9);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: (t: number) => runEase(t),
      onUpdate: (tween: Phaser.Tweens.Tween) => {
        const t = tween.getValue() ?? 0;
        for (const id of ids) {
          this.pos[id] = { x: lerp(starts[id].x, targets[id].x, t), z: lerp(starts[id].z, targets[id].z, t) };
          const v = this.views[id];
          if (running.has(id) && t < 0.97 && this.time.now >= v.busyUntil) {
            const mx = targets[id].x - starts[id].x;
            const mz = targets[id].z - starts[id].z;
            if (!chasers.includes(id) && Math.abs(mx) >= Math.abs(mz)) this.setShuffleFrame(id, (v.body.stride / SHUFFLE_CYCLE_M) * SHUFFLE_FRAMES, mx > 0 ? 1 : -1);
            else this.setRunFrame(id, (v.body.stride / RUN_CYCLE_M) * RUN_FRAMES);
            v.lift = 0;
          }
          this.placeView(id);
        }
        this.redrawOverlay();
      },
      onComplete: () => {
        for (const id of ids) {
          this.pos[id] = { ...targets[id] };
          const v = this.views[id];
          if (this.time.now >= v.busyUntil) {
            if (running.has(id) || endPose[id] || endFacing[id]) {
              this.setFacing(id, endFacing[id] ?? this.defaultFacing(id));
              this.setPose(id, endPose[id] ?? 'ready');
            }
            v.lift = 0;
          }
          this.placeView(id);
        }
        this.redrawOverlay();
        onDone?.();
      },
    });
  }

  /** Where everybody stands in the rally, given the teams' formations. */
  private rallyTargets(state: PointState): Record<string, CourtPos> {
    const t: Record<string, CourtPos> = {};
    ([0, 1] as SideIndex[]).forEach((side) => {
      TEAMS[side].forEach((p, idx) => {
        t[p.id] = restPos(side, idx, state.formation[side]);
      });
    });
    return t;
  }

  private refreshGuts(): void {
    for (const v of Object.values(this.views)) {
      v.label.setText(v.player.name);
      this.placeView(v.player.id);
    }
  }

  /** "Bruno/Ines" for the opponents, "YOU/Lucy" for your pair (the hero is "YOU"). */
  private teamLabel(side: SideIndex): string {
    const [a, b] = TEAMS[side];
    return side === HUMAN_SIDE ? `YOU/${TEAMS[side][1 - HUMAN_IDX].name}` : `${a.name}/${b.name}`;
  }

  /** Shrinks a text that is wider than `max` so that it keeps its place on the scoreboard. */
  private fitName(t: Phaser.GameObjects.Text, max: number): Phaser.GameObjects.Text {
    if (t.width > max) t.setScale(max / t.width);
    return t;
  }

  private refreshScore(): void {
    const sb = this.sb;
    const practice = this.practice !== null;
    for (const t of [...sb.names, ...sb.games, ...sb.pts]) t.setVisible(!practice);
    sb.title.setVisible(practice);
    sb.boxes.setVisible(!practice);
    sb.dot.clear();
    if (practice && this.practice === 'court') {
      const c = this.court;
      sb.title.setText(
        c.sit === null
          ? 'PRACTICE COURT'
          : c.sit === 'runout'
            ? `PRACTICE · RUN OUT\nGOT IT BACK ${c.inPlay}  TOO FAR ${c.errors}`
            : `PRACTICE · ${situation(c.sit).label}\nWINNERS ${c.winners}  IN PLAY ${c.inPlay}  ERRORS ${c.errors}`,
      );
      sb.note.setText('');
      return;
    }
    if (practice) {
      sb.title.setText(`FREE PRACTICE\n${this.practice === 'attack' ? 'ATTACKING' : 'DEFENDING'}`);
      sb.note.setText('');
      return;
    }
    const s = this.matchScore;
    const [a, b] = pointLabels(s);
    const deuce = deuceLabel(s);
    // Row 0 is the far team (opponents), row 1 your team: the same order as on the court.
    [1, 0].forEach((side, row) => {
      sb.games[row].setText(String(s.games[side]));
      sb.pts[row].setText(side === 0 ? a : b);
    });
    sb.note.setText(deuce);
    // The server wears an orange dot.
    const bx = WIDTH / 2 - 100;
    const dy = this.server === 0 ? 38 : 18;
    sb.dot.fillStyle(0xff6a1a, 1).fillCircle(bx + 12, dy, 4.5);
    sb.dot.lineStyle(1.5, 0xffffff, 1).strokeCircle(bx + 12, dy, 4.5);
  }

  private say(msg: string): void {
    this.lastSaid = msg;
    this.logText.setText(msg);
  }

  // ---------- menu ----------

  private clearMenu(): void {
    for (const o of this.menu) o.destroy();
    this.menu = [];
  }

  private showButtons(title: string, items: ButtonSpec[], layout?: 'directions' | 'columns'): void {
    this.clearMenu();
    // No caption above the buttons (the owner does not want the "who: shot (ball ...)" line); `title` stays for the callers.
    void title;
    // Up to 6 buttons: 2 big columns; more: 3 compact columns.
    const compact = items.length > 6;
    const cols = compact ? 3 : 2;
    // Direction menu: left / middle / right side by side as the ball goes on the screen, BACK alone below.
    const dirs = layout === 'directions';
    const colsLayout = layout === 'columns';
    // Columns by intent: defence | neutral | attack, each shot keeps its order; the specials in a row of their own (a fixed slot each).
    const place = new Map<ButtonSpec, { x: number; y: number; w: number; h: number }>();
    if (colsLayout) {
      const count = { d: 0, n: 0, a: 0 };
      const hasSp = items.some((it) => it.fam === 's');
      for (const it of items) if (it.fam && it.fam !== 's') count[it.fam]++;
      const rows = Math.max(1, Math.max(count.d, count.n, count.a)) + (hasSp ? 1 : 0);
      const gap = Math.min(48, Math.floor(180 / rows));
      const bh = Math.max(24, gap - 4);
      const idx = { d: 0, n: 0, a: 0 };
      for (const it of [...items].sort((p, q) => (p.slot ?? 0) - (q.slot ?? 0))) {
        if (it.fam === 's') place.set(it, { x: 48 + (it.slot ?? 0) * 88, y: 454 + gap / 2, w: 84, h: bh });
        else if (it.fam) {
          const col = it.fam === 'd' ? 0 : it.fam === 'n' ? 1 : 2;
          place.set(it, { x: 63 + col * 120, y: 454 + gap * ((hasSp ? 1 : 0) + idx[it.fam]++ + 0.5), w: 114, h: bh });
        }
      }
    }
    // four rows of compact buttons (10-12: the specials on top of a long list) are a little flatter, to stay on the screen
    const tight = items.length > 9;
    const baseW = dirs ? 108 : compact ? 112 : 160;
    const baseH = dirs ? 56 : tight ? 40 : compact ? 44 : 48;
    const gapY = tight ? 46 : compact ? 52 : 58;
    const y0 = dirs ? 490 : tight ? 470 : compact ? 478 : 485;
    items.forEach((item, i) => {
      const pl = place.get(item);
      const w = pl ? pl.w : baseW;
      const h = pl ? pl.h : baseH;
      const x = pl ? pl.x : dirs ? (i < 3 ? 66 + i * 114 : WIDTH / 2) : compact ? 62 + (i % cols) * 118 : 95 + (i % cols) * 170;
      const y = pl ? pl.y : dirs ? (i < 3 ? y0 : y0 + 66) : y0 + Math.floor(i / cols) * gapY;
      const paint = (hover: boolean, pressed: boolean) => (g: Phaser.GameObjects.Graphics): void =>
        drawCard(g, w, h, { fill: item.fam ? FAM_FILL[item.fam] : TONE_FILL[item.tone], stroke: item.fam && (item.tone === 'normal' || item.tone === 'special') ? FAM_STROKE[item.fam] : TONE_STROKE[item.tone], radius: 12, shadow: hover ? 2 : 3, pressed });
      const baked = bakedShape(this, x - w / 2, y - h / 2, w, h, paint(false, false));
      const gfx = baked.rt.setDepth(9100);
      const redraw = (hover: boolean, pressed = false): void => baked.repaint(paint(hover, pressed));
      const bg = this.add.zone(x, y, w, h).setDepth(9101);
      const text = this.add
        .text(x, y, item.label, {
          fontFamily: DISPLAY, resolution: HD_SCALE,
          fontSize: pl ? (item.fam === 's' ? '10px' : h >= 34 ? '13px' : '11px') : dirs ? '15px' : compact ? '12px' : '14px',
          color: TONE_TEXT[item.tone],
          align: 'center',
        })
        .setOrigin(0.5)
        .setLineSpacing(-3)
        .setDepth(9102);
      if (!item.disabled) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => redraw(true));
        bg.on('pointerout', () => redraw(false));
        bg.on('pointerdown', () => {
          if (this.busy) return;
          redraw(false, true);
          this.busy = true;
          sfx('select');
          this.clearMenu();
          item.onPick();
        });
      }
      this.menu.push(gfx, bg, text);
    });
    this.busy = false;
  }

  /** The gold button of a special shot (red-edged RISKY when the guts are short). */
  private specialButton(sp: ShotDef, hitter: PlayerDef): ButtonSpec {
    const short = this.guts[hitter.id] < sp.cost;
    return {
      label: `${sp.name.toUpperCase()}\nSPECIAL [${sp.cost}]${short ? ' RISKY' : ''}`,
      tone: 'special',
      onPick: () => this.showDirectionMenu(sp),
    };
  }

  /** Colour hint for a shot: red = RISKY (not enough guts), green = good against this ball, orange = poor. */
  private toneFor(shot: ShotDef, hitter: PlayerDef): Tone {
    if (this.guts[hitter.id] < shot.cost) return 'tired';
    const fit = shot.fit[this.point.ball.height];
    if (fit >= 1.05) return 'good';
    if (fit <= 0.85) return 'poor';
    return 'normal';
  }


  // ---------- Free Practice ----------

  private practiceState(holder: SideIndex, hitterIdx: number): PointState {
    return practicePoint(startPoint(this.guts, 0, HUMAN_IDX, 0), this.pr, holder, hitterIdx, HUMAN_SIDE);
  }

  /** Puts everybody back in place, refills the guts and shows the menu of the exercise. */
  /** A lesson a moment after a menu has opened (only if the menu is still there), once. */
  private tipSoon(id: string): void {
    this.time.delayedCall(350, () => {
      if (this.menu.length > 0) showTip(this, id);
    });
  }

  private practiceMenu(): void {
    this.clearMenu();
    this.hideHeight();
    this.setActive(null);
    for (const p of TEAMS.flat()) this.guts[p.id] = p.maxGuts;
    this.refreshGuts();
    this.refreshScore();
    if (this.practice === 'court') {
      this.courtMenu();
      return;
    }
    const attack = this.practice === 'attack';
    const st = this.practiceState(attack ? HUMAN_SIDE : 1, attack ? HUMAN_IDX : 0);
    this.point = st;
    for (const id of Object.keys(this.views)) {
      this.setFacing(id, this.defaultFacing(id));
      this.setPose(id, 'ready');
    }
    this.movePlayers(this.rallyTargets(st), 450, () => {
      const place = (): void => {
        if (this.coastRunning) {
          this.time.delayedCall(80, place);
          return;
        }
        this.stopCoast();
        const holder = TEAMS[st.holder][st.hitterIdx];
        this.ballH = attack ? ARRIVAL_HEIGHT[this.pr.ball] : HIT_HEIGHT_M;
        this.setBall(this.pos[holder.id].x, this.pos[holder.id].z, this.ballH, false);
        this.showPracticeButtons();
      };
      place();
    });
  }

  // ---------- Practice Court ----------

  /** The court's menu: choose a situation, or set the chosen one up again (everybody back in place, guts full) for the next ball. */
  private courtMenu(): void {
    const sitId = this.court.sit;
    if (sitId === null) {
      this.showSituations();
      return;
    }
    const sit = situation(sitId);
    if (sit.kind === 'serve' || sit.kind === 'return') {
      this.courtServe(sit.kind === 'serve');
      return;
    }
    if (sit.kind === 'runout') {
      this.courtRunOut();
      return;
    }
    this.pr = { ...this.pr, ...sit.setup! };
    const st = this.practiceState(HUMAN_SIDE, HUMAN_IDX);
    this.point = st;
    for (const id of Object.keys(this.views)) {
      this.setFacing(id, this.defaultFacing(id));
      this.setPose(id, 'ready');
    }
    this.movePlayers(this.rallyTargets(st), 450, () => {
      const place = (): void => {
        if (this.coastRunning) {
          this.time.delayedCall(80, place);
          return;
        }
        this.stopCoast();
        const hero = TEAMS[HUMAN_SIDE][HUMAN_IDX];
        this.ballH = ARRIVAL_HEIGHT[st.ball.height];
        this.setBall(this.pos[hero.id].x, this.pos[hero.id].z, this.ballH, false);
        this.setActive(hero.id);
        this.showCourtShots();
      };
      place();
    });
  }

  private showSituations(): void {
    this.setActive(null);
    this.say('PRACTICE COURT: pick a situation, then play the shot again and again. Nothing counts here.');
    const items: ButtonSpec[] = SITUATIONS.map((s) => ({
      label: s.label,
      tone: 'normal' as Tone,
      onPick: () => {
        this.court = { sit: s.id, shots: 0, winners: 0, inPlay: 0, errors: 0, perfect: 0 };
        this.practiceMenu();
      },
    }));
    items.push({ label: 'EXIT', tone: 'tired', onPick: () => this.scene.start('TitleScene') });
    this.showButtons('practice court', items);
  }

  /** The shots of the current ball (the rules of a match), and CHANGE / EXIT. A shot is played exactly as in a match. */
  private showCourtShots(): void {
    const st = this.point;
    const sit = situation(this.court.sit ?? 'short_lob');
    const kind = st.hits === 0 ? 'return' : 'rally';
    const items: ButtonSpec[] = playableShots(shotsOfKind(kind), st).map((sh) => ({
      label: sh.timed ? `${sh.name}\n(ring)` : sh.name,
      tone: (sit.signature.includes(sh.id) ? 'good' : 'normal') as Tone,
      onPick: () => (sh.fixedDirection ? this.performHit(sh, sh.fixedDirection) : this.showDirectionMenu(sh)),
    }));
    // on the practice court every special the ball allows is there to try (in a match only your own, from its level)
    if (kind === 'rally') {
      const hero = TEAMS[HUMAN_SIDE][HUMAN_IDX];
      for (const sp of specialsFor({ ...hero, specials: SPECIALS.map((s) => s.id) }, st)) items.unshift(this.specialButton(sp, hero));
    }
    // (the way out is the GO TO MAIN MENU button at the top)
    items.push({ label: 'CHANGE', tone: 'normal', onPick: () => { this.court.sit = null; this.practiceMenu(); } });
    this.say(kind === 'return' ? 'Your return: pick the shot.' : sit.desc);
    this.showHeight(st.ball.height, st.ball.glass ? ', off the glass' : st.ball.lob === 'weak' ? ', weak lob' : '');
    this.showButtons('practice court', items);
  }

  /** Your serve (pick it, then the ring) or theirs at you (they serve on their own; you read it and return it). */
  private courtServe(mine: boolean): void {
    const serverSide: SideIndex = mine ? HUMAN_SIDE : 1;
    const serverIdx = mine ? HUMAN_IDX : 0;
    let points = 0;
    let st = startPoint(this.guts, serverSide, serverIdx, points);
    if (!mine) {
      // the opponents serve to you: the point number that makes you the receiver
      for (points = 0; points < 4; points++) {
        st = startPoint(this.guts, serverSide, serverIdx, points);
        if (st.receiverIdx === HUMAN_IDX) break;
      }
    } else {
      // your serves alternate sides like in a game
      points = this.court.shots % 2;
      st = startPoint(this.guts, serverSide, serverIdx, points);
    }
    this.point = st;
    const setup = serveSetup(serverSide, points, serverIdx);
    const recvSide = other(serverSide);
    const server = TEAMS[serverSide][serverIdx];
    const targets: Record<string, CourtPos> = {
      [server.id]: setup.server,
      [TEAMS[serverSide][1 - serverIdx].id]: setup.partner,
      [TEAMS[recvSide][setup.receiverIdx].id]: setup.receiver,
      [TEAMS[recvSide][1 - setup.receiverIdx].id]: setup.receiverPartner,
    };
    for (const id of Object.keys(this.views)) {
      this.setFacing(id, this.defaultFacing(id));
      this.setPose(id, 'ready');
    }
    this.movePlayers(targets, 450, () => {
      this.stopCoast();
      this.stance[server.id] = 'smash';
      this.setPose(server.id, 'fhPrep');
      this.ballH = HIT_HEIGHT_M;
      this.putServeBall(server.id, serverSide);
      if (!mine) {
        this.say('They serve: watch it, then choose how to take it.');
        this.time.delayedCall(700, () => this.chooseReceive(pickServe(TEAMS, this.point, Math.random)));
        return;
      }
      this.setActive(server.id);
      this.say(situation('serve').desc);
      const items: ButtonSpec[] = shotsOfKind('serve').map((sh) => ({ label: sh.name, tone: 'normal' as Tone, onPick: () => this.chooseReceive(sh) }));
      items.push(
        { label: 'CHANGE', tone: 'normal', onPick: () => { this.court.sit = null; this.practiceMenu(); } },
        { label: 'EXIT', tone: 'tired', onPick: () => this.scene.start('TitleScene') },
      );
      this.showButtons('practice court', items);
    });
  }

  /** RUN OUT: the opponents (at the net) smash a Por Tres past you, out over the side wall; then it is up to you. */
  private courtRunOut(): void {
    this.pr = { ...this.pr, ball: 'high', glass: false, weakLob: false, me: 'back', opp: 'net', bounced: false, hard: false, atWall: false };
    const x3 = shotsOfKind('rally').find((sh) => sh.id === 'smash_x3')!;
    const dirs: Direction[] = ['parallel', 'cross']; // (a ball down the middle never leaves over the side wall)
    for (let i = 0; i < 80; i++) {
      const hitterIdx = Math.random() < 0.5 ? 0 : 1;
      const st = this.practiceState(1, hitterIdx);
      const r = stepHit(TEAMS, st, x3, dirs[Math.floor(Math.random() * dirs.length)], Math.random, undefined, { force: 'winner', ignoreRequires: true });
      if (r.step.defenderIdx !== HUMAN_IDX || !canRunOut(r.step)) continue;
      this.point = st;
      for (const id of Object.keys(this.views)) {
        this.setFacing(id, this.defaultFacing(id));
        this.setPose(id, 'ready');
      }
      this.say(situation('runout').desc);
      this.movePlayers(this.rallyTargets(st), 450, () => {
        this.stopCoast();
        const hitter = TEAMS[1][hitterIdx];
        this.ballH = ARRIVAL_HEIGHT.high;
        this.setBall(this.pos[hitter.id].x, this.pos[hitter.id].z, this.ballH, false);
        this.time.delayedCall(500, () => this.playStep(r.step, r.state));
      });
      return;
    }
    this.court.sit = null;
    this.practiceMenu();
  }

  /** Counts what the hero's shot did on the Practice Court (shown on the scoreboard). */
  private courtCount(step: Step, timing: number | undefined): void {
    if (this.practice !== 'court' || step.side !== HUMAN_SIDE || step.attackerIdx !== HUMAN_IDX) return;
    const c = this.court;
    c.shots++;
    if (timing !== undefined && timing >= 0.95) c.perfect++;
    if (step.outcome === 'winner' || step.outcome === 'ace') c.winners++;
    else if (step.outcome === 'error' || step.outcome === 'fault' || step.outcome === 'double-fault') c.errors++;
    else c.inPlay++;
    this.refreshScore();
  }

  /** Attacking: serves and the shots that can be played with the ball and positions of the SETUP (the rules are the same as in a match). Defending: every shot the opponents can play. */
  private practiceShots(): ShotDef[] {
    const all = [...shotsOfKind('serve'), ...shotsOfKind('return'), ...shotsOfKind('rally')];
    if (this.practice !== 'attack') return all;
    return all.filter((sh) => sh.kind === 'serve' || unavailableReason(sh, this.point) === null);
  }

  private showPracticeButtons(): void {
    const attack = this.practice === 'attack';
    const all = this.practiceShots();
    const per = 6;
    const pages = Math.ceil(all.length / per);
    this.pr.page %= pages;
    const page = this.pr.page;
    const items: ButtonSpec[] = all.slice(page * per, (page + 1) * per).map((sh) => ({
      label: sh.name,
      tone: 'normal' as Tone,
      onPick: () => (attack ? this.practicePick(sh) : this.practiceFeed(sh)),
    }));
    items.push(
      { label: `MORE\n${page + 1}/${pages}`, tone: 'good', onPick: () => { this.pr.page++; this.showPracticeButtons(); } },
      { label: 'SETUP', tone: 'good', onPick: () => this.showPracticeSetup() },
      { label: 'EXIT', tone: 'tired', onPick: () => this.scene.start('TitleScene') },
    );
    if (attack) {
      this.say('FREE PRACTICE, attacking: the shots you can play with this ball (change it in SETUP).');
      this.showHeight(this.pr.ball, this.pr.glass ? ', off the glass' : '');
    } else {
      this.say('FREE PRACTICE, defending: pick the shot the opponents play at you, then return it.');
    }
    this.showButtons('practice', items);
  }

  private showPracticeSetup(): void {
    const next = <T,>(list: T[], cur: T): T => list[(list.indexOf(cur) + 1) % list.length];
    const forms: Formation[] = ['net', 'mid', 'back'];
    const results: Array<'auto' | HitOptions['force']> = ['auto', 'continue', 'winner', 'error', 'rebound'];
    const again = (): void => this.showPracticeSetup();
    const items: ButtonSpec[] = [];
    const yn = (b: boolean): string => (b ? 'YES' : 'NO');
    if (this.practice === 'attack' && this.pr.setupPage === 1) {
      items.push(
        { label: `AFTER BOUNCE\n${yn(this.pr.bounced)}`, tone: 'normal', onPick: () => { this.pr.bounced = !this.pr.bounced; again(); } },
        { label: `HARD BALL\n${yn(this.pr.hard)}`, tone: 'normal', onPick: () => { this.pr.hard = !this.pr.hard; again(); } },
        { label: `BY THE WALL\n${yn(this.pr.atWall)}`, tone: 'normal', onPick: () => { this.pr.atWall = !this.pr.atWall; again(); } },
        { label: 'BACK', tone: 'good', onPick: () => { this.pr.setupPage = 0; again(); } },
        { label: 'DONE', tone: 'good', onPick: () => this.practiceMenu() },
      );
      this.say('SETUP 2/2: the ball has bounced (flat shot, contrapared), is hard (block), comes down by the side wall (contrapared).');
      this.showButtons('setup', items);
      return;
    }
    if (this.practice === 'attack') {
      items.push(
        { label: `BALL\n${this.pr.ball.toUpperCase()}`, tone: 'normal', onPick: () => { this.pr.ball = next<Height>(['low', 'mid', 'high'], this.pr.ball); again(); } },
        { label: `OFF GLASS\n${this.pr.glass ? 'YES' : 'NO'}`, tone: 'normal', onPick: () => { this.pr.glass = !this.pr.glass; again(); } },
        { label: `WEAK LOB\n${this.pr.weakLob ? 'YES' : 'NO'}`, tone: 'normal', onPick: () => { this.pr.weakLob = !this.pr.weakLob; again(); } },
        { label: `RESULT\n${String(this.pr.result).toUpperCase()}`, tone: 'normal', onPick: () => { this.pr.result = next(results, this.pr.result); again(); } },
      );
    }
    items.push(
      { label: `YOU\n${this.pr.me.toUpperCase()}`, tone: 'normal', onPick: () => { this.pr.me = next(forms, this.pr.me); again(); } },
      { label: `OPPONENTS\n${this.pr.opp.toUpperCase()}`, tone: 'normal', onPick: () => { this.pr.opp = next(forms, this.pr.opp); again(); } },
    );
    if (this.practice === 'attack') items.push({ label: 'MORE', tone: 'good', onPick: () => { this.pr.setupPage = 1; again(); } });
    items.push({ label: 'DONE', tone: 'good', onPick: () => this.practiceMenu() });
    this.say('SETUP: ball, position of you and the opponents, and how your shot ends (RESULT: winner, error, REBOUND = back over the net...).');
    this.showButtons('setup', items);
  }

  private practicePick(shot: ShotDef): void {
    if (shot.kind === 'serve') {
      this.practiceServe(shot, HUMAN_SIDE);
      return;
    }
    const options: HitOptions = { force: this.pr.result === 'auto' ? undefined : this.pr.result };
    if (shot.fixedDirection) {
      this.performHit(shot, shot.fixedDirection, undefined, options);
      return;
    }
    const order: Direction[] = HUMAN_IDX === 0 ? DIRECTION_ORDER : ['cross', 'middle', 'parallel'];
    const items: ButtonSpec[] = order.map((d) => ({
      label: DIRECTIONS[d].name.toUpperCase(),
      tone: 'normal' as Tone,
      onPick: () => this.performHit(shot, d, undefined, options),
    }));
    items.push({ label: 'BACK', tone: 'normal', onPick: () => this.showPracticeButtons() });
    this.showButtons(`${shot.name}: which way?`, items, 'directions');
  }

  /** The opponents play `shot` at you (the human). */
  private practiceFeed(shot: ShotDef): void {
    if (shot.kind === 'serve') {
      this.practiceServe(shot, 1);
      return;
    }
    const dirs: Direction[] = ['parallel', 'middle', 'cross'];
    for (let i = 0; i < 80; i++) {
      const hitterIdx = Math.random() < 0.5 ? 0 : 1;
      const st = this.practiceState(1, hitterIdx);
      const dir = shot.fixedDirection ?? dirs[Math.floor(Math.random() * dirs.length)];
      const r = stepHit(TEAMS, st, shot, dir, Math.random, undefined, { force: 'continue', ignoreRequires: true });
      if (r.step.defenderIdx === HUMAN_IDX && r.state.holder === HUMAN_SIDE) {
        this.point = st;
        const hitter = TEAMS[1][hitterIdx];
        this.ballH = HIT_HEIGHT_M;
        this.setBall(this.pos[hitter.id].x, this.pos[hitter.id].z, this.ballH, false);
        this.playStep(r.step, r.state);
        return;
      }
    }
    this.practiceMenu();
  }

  /** A serve of the practice: by you (attacking) or at you (defending). The players walk to the serving positions first. */
  private practiceServe(shot: ShotDef, serverSide: SideIndex): void {
    const serverIdx = serverSide === HUMAN_SIDE ? HUMAN_IDX : 0;
    let points = 0;
    let st = startPoint(this.guts, serverSide, serverIdx, points);
    if (serverSide !== HUMAN_SIDE) {
      // You are the receiver: pick the serving side (point number) that makes you receive.
      for (points = 0; points < 4; points++) {
        st = startPoint(this.guts, serverSide, serverIdx, points);
        if (st.receiverIdx === HUMAN_IDX) break;
      }
    }
    this.point = st;
    const setup = serveSetup(serverSide, points, serverIdx);
    const recvSide = other(serverSide);
    const server = TEAMS[serverSide][serverIdx];
    const targets: Record<string, CourtPos> = {
      [server.id]: setup.server,
      [TEAMS[serverSide][1 - serverIdx].id]: setup.partner,
      [TEAMS[recvSide][setup.receiverIdx].id]: setup.receiver,
      [TEAMS[recvSide][1 - setup.receiverIdx].id]: setup.receiverPartner,
    };
    this.movePlayers(targets, 450, () => {
      this.stance[server.id] = 'smash';
      this.setPose(server.id, 'fhPrep');
      this.ballH = HIT_HEIGHT_M;
      this.putServeBall(server.id, serverSide);
      this.chooseReceive(shot);
    });
  }

  // ---------- flow: serve -> return -> rally ----------

  private beginPoint(): void {
    // Star Point: the receiving pair chooses who receives, which also decides the side the serve comes from.
    if (!isStarPoint(this.matchScore)) {
      this.startServe();
      return;
    }
    const recvSide = other(this.server);
    if (recvSide !== HUMAN_SIDE) {
      const choice = pickStarReceiver(TEAMS[recvSide], Math.random);
      this.say(`STAR POINT: ${TEAMS[recvSide][choice].name} will receive.`);
      this.startServe(choice);
      return;
    }
    this.setActive(null);
    this.say('STAR POINT! Who receives?');
    this.showButtons(
      'Star Point: who receives?',
      TEAMS[recvSide].map((pl, i) => ({
        label: `${pl.name}\n[${laneSign(i) < 0 ? 'left' : 'right'} side]`,
        tone: 'normal' as Tone,
        onPick: () => {
          this.clearMenu();
          this.startServe(i);
        },
      })),
    );
  }

  /** Sets up one point: players walk to their serving positions, then the server's turn starts. */
  private startServe(receiverChoice?: number): void {
    const pointsPlayed = this.matchScore.points[0] + this.matchScore.points[1];
    const idx = this.serverIdx[this.server];
    this.point = startPoint(this.guts, this.server, idx, pointsPlayed, receiverChoice);

    // Serve set-up: the server stands in their serving lane, the partner in the middle of their half.
    const setup = serveSetup(this.server, pointsPlayed, idx, receiverChoice);
    const recvSide = other(this.server);
    const targets: Record<string, CourtPos> = {
      [TEAMS[this.server][idx].id]: setup.server,
      [TEAMS[this.server][1 - idx].id]: setup.partner,
      [TEAMS[recvSide][setup.receiverIdx].id]: setup.receiver,
      [TEAMS[recvSide][1 - setup.receiverIdx].id]: setup.receiverPartner,
    };
    this.serveSpots = targets;
    for (const id of Object.keys(this.views)) {
      this.setFacing(id, this.defaultFacing(id));
      this.setPose(id, 'ready');
    }
    this.setActive(null);
    this.movePlayers(targets, 450, () => {
      // The ball of the last point is never stopped: it is put down for the serve only when it has finished rolling.
      const place = (): void => {
        if (this.coastRunning) {
          this.time.delayedCall(80, place);
          return;
        }
        this.stopCoast();
        this.serveTurn();
      };
      place();
    });
  }

  /**
   * After a fault everybody goes back to the serving spots (the server behind the baseline, not where he ran to for the net while
   * the first serve was in the air), then the second serve starts.
   */
  private backToServeSpots(): void {
    for (const id of Object.keys(this.views)) {
      this.setFacing(id, this.defaultFacing(id));
      this.setPose(id, 'ready');
    }
    this.setActive(null);
    this.movePlayers(this.serveSpots, 450, () => {
      // The ball of the fault rolls while they walk back; it is taken into the server's hand for the second serve.
      this.stopCoast();
      this.serveTurn();
    });
  }

  private isHuman(side: SideIndex, idx: number): boolean {
    return side === HUMAN_SIDE && idx === HUMAN_IDX;
  }

  private serveTurn(): void {
    const st = this.point;
    const server = TEAMS[st.servingSide][st.serverIdx];
    const tag = st.attempt === 2 ? ' (2nd serve)' : '';

    this.stance[server.id] = 'smash';
    this.setPose(server.id, 'fhPrep'); // racket back, the ball in the free hand in front of the body (a padel serve is hit low, after a bounce)
    // The ball is back in the server's hand (after a fault it lay at the net).
    this.ballH = HIT_HEIGHT_M;
    this.putServeBall(server.id, st.servingSide);

    if (this.isHuman(st.servingSide, st.serverIdx)) {
      this.setActive(server.id);
      this.showButtons(
        `${server.name}: serve${tag}`,
        shotsOfKind('serve').map((s) => ({
          label: `${s.name}\n[${s.cost}]${this.guts[server.id] < s.cost ? ' RISKY' : ''}`,
          tone: this.toneFor(s, server),
          onPick: () => this.chooseReceive(s),
        })),
      );
    } else {
      this.setActive(null);
      const shot = pickServe(TEAMS, st, Math.random);
      this.time.delayedCall(CPU_DELAY, () => this.chooseReceive(shot));
    }
  }

  /**
   * A serve to the side glass can be taken straight after the bounce or after the glass: the receiver decides.
   * Your own receiver gets a menu, everybody else decides automatically.
   */
  private chooseReceive(shot: ShotDef): void {
    const st = this.point;
    if (shot.wall === 'none') {
      this.performServe(shot, 'bounce');
      return;
    }
    const recvSide = other(st.servingSide);
    const receiver = TEAMS[recvSide][st.receiverIdx];
    if (!this.isHuman(recvSide, st.receiverIdx)) {
      this.performServe(shot, pickReceive(TEAMS, st, Math.random, shot));
      return;
    }
    this.setActive(receiver.id);
    this.previewServe(shot);
  }

  /**
   * The human receiver decides while the serve is in the air: the ball flies until just before its bounce, then crawls in slow
   * motion for a moment, with the speed of the serve and the spot where it will hit the glass on the screen and a bar that runs
   * out. After the choice the same flight carries on from where it was. The time depends on the receiver's guts (G): the fewer he
   * has, the less time. When the bar runs out the receiver never touches the ball and the server gets an ace.
   */
  private previewServe(shot: ShotDef, dropped = false): void {
    const st = this.point;
    const server = TEAMS[st.servingSide][st.serverIdx];
    const receiver = TEAMS[other(st.servingSide)][st.receiverIdx];
    // the server drops the ball and strikes it after the bounce, then the receiver reads it
    if (!dropped) {
      this.serveDrop(() => this.previewServe(shot, true));
      return;
    }
    const seed = Math.floor(Math.random() * 1e9);
    const probe = stepServe(TEAMS, st, shot, seededRng(seed), 'bounce');
    const startH = this.ballH;
    const { flight } = this.buildStepFlight(probe.step, seed, startH);
    const bounce = flight.events.find((e) => e.kind === 'bounce');
    // A fault is a fault whatever the receiver does: no decision, the serve just plays.
    if (probe.step.outcome === 'fault') {
      this.performServe(shot, 'bounce', { seed, dropped: true });
      return;
    }
    if (!bounce || flight.duration <= 0) {
      this.showButtons(`${receiver.name}: take it...`, [
        { label: 'AFTER BOUNCE\nfast, clean', tone: 'normal', onPick: () => this.performServe(shot, 'bounce', { dropped: true }) },
        { label: 'WAIT FOR THE GLASS\nmore time', tone: 'normal', onPick: () => this.performServe(shot, 'wall', { dropped: true }) },
      ]);
      return;
    }
    const total = flightDuration(flight);
    const pb = bounce.t / flight.duration;
    const p0 = pb * 0.78;
    const p1 = pb * 0.93;
    const kmh = Math.round(shot.flight.speed * (probe.step.second ? SECOND_SERVE_SPEED : 1) * powerSpeedMul(server.stats.power) * 3.6);

    this.say(`${server.name}: ${shot.name}!`);
    impactSound(racketKind(shot.id, true, shot.flight.speed), Math.max(0.15, Math.min(1, shot.flight.speed / 30)));
    this.swing(server.id, null, 0);
    const glassHit = flight.events.find((e) => e.kind === 'glass');
    const decisionMs = receiveDecisionMs(this.guts[receiver.id] ?? receiver.maxGuts, receiver.maxGuts);

    let progress = 0;
    this.tweens.addCounter({
      from: 0,
      to: p0,
      duration: total * p0,
      onUpdate: (tween: Phaser.Tweens.Tween) => {
        progress = tween.getValue() ?? 0;
        const p = ballPoint(flight.path, progress);
        this.setBall(p.x, p.z, p.h);
      },
      onComplete: () => {
        // The decision: the ball hangs in the air, almost still.
        let decided = false;
        let crawl: Phaser.Tweens.Tween | null = null;
        const choose = (receive: ReceiveMode | 'late'): void => {
          if (decided) return;
          decided = true;
          crawl?.stop();
          this.tweens.killTweensOf(this.menu);
          this.clearMenu();
          if (receive === 'late') {
            // Too slow: the receiver never touches the ball. The ace flight is the same up to the bounce but lasts longer, so the
            // point where the ball hangs is converted to a share of the new flight.
            this.hideHeight();
            const ace = stepServe(TEAMS, this.point, shot, seededRng(seed), 'bounce', true);
            const aceFlight = this.buildStepFlight(ace.step, seed, startH).flight;
            const from = aceFlight.duration > 0 ? (progress * flight.duration) / aceFlight.duration : progress;
            this.playStep(ace.step, ace.state, { seed, from, startH });
            return;
          }
          this.performServe(shot, receive, { seed, from: progress, startH });
        };
        this.showButtons(`${receiver.name}: take it...`, [
          { label: 'AFTER BOUNCE\nfast, clean', tone: 'normal', onPick: () => choose('bounce') },
          { label: 'WAIT FOR THE GLASS\nmore time', tone: 'normal', onPick: () => choose('wall') },
        ]);
        const title = this.add
          .text(WIDTH / 2, 190, `${kmh} km/h`, { fontFamily: DISPLAY, resolution: HD_SCALE, fontSize: '36px', color: kmh >= 95 ? '#ffb36a' : '#ffe066' })
          .setOrigin(0.5)
          .setStroke(NAVY_CSS, 8)
          .setDepth(9995);
        const barBg = this.add.rectangle(WIDTH / 2, 252, 184, 10, 0x0b2a5b, 0.9).setStrokeStyle(2, 0xffffff).setDepth(9995);
        const bar = this.add.rectangle(WIDTH / 2 - 90, 252, 180, 6, 0xffb800).setOrigin(0, 0.5).setDepth(9996);
        // Two quick-read chips: how fast and how much spin (green = easy, yellow = medium, red = hard).
        const spinAmount = Math.hypot(shot.flight.spin, shot.flight.side ?? 0) * spinMul(server.stats.spin);
        const speedLvl = kmh >= 95 ? 2 : kmh >= 78 ? 1 : 0;
        const spinLvl = spinAmount >= 1.2 ? 2 : spinAmount >= 0.6 ? 1 : 0;
        const chipColors = ['#0e8f5c', '#b47a00', '#c62828'];
        const chip = (x: number, text: string, lvl: number): Phaser.GameObjects.Container => {
          const label = this.add.text(0, 0, text, { fontFamily: DISPLAY, resolution: HD_SCALE, fontSize: '13px', color: chipColors[lvl] }).setOrigin(0.5);
          const pill = this.add.graphics();
          pill.fillStyle(0xffffff, 1).fillRoundedRect(-label.width / 2 - 10, -12, label.width + 20, 24, 12);
          pill.lineStyle(2.5, 0x0b2a5b, 1).strokeRoundedRect(-label.width / 2 - 10, -12, label.width + 20, 24, 12);
          return this.add.container(x, 224, [pill, label]).setDepth(9995);
        };
        const speedChip = chip(WIDTH / 2 - 62, `SPEED: ${['SLOW', 'MEDIUM', 'FAST'][speedLvl]}`, speedLvl);
        const spinChip = chip(WIDTH / 2 + 62, `SPIN: ${['LOW', 'MEDIUM', 'HIGH'][spinLvl]}`, spinLvl);
        this.menu.push(title, speedChip, spinChip, barBg, bar);
        // Where the ball will land and where it will hit the glass.
        const marks: Array<{ x: number; z: number; h: number; color: number }> = [{ x: bounce.x, z: bounce.z, h: 0, color: 0xffe066 }];
        if (glassHit) marks.push({ x: glassHit.x, z: glassHit.z, h: glassHit.h, color: 0x9fd8ff });
        for (const m of marks) {
          const pr = project(m.x, m.z, m.h);
          const ring = this.add.ellipse(pr.x, pr.y, 22, m.h > 0 ? 22 : 10, 0xffffff, 0).setStrokeStyle(2, m.color, 1).setDepth(9990);
          this.tweens.add({ targets: ring, scale: 1.6, alpha: 0.2, duration: 520, yoyo: true, repeat: -1 });
          this.menu.push(ring);
        }
        this.tweens.add({ targets: bar, scaleX: 0, duration: decisionMs, ease: 'Linear' });
        crawl = this.tweens.addCounter({
          from: p0,
          to: p1,
          duration: decisionMs,
          ease: 'Linear',
          onUpdate: (tween: Phaser.Tweens.Tween) => {
            progress = tween.getValue() ?? p0;
            const p = ballPoint(flight.path, progress);
            this.setBall(p.x, p.z, p.h);
          },
          onComplete: () => choose('late'),
        });
      },
    });
  }

  private hitTurn(): void {
    const st = this.point;
    const side = st.holder;
    const hitter = TEAMS[side][st.hitterIdx];

    if (this.isHuman(side, st.hitterIdx)) {
      this.setActive(hitter.id);
      this.showShotMenu();
    } else {
      this.setActive(null);
      // The hitter looks for holes: he sees where the opponents stand right now.
      const opp = TEAMS[other(side)].map((p) => ({ ...this.pos[p.id] }));
      const { shot, direction, prefer } = pickHit(TEAMS, st, Math.random, opp);
      this.time.delayedCall(CPU_DELAY, () => this.performHit(shot, direction, prefer));
    }
  }

  /** The height of the ball to play, big and in colour: high = green, mid = blue, low = yellow. */
  private showHeight(height: Height, context: string): void {
    const color: Record<Height, string> = { high: '#4dff88', mid: '#5db4ff', low: '#ffe14d' };
    this.heightText.setText(`${height.toUpperCase()} BALL`).setColor(color[height]).setVisible(true).setScale(1.3);
    this.tweens.add({ targets: this.heightText, scale: 1, duration: 200, ease: 'Back.easeOut' });
    this.heightSub.setText(context.replace(/^, /, '')).setVisible(context !== '');
  }

  private hideHeight(): void {
    this.heightText.setVisible(false);
    this.heightSub.setVisible(false);
  }

  private showShotMenu(): void {
    if (this.practice === 'court') {
      this.showCourtShots();
      return;
    }
    const st = this.point;
    const hitter = TEAMS[0][st.hitterIdx];
    const kind = st.hits === 0 ? 'return' : 'rally';
    const context = st.ball.glass ? ', off the glass' : st.ball.lob === 'weak' ? ', weak lob' : st.ball.lob === 'medium' ? ', medium lob' : st.ball.lob === 'deep' ? ', deep lob' : '';
    const title = `${hitter.name}: ${kind === 'return' ? 'return' : 'your shot'} (ball ${st.ball.height.toUpperCase()}${context})`;
    const label = (sh: ShotDef): string => {
      const tired = this.guts[hitter.id] < sh.cost ? ' RISKY' : '';
      return sh.menuLabel ? `${sh.menuLabel} [${sh.cost}]${tired}` : `${sh.name}\n[${sh.cost}]${tired}`;
    };
    // Only the shots that can be played now are offered.
    const columns = getSave().settings.shotMenu === 'columns';
    const items: ButtonSpec[] = playableShots(shotsOfKind(kind), st).map((sh) => {
      const f = FAMILY_OF[sh.id];
      const tired = this.guts[hitter.id] < sh.cost;
      return {
        label: columns && f ? `${f[2]} [${sh.cost}]${tired ? '!' : ''}` : label(sh),
        tone: this.toneFor(sh, hitter),
        fam: columns && f ? f[0] : undefined,
        slot: f?.[1],
        onPick: () => (sh.fixedDirection ? this.performHit(sh, sh.fixedDirection) : this.showDirectionMenu(sh)),
      };
    });
    // his special shot, in gold, when the ball allows it
    for (const sp of specialsFor(hitter, st)) {
      const b = this.specialButton(sp, hitter);
      const f = FAMILY_OF[sp.id];
      if (columns && f) {
        const short = this.guts[hitter.id] < sp.cost;
        items.unshift({ ...b, label: `${f[2].toUpperCase()}\n[${sp.cost}]${short ? ' RISKY' : ''}`, fam: 's', slot: f[1] });
      } else items.unshift(b);
    }
    this.showHeight(st.ball.height, context);
    this.showButtons(title, items, columns && items.every((it) => it.fam) ? 'columns' : undefined);
    this.tipSoon('shots');
    if (specialsFor(hitter, st).length > 0) this.tipSoon('special');
  }

  private showDirectionMenu(shot: ShotDef): void {
    const st = this.point;
    const hitter = TEAMS[0][st.hitterIdx];
    const parallelTarget = TEAMS[1][st.hitterIdx].name;
    const crossTarget = TEAMS[1][1 - st.hitterIdx].name;
    const targetName: Record<Direction, string> = { parallel: parallelTarget, cross: crossTarget, middle: 'both' };

    // Buttons in the order the ball goes on the screen: from the left-hand player parallel is on the left and cross on the right,
    // from the right-hand player the other way round.
    const order: Direction[] = st.hitterIdx === 0 ? ['parallel', 'middle', 'cross'] : ['cross', 'middle', 'parallel'];
    // Where each way takes the ball and how far that is from the opponents (their reach): green = a gap, orange = right at them.
    const aim = shot.overFence === true || shot.wall === 'fence' ? undefined : this.reachMap(shot, st.hitterIdx);
    // A corner shot (Corner Lock) has only two targets: the left or the right back corner (in either aiming mode).
    if (shot.edgeX !== undefined && aim !== undefined) {
      const left: Direction = st.hitterIdx === 0 ? 'parallel' : 'cross';
      const right: Direction = left === 'parallel' ? 'cross' : 'parallel';
      const tone = (d: Direction): Tone => (aim[d].factor < 0.75 ? 'good' : aim[d].factor >= 0.97 ? 'poor' : 'normal');
      this.showButtons(
        `${hitter.name}: ${shot.name}, which corner?`,
        [
          { label: `LEFT CORNER\n-> ${targetName[left]}`, tone: tone(left), onPick: () => this.performHit(shot, left) },
          { label: `RIGHT CORNER\n-> ${targetName[right]}`, tone: tone(right), onPick: () => this.performHit(shot, right) },
          { label: 'BACK', tone: 'normal', onPick: () => this.showShotMenu() },
        ],
        'directions',
      );
      this.drawReach(shot, aim, true, [left, right]);
      return;
    }
    // Settings > AIM: TAP THE SPOT: the player chooses the landing point on the heat map instead of a direction (shots with a fixed target excepted).
    if (aim !== undefined && getSave().settings.aim === 'point') {
      this.showTargetMenu(shot, aim);
      return;
    }
    const items: ButtonSpec[] = order.map((d) => ({
      label: `${DIRECTIONS[d].name.toUpperCase()}\n-> ${targetName[d]}`,
      tone: (aim === undefined ? 'normal' : aim[d].factor < 0.75 ? 'good' : aim[d].factor >= 0.97 ? 'poor' : 'normal') as Tone,
      onPick: () => this.performHit(shot, d),
    }));
    items.push({ label: 'BACK', tone: 'normal', onPick: () => this.showShotMenu() });
    this.showButtons(`${hitter.name}: ${shot.name}, which way?`, items, 'directions');
    if (aim !== undefined) this.drawReach(shot, aim);
  }

  /**
   * Aiming at a spot: the heat map of the opponents' reach is shown and the player touches (and may drag) the point where the ball
   * should land; letting go hits. A ring shows the spot, an ellipse how far the ball may stray from it (accuracy, tiredness).
   * The direction (attack, risk, who plays the ball) is the one of the three whose usual landing point is nearest.
   */
  private showTargetMenu(shot: ShotDef, aim: Record<Direction, { x: number; z: number; factor: number }>): void {
    const st = this.point;
    const hitter = TEAMS[0][st.hitterIdx];
    this.showButtons(`${hitter.name}: ${shot.name}\nTOUCH WHERE THE BALL SHOULD LAND`, [{ label: 'BACK', tone: 'normal', onPick: () => this.showShotMenu() }], 'directions');
    this.drawReach(shot, aim, false);
    const hint = this.add
      .text(WIDTH * 0.68, 490, 'TOUCH THE COURT\nWHERE THE BALL\nSHOULD LAND', { fontFamily: DISPLAY, resolution: HD_SCALE, fontSize: '13px', color: '#ffe066', align: 'center' })
      .setOrigin(0.5)
      .setDepth(9996);
    this.menu.push(hint);
    const far = project(0, 0.2).y;
    const net = project(0, NET_Z - 0.6).y;
    const marker = this.add.graphics().setDepth(9993);
    this.menu.push(marker);
    // the real spread of this hit (accuracy, tiredness, the ball's pressure, the shot): the ellipse shows where the ball may fall
    const spread = targetSpreadFor(hitter, { ...st, guts: this.guts }, shot);
    const defenders: [PlayerDef, PlayerDef] = [TEAMS[1][0], TEAMS[1][1]];
    const target = (px: number, py: number): { x: number; depth: number } => {
      const c = unproject(px, Math.max(far, Math.min(net, py)));
      return { x: Math.max(-4.6, Math.min(4.6, c.x)), depth: Math.max(1, Math.min(9.4, NET_Z - c.z)) };
    };
    const show = (t: { x: number; depth: number }): void => {
      const z = NET_Z - t.depth;
      const p = project(t.x, z);
      const f = reachAgainst(defenders, 1, st.formation[1], shot, t.x, t.depth, this.reachPositions());
      const color = f < 0.75 ? 0x4ade80 : f >= 0.97 ? 0xff9f1c : 0xffe066;
      const a = project(t.x - spread.x, z);
      const b = project(t.x + spread.x, z);
      const n = project(t.x, z + spread.depth);
      const fz = project(t.x, z - spread.depth);
      const miss = targetMissChance(t, spread);
      marker.clear();
      // the part of the spread off the court is a risk of an error: the ellipse turns red with it
      const fill = miss >= 0.15 ? 0xff4d4d : miss >= 0.05 ? 0xff9f1c : color;
      marker.fillStyle(fill, 0.22).fillEllipse(p.x, (n.y + fz.y) / 2, b.x - a.x, n.y - fz.y);
      marker.lineStyle(2, fill, 0.95).strokeEllipse(p.x, (n.y + fz.y) / 2, b.x - a.x, n.y - fz.y);
      marker.lineStyle(3, 0xffffff, 1).strokeCircle(p.x, p.y, Math.max(5, p.scale * 0.22));
      marker.fillStyle(0xffffff, 1).fillCircle(p.x, p.y, 2.5);
    };
    let current: { x: number; depth: number } | null = null;
    const zone = this.add.zone(0, far - 24, WIDTH, net - far + 40).setOrigin(0, 0).setDepth(9992).setInteractive();
    this.menu.push(zone);
    zone.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      current = target(ptr.worldX, ptr.worldY);
      show(current);
    });
    zone.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!ptr.isDown || !current) return;
      // world coordinates: the game canvas is drawn at a higher resolution and the camera zooms it (ptr.x would be twice too big)
      current = target(ptr.worldX, ptr.worldY);
      show(current);
    });
    zone.on('pointerup', () => {
      if (!current) return;
      const t = current;
      current = null;
      // one hit per menu: the zone goes at once (a second tap must not play the ball again)
      zone.disableInteractive();
      marker.clear();
      this.clearMenu();
      let best: Direction = 'middle';
      let bestD = Infinity;
      for (const d of DIRECTION_ORDER) {
        const dx = Math.abs(landingX(d, d === 'cross' ? 1 - st.hitterIdx : st.hitterIdx) - t.x);
        if (dx < bestD) {
          bestD = dx;
          best = d;
        }
      }
      this.performHit(shot, best, undefined, { target: t });
    });
  }

  /** Where the defenders and the hitter really stand now: the reach is measured from there (copies, the players move on). */
  private reachPositions(): ReachPositions {
    const st = this.point;
    const def = other(st.holder);
    const at = (id: string): CourtPos => ({ x: this.pos[id].x, z: this.pos[id].z });
    return { defenders: [at(TEAMS[def][0].id), at(TEAMS[def][1].id)], hitter: at(TEAMS[st.holder][st.hitterIdx].id) };
  }

  /** The landing point of each direction and how much of their defence the opponents keep against it (1 = the ball is within reach). */
  private reachMap(shot: ShotDef, hitterIdx: number): Record<Direction, { x: number; z: number; factor: number }> {
    const defenders: [PlayerDef, PlayerDef] = [TEAMS[1][0], TEAMS[1][1]];
    const formation = this.point.formation[1];
    const out = {} as Record<Direction, { x: number; z: number; factor: number }>;
    for (const d of DIRECTION_ORDER) {
      const lane = d === 'cross' ? 1 - hitterIdx : hitterIdx;
      // a corner shot (Corner Lock) lands in the back corner on that player's side
      const x = shot.edgeX !== undefined ? laneSign(lane) * shot.edgeX : landingX(d, lane);
      out[d] = { x, z: landingZ(1, shot.landDepth), factor: reachAgainst(defenders, 1, formation, shot, x, shot.landDepth, this.reachPositions()) };
    }
    return out;
  }

  /**
   * Draws a heat map of the opponents' half while the direction menu is open: every spot is coloured by how much of their defence
   * the opponents keep against a ball that comes down there (green = a gap, yellow = stretched, red = right at them), with a marker
   * where each direction lands. It is painted once into a texture and removed with the menu.
   */
  private drawReach(shot: ShotDef, aim: Record<Direction, { x: number; z: number; factor: number }>, markers = true, only: readonly Direction[] = DIRECTION_ORDER): void {
    const defenders: [PlayerDef, PlayerDef] = [TEAMS[1][0], TEAMS[1][1]];
    const formation = this.point.formation[1];
    const lerp = (a: number, b: number, t: number): number => Math.round(a + (b - a) * t);
    const ramp = (f: number): number => {
      // 0.6 (a gap) green, 0.82 yellow, 1 (within reach) red
      const t = Math.max(0, Math.min(1, (f - 0.6) / 0.4));
      const [c0, c1, u] = t < 0.5 ? [[0x3d, 0xd6, 0x7a], [0xff, 0xe0, 0x66], t * 2] : [[0xff, 0xe0, 0x66], [0xff, 0x4d, 0x4d], (t - 0.5) * 2];
      return (lerp(c0[0], c1[0], u) << 16) | (lerp(c0[1], c1[1], u) << 8) | lerp(c0[2], c1[2], u);
    };
    const at = this.reachPositions();
    const step = 0.34;
    const heat = bakedShape(this, 0, 0, WIDTH, 392, (g) => {
      for (let x = -5; x < 5 - 1e-6; x += step) {
        for (let d = 0.2; d < 9.8; d += step) {
          const f = reachAgainst(defenders, 1, formation, shot, x + step / 2, d + step / 2, at);
          const z0 = landingZ(1, d);
          const z1 = landingZ(1, d + step);
          const q = [project(x, z0), project(x + step, z0), project(x + step, z1), project(x, z1)];
          g.fillStyle(ramp(f), 1);
          g.fillPoints(q.map((p) => new Phaser.Math.Vector2(p.x, p.y)).concat(), true);
        }
      }
    }, 0);
    heat.rt.setDepth(2).setAlpha(0.42);
    this.menu.push(heat.rt);
    if (!markers) return;
    const g = this.add.graphics().setDepth(3);
    for (const d of only) {
      const a = aim[d];
      const p = project(a.x, a.z);
      const color = a.factor < 0.75 ? 0x4ade80 : a.factor >= 0.97 ? 0xff9f1c : 0xffe066;
      g.fillStyle(color, 0.95).fillEllipse(p.x, p.y, p.scale * 0.9, p.scale * 0.36);
      g.lineStyle(2, 0xffffff, 0.95).strokeEllipse(p.x, p.y, p.scale * 0.9, p.scale * 0.36);
    }
    this.menu.push(g);
  }

  private performServe(shot: ShotDef, receive: ReceiveMode, opts?: { seed?: number; from?: number; startH?: number; timing?: number; dropped?: boolean }): void {
    this.hideHeight();
    const st = this.point;
    // your own serve with the timing ring: the ball is dropped, bounces, and you touch as the ring closes on it
    if (opts?.timing === undefined && shot.timed === true && this.isHuman(st.servingSide, st.serverIdx) && getSave().settings.timing !== 'auto') {
      this.timingRing('serve', TEAMS[st.servingSide][st.serverIdx], (q) => this.performServe(shot, receive, { ...opts, timing: q }));
      return;
    }
    // every other serve (the opponents', your partner's, yours without the ring) is also dropped and struck after the bounce
    if (opts?.timing === undefined && opts?.from === undefined && opts?.dropped !== true) {
      this.serveDrop(() => this.performServe(shot, receive, { ...opts, dropped: true }));
      return;
    }
    const { state, step } = stepServe(TEAMS, st, shot, opts?.seed !== undefined ? seededRng(opts.seed) : Math.random, receive, false, opts?.timing);
    this.courtCount(step, opts?.timing);
    this.playStep(step, state, opts);
  }

  /** The serve without the ring: the ball is dropped, bounces and is struck between the knee and the hip, then `done` plays the shot. */
  private serveDrop(done: () => void): void {
    const at = { ...this.ballFloor };
    const t0 = this.time.now;
    this.ball.setVisible(true);
    let bounced = false;
    const tick = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        const ms = this.time.now - t0;
        const h = serveBallH(Math.min(ms, SERVE_DUE_MS));
        this.setBall(at.x, at.z, h, false);
        if (!bounced && ms >= DROP_MS) {
          bounced = true;
          sfx('select', 0.35);
        }
        if (ms >= SERVE_DUE_MS) {
          tick.remove();
          this.ballH = Math.max(0.3, h);
          done();
        }
      },
    });
  }

  private performHit(shot: ShotDef, direction: Direction, prefer?: AimPreference, options?: HitOptions, cutDone = false): void {
    this.hideHeight();
    const st = this.point;
    // your own smash, vibora or bandeja with the timing ring: the ball comes down and you touch as the ring closes on it
    if (options?.timing === undefined && shot.timed === true && this.isHuman(st.holder, st.hitterIdx) && getSave().settings.timing !== 'auto') {
      this.timingRing('high', TEAMS[st.holder][st.hitterIdx], (q) => this.performHit(shot, direction, prefer, { ...options, timing: q }));
      return;
    }
    // a special shot gets its moment on the screen (anyone's: yours, your partner's, the opponents')
    if (shot.kind === 'special' && !cutDone) {
      this.specialCutIn(TEAMS[st.holder][st.hitterIdx], shot, () => this.performHit(shot, direction, prefer, options, true));
      return;
    }
    const { state, step } = stepHit(TEAMS, st, shot, direction, Math.random, prefer, { ...options, positions: this.reachPositions() });
    this.courtCount(step, options?.timing);
    this.playStep(step, state);
  }

  /**
   * The cut-in of a special shot: the court dims, a gold band sweeps across with the player (his own live picture, big) and the name of
   * the shot, about a second, then the shot is played. A touch skips it.
   */
  private specialCutIn(player: PlayerDef, shot: ShotDef, done: () => void): void {
    const v = this.views[player.id];
    // he winds up for it (the cut-in shows his live picture): the racket over the head for an overhead, back for a drop shot
    const overhead = ['smash_x4', 'smash_x3', 'vibora', 'bandeja'].includes(baseId(shot));
    this.setPose(player.id, overhead ? 'smashPrep' : 'fhPrep');
    const objs: Phaser.GameObjects.GameObject[] = [];
    const dim = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x050b1a, 0.55).setOrigin(0, 0).setDepth(9800).setAlpha(0);
    objs.push(dim);
    const mine = player.id === TEAMS[HUMAN_SIDE][HUMAN_IDX].id || TEAMS[HUMAN_SIDE].some((p) => p.id === player.id);
    const c1 = mine ? 0xffc83d : 0xff6b4a;
    const c2 = mine ? 0xff8a1a : 0xc0265a;
    const band = this.add.graphics().setDepth(9801);
    objs.push(band);
    const y0 = 150;
    const h = 170;
    band.fillStyle(c2, 1).fillPoints([new Phaser.Math.Vector2(-40, y0 + 18), new Phaser.Math.Vector2(WIDTH + 40, y0 - 12), new Phaser.Math.Vector2(WIDTH + 40, y0 + h - 12), new Phaser.Math.Vector2(-40, y0 + h + 18)], true);
    band.fillStyle(c1, 1).fillPoints([new Phaser.Math.Vector2(-40, y0 + 26), new Phaser.Math.Vector2(WIDTH + 40, y0 - 4), new Phaser.Math.Vector2(WIDTH + 40, y0 + h - 20), new Phaser.Math.Vector2(-40, y0 + h + 10)], true);
    band.lineStyle(4, 0xffffff, 0.9).lineBetween(-40, y0 + 18, WIDTH + 40, y0 - 12).lineBetween(-40, y0 + h + 18, WIDTH + 40, y0 + h - 12);
    band.x = -WIDTH;
    // speed lines
    const lines = this.add.graphics().setDepth(9802);
    objs.push(lines);
    for (let i = 0; i < 14; i++) {
      const ly = y0 + 10 + Math.random() * (h - 10);
      const lx = Math.random() * WIDTH;
      lines.lineStyle(2, 0xffffff, 0.35 + Math.random() * 0.4).lineBetween(lx, ly, lx + 40 + Math.random() * 90, ly - 4);
    }
    lines.setAlpha(0);
    // the player, big, in the pose he is in (his own picture updates live)
    const fig = this.add.image(96, y0 + h - 6, v.sprite.texture.key).setOrigin(0.5, 1).setDepth(9803).setFlipX(v.sprite.flipX);
    fig.setScale((h * 1.05) / Math.max(1, fig.height));
    fig.x = -120;
    objs.push(fig);
    const who = this.add
      .text(WIDTH - 18, y0 + 46, player.name.toUpperCase(), { fontFamily: DISPLAY, resolution: HD_SCALE, fontSize: '16px', color: '#ffffff' })
      .setOrigin(1, 0.5)
      .setDepth(9804)
      .setStroke('#0b2a5b', 5)
      .setAlpha(0);
    const name = this.add
      .text(WIDTH - 14, y0 + 92, `${shot.name.toUpperCase()}!`, { fontFamily: DISPLAY, resolution: HD_SCALE, fontSize: '34px', color: '#ffffff', align: 'right' })
      .setOrigin(1, 0.5)
      .setDepth(9804)
      .setStroke('#0b2a5b', 8)
      .setScale(1.6)
      .setAlpha(0);
    if (name.width * 1 > WIDTH - 150) name.setFontSize(26);
    objs.push(who, name);
    const tag = this.add
      .text(WIDTH - 18, y0 + 130, 'SPECIAL SHOT', { fontFamily: DISPLAY, resolution: HD_SCALE, fontSize: '12px', color: '#0b2a5b' })
      .setOrigin(1, 0.5)
      .setDepth(9804)
      .setAlpha(0);
    objs.push(tag);
    const skip = this.add.zone(0, 0, WIDTH, HEIGHT).setOrigin(0, 0).setDepth(9805).setInteractive();
    objs.push(skip);
    sfx('point', 0.8);
    this.tweens.add({ targets: dim, alpha: 1, duration: 160 });
    this.tweens.add({ targets: band, x: 0, duration: 220, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: lines, alpha: 1, delay: 120, duration: 160 });
    this.tweens.add({ targets: lines, x: -60, delay: 120, duration: 900 });
    this.tweens.add({ targets: fig, x: 96, delay: 90, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({ targets: [who, tag], alpha: 1, delay: 220, duration: 160 });
    this.tweens.add({ targets: name, alpha: 1, scale: 1, delay: 260, duration: 240, ease: 'Back.easeOut' });
    let over = false;
    const finish = (): void => {
      if (over) return;
      over = true;
      skip.destroy();
      this.tweens.add({
        targets: objs.filter((o) => o !== skip),
        alpha: 0,
        duration: 140,
        onComplete: () => {
          for (const o of objs) o.destroy();
          done();
        },
      });
    };
    skip.on('pointerdown', finish);
    this.time.delayedCall(1250, finish);
  }

  /**
   * The timing ring of a key shot: the ball comes to the racket (down from above for an overhead, dropped and up off its bounce for a
   * serve) and a ring closes on it; the player touches anywhere as it closes. The quality (0 to 1) goes to the engine: a clean hit is
   * safer and stronger, a mistimed one riskier and weaker. A grade flashes over the ball.
   */
  private timingRing(kind: 'serve' | 'high' | 'out', hitter: PlayerDef, done: (q: number) => void, pathAt?: (ms: number) => { x: number; z: number; h: number }): void {
    // the first ring of the player's life comes with its lesson (the scene waits, then the ring starts)
    if (showTip(this, 'ring', () => this.timingRing(kind, hitter, done, pathAt))) return;
    const at = { ...this.ballFloor };
    const hitH = this.ballH;
    const window = ringWindow(hitter);
    const due = kind === 'serve' ? SERVE_DUE_MS : 900;
    const drop = DROP_MS;
    const ballAt = (ms: number): number => {
      if (kind !== 'serve') {
        const u = Math.min(1.3, ms / due);
        return Math.max(0.3, hitH + 1.6 * (1 - u));
      }
      // dropped from the hand, a bounce, up to the hip and down again: struck between the knee and the hip (art/serveDrop.ts)
      return serveBallH(ms, drop, due);
    };
    // he loads the shot while it comes: the racket back over the head (an overhead) or low behind him (the serve)
    if (kind === 'high') this.setPose(hitter.id, 'smashPrep');
    else if (kind === 'out') this.setPose(hitter.id, 'fhPrep');
    const ring = this.add.graphics().setDepth(9990);
    const hint = this.add
      .text(WIDTH / 2, 470, kind === 'serve' ? 'TOUCH WHEN THE RING\nCLOSES ON THE BALL' : 'TOUCH WHEN THE RING\nCLOSES ON THE BALL', { fontFamily: DISPLAY, resolution: HD_SCALE, fontSize: '15px', color: '#ffe066', align: 'center' })
      .setOrigin(0.5)
      .setDepth(9996)
      .setStroke('#0b2a5b', 5);
    const tap = this.add.zone(0, 0, WIDTH, HEIGHT).setOrigin(0, 0).setDepth(9995).setInteractive();
    const t0 = this.time.now;
    this.ringDueAt = t0 + due;
    this.ball.setVisible(true);
    let finished = false;
    const finish = (offMs: number | null): void => {
      if (finished) return;
      finished = true;
      tick.remove();
      tap.destroy();
      hint.destroy();
      ring.destroy();
      const q = ringQuality(offMs, window);
      const ms1 = Math.min(this.time.now - t0, due + window);
      const q1 = pathAt ? pathAt(ms1) : { x: at.x, z: at.z, h: ballAt(ms1) };
      this.ballH = Math.max(0.3, q1.h);
      this.setBall(q1.x, q1.z, this.ballH, false);
      const p = project(q1.x, q1.z, this.ballH);
      const grade = q >= 0.95 ? 'PERFECT!' : q >= 0.6 ? 'GOOD' : q > 0 ? 'LATE' : 'MISTIMED';
      const t = this.add
        .text(p.x, p.y - 26, grade, { fontFamily: DISPLAY, resolution: HD_SCALE, fontSize: q >= 0.95 ? '20px' : '16px', color: q >= 0.95 ? '#4ade80' : q >= 0.6 ? '#ffe066' : '#ff9a6a' })
        .setOrigin(0.5)
        .setDepth(9997)
        .setStroke('#0b2a5b', 5);
      this.tweens.add({ targets: t, y: p.y - 50, alpha: 0, delay: 350, duration: 450, onComplete: () => t.destroy() });
      done(q);
    };
    const tick = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        const ms = this.time.now - t0;
        const q0 = pathAt ? pathAt(ms) : { x: at.x, z: at.z, h: ballAt(ms) };
        this.setBall(q0.x, q0.z, q0.h, false);
        const p = project(q0.x, q0.z, q0.h);
        const u = Math.min(1, ms / due);
        const green = Math.abs(ms - due) <= window * 0.4;
        ring.clear().lineStyle(green ? 4 : 3, green ? 0x4ade80 : 0xffffff, 0.95).strokeCircle(p.x, p.y, Math.max(7, 64 * (1 - u) + 8));
        if (ms > due + window + 150) finish(null);
      },
    });
    // judged at the moment the finger landed, not when the busy phone got round to the event (see touchTime.ts)
    tap.on('pointerdown', (ptr: Phaser.Input.Pointer) => finish(touchTime(this.time.now, performance.now(), eventStamp(ptr)) - t0 - due));
  }

  /** The flight of the ball for a step (the same seed always gives the same flight). */
  private buildStepFlight(step: Step, seed: number, startH: number): { flight: Flight; landX: number } {
    const attacker = TEAMS[step.side][step.attackerIdx];
    const landX =
      step.kind === 'serve'
        ? laneSign(step.defenderIdx) * (step.shot.landX ?? 3)
        : step.landX !== undefined
          ? step.landX
          : step.shot.edgeX !== undefined
          ? Math.sign(landingX(step.direction, step.defenderIdx) || 1) * step.shot.edgeX
          : landingX(step.direction, step.defenderIdx);
    const flight = buildFlight({
      from: { ...this.pos[attacker.id] },
      startH,
      hitterSide: step.side,
      shot: step.shot,
      landX,
      outcome: step.outcome,
      receive: step.receive,
      seed,
      glass: step.kind === 'serve' ? undefined : step.glass,
      arrival: step.arrival,
      landDepth: step.landDepth,
      block: step.block,
      airDist: step.airDist,
      errorKind: step.errorKind,
      reboundBack: step.reboundBack,
      netReturn: step.netReturn,
      airHit: step.lob === 'weak' || step.lob === 'medium',
      // Hard when the ball comes to the hitter's strike zone, slower off a low ball; a volley on a slow ball gets more pace.
      speedMul: (step.kind === 'serve' ? (step.second ? SECOND_SERVE_SPEED : 1) : paceFactor(step.shot, this.point.ball)) * powerSpeedMul(attacker.stats.power * (step.powerFactor ?? 1)),
      spinMul: spinMul(attacker.stats.spin),
    });
    return { flight, landX };
  }

  /**
   * Animates one step (ball flight, hop, movement), then decides what happens next. `from` (0..1) resumes a serve that was already
   * on its way (the receiver's decision): the same seed rebuilds the same flight and it goes on from there.
   */
  private playStep(step: Step, next: PointState, opts?: { seed?: number; from?: number; startH?: number }): void {
    const attacker = TEAMS[step.side][step.attackerIdx];
    const defender = TEAMS[other(step.side)][step.defenderIdx];
    this.stopCoast();
    this.guts = { ...next.guts };
    this.refreshGuts();

    const { flight, landX } = this.buildStepFlight(step, opts?.seed ?? Math.floor(Math.random() * 1e9), opts?.startH ?? this.ballH);
    const from = opts?.from ?? 0;
    const duration = flightDuration(flight);
    // The ball leaves the racket spinning: topspin / backspin about the horizontal axis, side spin about the vertical one.
    {
      const k = Math.min(flight.path.length - 1, 12);
      const a = flight.path[0];
      const b = flight.path[k];
      this.ballOmega = launchSpin(step.shot.flight.spin, step.shot.flight.side, b.x - a.x, b.z - a.z);
      this.ballTurnedAt = this.time.now;
    }

    const way = step.kind === 'serve' ? '' : ` ${DIRECTIONS[step.direction].name.toLowerCase()}`;
    const smashName = shotLabel(step);
    const headline = `${attacker.name}: ${smashName}${way}!${step.tired ? ' (risky)' : ''}`;
    this.say(headline);
    if (from === 0) {
      impactSound(
        racketKind(baseId(step.shot), step.kind === 'serve', step.shot.flight.speed),
        baseId(step.shot).startsWith('smash_') || step.shot.id === 'rulo' ? 1 : Math.max(0.15, Math.min(1, step.shot.flight.speed / 30)),
      );
      this.swing(attacker.id, step.kind === 'serve' ? null : step.shot, landX - this.pos[attacker.id].x);
      // Split step: the pair that is about to receive the ball hops a little as the opponent hits it (not during a serve, nobody moves then).
      if (step.kind !== 'serve') {
        for (const q of TEAMS[other(step.side)]) {
          this.time.delayedCall(40, () => {
            const w = this.views[q.id];
            if (w.lift === 0 && this.time.now >= w.busyUntil && !w.rig.driving()) {
              w.rig.play(this.time.now, splitSteps());
              this.jump(q.id, 7, 160);
            }
          });
        }
      }
      if (isPowerfulSmash(step)) this.powerSmashFx();
      this.hitFlash(attacker.id, step.kind === 'serve' ? 0.3 : Math.min(1, step.shot.flight.speed / 34 + (baseId(step.shot).startsWith('smash_') ? 0.4 : 0)));
    }
    // Por Cuatro (and a strong Por Tres) leave a mark where the ball hits the court.
    this.powerStyle = baseId(step.shot) === 'smash_x4' ? 'x4' : baseId(step.shot) === 'smash_x3' && (step.outcome === 'winner' || step.reboundBack === true) ? 'x3' : null;
    if (step.answered) {
      const saver = TEAMS[other(step.side)][step.defenderIdx];
      this.time.delayedCall(Math.min(900, duration * 0.6), () => {
        this.announce('SAVED!', '#5db4ff', `${saver.name} gets the ${step.shot.name} back`);
        this.say(`${saver.name} reads the ${step.shot.name} and gets it back!`);
      });
    }

    // Everybody moves while the ball flies: the hitter's team takes up its new formation, and the player who
    // has to play the ball runs to the spot where it will be hit (after the bounce, or after the glass).
    const out = step.outcome;
    const targets: Record<string, CourtPos> = {};
    const endPose: Record<string, PoseName> = {};
    const endFacing: Record<string, Facing> = {};
    const defSideNow = other(step.side);
    const clampX = (x: number): number => Math.max(-4.2, Math.min(4.2, x));
    const clampZ = (z: number): number => Math.max(defSideNow === 0 ? NET_Z + 1.2 : 1, Math.min(defSideNow === 0 ? 19 : NET_Z - 1.2, z));
    /** Nobody stands still: the hitting pair follows the shot into its new formation, shifted towards the side the ball was sent to. */
    const shiftHitters = (): void => {
      const shift = Math.max(-1.2, Math.min(1.2, 0.25 * landX));
      for (const p of TEAMS[step.side]) {
        const t = targets[p.id];
        targets[p.id] = { x: clampX(t.x + shift), z: t.z };
      }
    };
    // Both players are in the game. The partner covers the court: he slides across towards the ball (so the pair closes the
    // middle), drops back or comes forward with his partner, and never stands closer than about 1.8 m to him.
    const movePartner = (): void => {
      const partner = TEAMS[defSideNow][1 - step.defenderIdx];
      const base = targets[partner.id];
      const spot = targets[defender.id];
      let px = base.x + 0.55 * (flight.hit.x - base.x);
      const gap = 1.8;
      if (Math.abs(px - spot.x) < gap) px = spot.x + (base.x >= spot.x ? gap : -gap);
      px = clampX(px);
      const pz = clampZ(base.z + 0.6 * (spot.z - base.z));
      // Never stand still: if the new spot is almost where he is, he takes a small step to the side that covers the court.
      const cur = this.pos[partner.id];
      const tiny = Math.hypot(px - cur.x, pz - cur.z) < 0.5;
      targets[partner.id] = { x: tiny ? clampX(px + (px > 0 ? -0.6 : 0.6)) : px, z: pz };
    };
    if (out === 'in' || out === 'continue') {
      Object.assign(targets, this.rallyTargets(next));
      // The player who has to play the ball picks a stance and stands beside the ball's landing spot.
      // A ball that comes off the back glass (bajada) is played with the back to the glass and the face to the net: the player
      // stands a little behind the ball and hits it from the side (the ball at about one or two o'clock), with the racket above the ball and the stroke going down.
      const offGlass = step.glass === true && step.kind !== 'serve';
      const stance = chooseStance(other(step.side), this.pos[defender.id].x, flight.hit.x, offGlass ? 0 : flight.hitH);
      // A player at the net (or one who takes the ball out of the air) waits with the racket up and plays his volley from above.
      const prepStance: Stance = stance !== 'smash' && (step.block === true || next.formation[other(step.side)] === 'net') ? (stance === 'bh' ? 'bhv' : 'fhv') : stance;
      this.stance[defender.id] = prepStance;
      targets[defender.id] = standingSpot(other(step.side), stance, flight.hit, offGlass ? REBOUND_BEHIND_BALL : 0);
      this.hitHeight[defender.id] = offGlass ? 1 : flight.hitH;
      this.planLunge(defender.id, targets[defender.id], duration * (1 - from), 0);
      endPose[defender.id] = poseOf(prepStance, step.block ? 'Hit' : 'Prep');
      movePartner();
      shiftHitters();
    } else if (out === 'winner' || out === 'ace' || out === 'error') {
      // The point ends with this ball, but nobody freezes: the defender runs for it (all the way when it is a winner, but he cannot get
      // there in time and lunges a moment too late; a part of the way when it is an error, then he watches it go), the partner covers,
      // and the hitting pair follows its shot.
      Object.assign(targets, this.rallyTargets(next));
      const d = this.pos[defender.id];
      const stance = chooseStance(other(step.side), d.x, flight.hit.x, flight.hitH);
      const spot = standingSpot(other(step.side), stance, flight.hit);
      if (out === 'error') {
        targets[defender.id] = { x: clampX(d.x + 0.65 * (spot.x - d.x)), z: clampZ(d.z + 0.45 * (spot.z - d.z)) };
      } else {
        // too late: he runs for it but stops short (the ball clearly passes out of his reach, never past his racket), and throws
        // himself at it with a full lunge
        const dist = Math.hypot(spot.x - d.x, spot.z - d.z);
        const cover = dist > 1e-6 ? Math.max(0, Math.min(dist - WINNER_MISS_M, dist * WINNER_RUN_SHARE)) / dist : 0;
        targets[defender.id] = { x: clampX(d.x + cover * (spot.x - d.x)), z: clampZ(d.z + cover * (spot.z - d.z)) };
        endPose[defender.id] = poseOf(stance, 'Hit');
        this.planLunge(defender.id, spot, duration * (1 - from), 1);
      }
      movePartner();
      shiftHitters();
    } else {
      // A fault or a double fault: the receivers take a few steps towards the ball and stop when it is clearly out.
      const d = this.pos[defender.id];
      targets[defender.id] = { x: clampX(d.x + 0.4 * (flight.hit.x - d.x)), z: clampZ(d.z + 0.3 * (flight.hit.z - d.z)) };
    }
    // A Por Tres that bounced in his half and left over the side wall: the ball hangs in the air at the wall while the runner decides
    // (the whole match waits), so everything of this ball stops there (see `runOutPhase`).
    const runner = TEAMS[other(step.side)][step.defenderIdx];
    let exit = canRunOut(step) && (next.guts[runner.id] ?? runner.maxGuts) >= RUN_OUT_COST ? flight.events.find((e) => e.kind === 'out' && Math.abs(e.x) >= 4.7 && e.t >= flight.duration * 0.97) : undefined;
    // it is only offered when the runner can reach the ball while it is still playable (see `runOutPlan`); a defender who sees a Por
    // Tres going over the wall sets off for the door while the ball is still in the air, so he is by the door when it hangs
    const coast = exit ? buildCoast(flight, step.shot.flight.spin) : undefined;
    let plan: RunOutPlan | null = null;
    if (exit && coast && flight.duration > 0 && from < 1) {
      const runSide = other(step.side);
      const sgn = Math.sign(exit.x) || 1;
      const here = this.pos[runner.id];
      const door = { x: sgn * 4.95, z: doorShot(runSide, { x: sgn * 5.5, z: 12 }).gate.z };
      const flightMs = duration * (Math.min(1, Math.max(from + 0.05, exit.t / flight.duration)) - from);
      const per = this.runOutPace(runner);
      const dist = Math.hypot(door.x - here.x, door.z - here.z);
      const k = dist > 0 ? Math.min(1, flightMs / (dist * per / Math.max(0.77, this.freshness(runner.id)))) : 1;
      const reach: CourtPos = { x: here.x + (door.x - here.x) * k, z: here.z + (door.z - here.z) * k };
      plan = this.runOutPlan(runner, runSide, reach, coast);
      if (plan) targets[runner.id] = reach;
    }
    if (!plan) exit = undefined;
    const hangU = exit && flight.duration > 0 && from < 1 ? Math.min(1, Math.max(from + 0.05, exit.t / flight.duration)) : 1;
    const remain = duration * (hangU - from);
    this.movePlayers(targets, remain, undefined, endPose, endFacing);
    // Hit-stop: the ball stays on the racket for a moment at contact (not on a serve), so the contact reads.
    const hold = from === 0 && step.kind !== 'serve' ? HIT_STOP + 60 : 0;
    for (const e of flight.events) {
      const at = flight.duration > 0 ? e.t / flight.duration : 0;
      if (at < from || at > hangU + 1e-6) continue;
      this.time.delayedCall(hold + (at - from) * duration, () => this.impactFx(e, flight.path));
    }

    /** The end of the flight: the ball falls, bounces and rolls on, and what happens next (the point goes on, or is over). */
    const settle = (): void => {
      this.powerStyle = null;
      this.trail = [];
      this.drawTrail();
      this.ballH = flight.hitH;
      // When the point is over the ball is not stopped: it falls, bounces and rolls on.
      const over = ['winner', 'ace', 'error', 'double-fault', 'fault'].includes(step.outcome);
      const coast = over ? this.playCoast(flight, step.shot.flight.spin) : { ms: 0, end: null };
      // A defender who has lost the point still runs after the ball until it has stopped.
      if (coast.end && !step.reboundBack && (step.outcome === 'winner' || step.outcome === 'ace')) this.chaseBall(defender.id, other(step.side), coast.end, coast.ms);
      this.afterStep(step, next, headline, coast.ms);
    };
    /** The rest of the flight after the hang (the runner did not go, or did not get there), then the end as usual. */
    const resume = (): void => {
      if (hangU >= 1) {
        settle();
        return;
      }
      const rest = Math.max(200, duration * (1 - hangU));
      this.tweens.addCounter({
        from: hangU,
        to: 1,
        duration: rest,
        onUpdate: (tween: Phaser.Tweens.Tween) => {
          const p = ballPoint(flight.path, tween.getValue() ?? 0);
          this.setBall(p.x, p.z, p.h);
        },
        onComplete: settle,
      });
    };

    this.tweens.addCounter({
      from,
      to: hangU,
      delay: hold,
      duration: remain,
      onUpdate: (tween: Phaser.Tweens.Tween) => {
        const p = ballPoint(flight.path, tween.getValue() ?? 0);
        this.setBall(p.x, p.z, p.h);
      },
      onComplete: () => {
        if (exit) {
          this.runOutPhase(step, next, headline, exit, coast!, plan!, resume);
          return;
        }
        settle();
      },
    });
  }

  /** Lets the ball carry on freely after the flight: bounces, rolls, glass, outside the court. Returns its length in ms. */
  private playCoast(flight: Flight, spin: number): { ms: number; end: CourtPos | null } {
    const coast = buildCoast(flight, spin);
    if (coast.duration <= 0) return { ms: 0, end: null };
    const ms = Math.min(3400, coast.duration * TIME_SCALE * 1000);
    this.coastRunning = true;
    for (const e of coast.events) {
      this.time.delayedCall((e.t / coast.duration) * ms, () => this.impactFx(e, coast.path));
    }
    const asFlight: Flight = { ...flight, path: coast.path, duration: coast.duration };
    this.coastTween = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: ms,
      onUpdate: (tween: Phaser.Tweens.Tween) => {
        const p = ballPoint(asFlight.path, tween.getValue() ?? 0);
        this.setBall(p.x, p.z, p.h);
      },
      onComplete: () => {
        this.coastRunning = false;
      },
    });
    const last = coast.path[coast.path.length - 1];
    return { ms, end: { x: last.x, z: last.z } };
  }

  /** The player runs towards where the ball is going (kept inside his half of the court). */
  private chaseBall(id: string, side: SideIndex, ball: CourtPos, ms: number): void {
    const from = this.pos[id];
    const zMin = side === 0 ? NET_Z + 0.8 : 0.6;
    const zMax = side === 0 ? 19.4 : NET_Z - 0.8;
    const target = {
      x: Math.max(-4.7, Math.min(4.7, lerp(from.x, ball.x, 0.9))),
      z: Math.max(zMin, Math.min(zMax, lerp(from.z, ball.z, 0.9))),
    };
    this.movePlayers({ [id]: target }, Math.max(300, ms), undefined, {}, {}, [id]);
  }

  /** What happened to a lost ball, for the log. */
  private errorText(step: Step): string {
    if (step.errorKind === 'glass') return 'sends it into the back glass without a bounce: out';
    if (step.errorKind === 'mesh') return 'sends it into the fence above the glass: out';
    if (step.errorKind === 'side') return step.kind === 'serve' ? 'hits the glass low first: out' : 'sends it straight into the side wall: out';
    if (step.errorKind === 'long') return 'bounces beyond the line: out';
    if (step.errorKind === 'bouncemesh') return 'bounces and then lands on the fence: out';
    return 'hits the net';
  }

  /** Where a faulted serve went, for the log. */
  private faultWhere(step: Step): string {
    switch (step.errorKind) {
      case 'glass': return 'into the back glass';
      case 'mesh': return 'into the fence';
      case 'side': return 'low on the glass first';
      case 'long': return 'bounce beyond the line';
      case 'bouncemesh': return 'bounced, then on the fence';
      default: return 'net';
    }
  }

  private stopCoast(): void {
    this.coastTween?.stop();
    this.coastTween = null;
    this.coastRunning = false;
  }

  /** Ms per metre of a run-out sprint: a little quicker than his pace in the rally (about 3.8 m/s at speed 5), not the 6.7 m/s it was. */
  private runOutPace(p: PlayerDef): number {
    return 0.88 * Math.max(220, Math.min(360, 300 - 12 * (p.stats.speed - 5)));
  }

  /**
   * Can the runner get to the ball? The ball carries on along the path physics gives it outside the court (`buildCoast`: it falls,
   * bounces, the fence took some speed off it); he meets it at hitting height (0.5 to 1.4: on its way down, or after the bounce), outside the side wall
   * and in his own half, when it comes to him at his ordinary running pace (through the door by the net, then out to the ball) and
   * with the ring (0.9 s) closing as he arrives. The ball is allowed to be up to 2.3x slower than life for that (it floats like a high lob). null: out of reach, so no
   * run-out is offered and the point is simply lost.
   */
  private runOutPlan(runner: PlayerDef, runSide: SideIndex, from: CourtPos, coast: Coast): RunOutPlan | null {
    const zMin = runSide === 0 ? NET_Z + 1.0 : 1.2;
    const zMax = runSide === 0 ? 18.6 : NET_Z - 1.0;
    const per = this.runOutPace(runner);
    const fresh = Math.max(0.77, this.freshness(runner.id));
    const path = coast.path;
    for (let i = 2; i < path.length; i++) {
      const s = path[i];
      if (s.h < 0.5 || s.h > 1.4) continue;
      if (Math.abs(s.x) < 5.25 || s.z < zMin || s.z > zMax) continue;
      const sgn = Math.sign(s.x);
      const cx = sgn * Math.min(Math.abs(s.x), RUN_OUT_MAX_X);
      const gate: CourtPos = { x: sgn * 4.95, z: doorShot(runSide, { x: cx, z: s.z }).gate.z };
      const spot: CourtPos = { x: cx + sgn * 0.45, z: s.z + (runSide === 0 ? 0.4 : -0.4) };
      const m1 = Math.max(260, Math.hypot(gate.x - from.x, gate.z - from.z) * per) / fresh;
      const m2 = Math.max(240, Math.hypot(spot.x - gate.x, spot.z - gate.z) * per) / fresh;
      const natural = s.t * TIME_SCALE * 1000;
      const stretch = Math.max(1, (m1 + m2 + 300) / natural);
      if (stretch <= 2.3) return { contact: { x: cx, z: s.z }, stretch, hitMs: natural * stretch, m1, m2 };
    }
    return null;
  }

  /**
   * Out-of-court play after a Por Tres (FIP rules, `canRunOut`): the defender may run out through the opening by the net after the
   * ball and play it back. The ball HANGS in the air at the wall and the match waits; yours: a RUN OUT! button (it costs guts), the
   * CPU decides by itself. Then the ball carries on, a long way, while the runner runs at his ordinary pace to meet it, and you choose
   * how to play it: a LOB over the wall or, where the angles allow it (`doorShot`), flat and low through the door. The timing ring
   * closes as the ball comes down on the racket. Made (`runOutReturn`): the rally goes on, but a ball from outside is very hard to keep
   * in play. Not made (or not tried): the point ends as a winner (`resume`: the rest of the flight, then `afterStep`).
   */
  private runOutPhase(step: Step, next: PointState, headline: string, exit: FlightEvent, coast: Coast, plan: RunOutPlan, resume: () => void): void {
    const runSide = other(step.side);
    const runner = TEAMS[runSide][step.defenderIdx];
    const id = runner.id;
    const human = this.isHuman(runSide, step.defenderIdx);
    if (human && showTip(this, 'runout', () => this.runOutPhase(step, next, headline, exit, coast, plan, resume))) return;
    const sgn = Math.sign(exit.x) || 1;
    this.powerStyle = null;
    this.trail = [];
    this.drawTrail();
    const p0 = coast.path[0];
    this.setBall(p0.x, p0.z, p0.h, false);
    const hangX = p0.x;
    const hangZ = p0.z;
    const hangH = (this.ballH = p0.h);
    // where he meets the ball (the ball's own path, see `runOutPlan`) and the door by the net on that side, in his half
    const contact: CourtPos = plan.contact;
    const spot: CourtPos = { x: contact.x + sgn * 0.45, z: contact.z + (runSide === 0 ? 0.4 : -0.4) };
    const door = doorShot(runSide, contact);
    const gate: CourtPos = { x: sgn * 4.95, z: door.gate.z };
    // (the screen ends a little way outside the wall: the ball is kept inside it)
    const posAt = (ms: number): { x: number; z: number; h: number } => {
      const p = ballPoint(coast.path, Math.max(0, Math.min(1, ms / plan.stretch / (coast.duration * TIME_SCALE * 1000))));
      return { ...p, x: Math.sign(p.x) * Math.min(Math.abs(p.x), RUN_OUT_MAX_X) };
    };
    let mode: RunOutMode = 'lob';
    const extras: Phaser.GameObjects.GameObject[] = [];
    const clearExtras = (): void => {
      for (const o of extras.splice(0)) o.destroy();
    };

    // --- the run at his ordinary pace; the ball carries on along its own path (the real bounces outside the court, a little slower than
    // life so that he can get there) and comes to the racket as the ring closes
    const RING = 900;
    const go = (): void => {
      this.say(`${runner.name} runs out after it!`);
      this.movePlayers({ [id]: gate }, plan.m1, () => this.movePlayers({ [id]: spot }, plan.m2, undefined, {}, {}, [id]), {}, {}, [id]);
      const lead = Math.max(1, plan.hitMs - RING);
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: lead,
        onUpdate: (tw) => {
          const p = posAt((tw.getValue() ?? 0) * lead);
          this.setBall(p.x, p.z, p.h, false);
        },
        onComplete: () => arrive(lead),
      });
      if (human) this.runOutChoice(door, plan.hitMs, (m) => (mode = m), extras);
      else if (door.open && Math.random() < 0.3 + 0.4 * door.window) mode = 'door';
    };
    const arrive = (lead: number): void => {
      clearExtras();
      this.stopCoast();
      this.ball.setVisible(true);
      const pathAt = (ms: number): { x: number; z: number; h: number } => posAt(lead + ms);
      if (human && getSave().settings.timing !== 'auto') this.timingRing('out', runner, (q) => resolve(q), pathAt);
      else {
        this.tweens.addCounter({
          from: 0,
          to: 1,
          duration: RING,
          onUpdate: (tw) => {
            const p = pathAt((tw.getValue() ?? 0) * RING);
            this.setBall(p.x, p.z, p.h, false);
          },
          onComplete: () => resolve(undefined),
        });
      }
    };
    const resolve = (q: number | undefined): void => {
      const useDoor = mode === 'door' && door.open;
      const r = runOutReturn(TEAMS, next, step, Math.random, q, useDoor ? 'door' : 'lob', door.window);
      this.guts = { ...r.state.guts };
      this.refreshGuts();
      if (this.practice === 'court' && human) {
        this.court.shots++;
        if (r.made) this.court.inPlay++;
        else this.court.errors++;
        this.refreshScore();
      } else if (this.practice === 'court' && r.made && step.side === HUMAN_SIDE && step.attackerIdx === HUMAN_IDX) {
        // your Por Tres was counted as a winner when you hit it; they got it back, so it was not one
        this.court.winners = Math.max(0, this.court.winners - 1);
        this.court.inPlay++;
        this.refreshScore();
      }
      if (!r.made) {
        // a stretch, a moment too late (or the flat ball into the fence, beside the door)
        this.planLunge(id, { x: spot.x + sgn * 0.6, z: spot.z }, 160, 1);
        this.setPose(id, 'fhHit');
        this.say(useDoor ? `${runner.name} gets there but the ball does not find the door!` : `${runner.name} gets there but cannot play it back: TOO FAR!`);
        // the ball carries on along its own path outside and the point is over (the WINNER! banner of the point follows)
        const t1 = plan.hitMs;
        this.tweens.addCounter({
          from: 0,
          to: 1,
          duration: 600,
          onUpdate: (tw) => {
            const p = posAt(t1 + (tw.getValue() ?? 0) * 600);
            this.setBall(p.x, p.z, p.h, false);
          },
          onComplete: () => this.afterStep(step, next, headline, 600),
        });
        return;
      }
      this.announce('RUN OUT!', '#4ade80', useDoor ? `${runner.name} fires it through the door` : `${runner.name} gets it back`);
      this.say(useDoor ? `${runner.name} plays it flat through the door! The rally goes on, under heavy pressure.` : `${runner.name} gets it back from outside the court! The rally goes on.`);
      sfx('hit');
      this.swing(id, null);
      const from = { x: this.ballFloor.x, z: this.ballFloor.z, h: this.ballH };
      let state = r.state;
      let ms = 1500;
      let to: { x: number; z: number; h: number };
      let arc: (u: number) => number;
      if (useDoor) {
        // flat and fast through the door, over the net, to the one of the pair who is closer to where it lands
        const lx = Math.max(-4.6, Math.min(4.6, door.target.x));
        const near = TEAMS[step.side].reduce((a, p) => (Math.abs(this.pos[p.id].x - lx) < Math.abs(this.pos[a.id].x - lx) ? p : a));
        state = { ...state, hitterIdx: TEAMS[step.side].indexOf(near) };
        to = { x: lx, z: door.target.z, h: ARRIVAL_HEIGHT.low };
        ms = 650;
        arc = (u) => from.h * (1 - u) ** 2 + 2 * (1 - u) * u * 1.5 + ARRIVAL_HEIGHT.low * u * u - (from.h + (to.h - from.h) * u);
      } else {
        // the lob: up over the wall and back into the hitting pair's half, to the one who will play it
        const land = restPos(step.side, state.hitterIdx, 'mid');
        to = { x: land.x, z: land.z, h: ARRIVAL_HEIGHT.high };
        arc = (u) => 4 * 6.5 * u * (1 - u);
      }
      const recv = TEAMS[step.side][state.hitterIdx];
      // everybody to their places for the next ball: the runner comes back in through the opening, his partner covers
      const targets = this.rallyTargets(state);
      const home = targets[id];
      delete targets[id];
      if (useDoor) targets[recv.id] = { x: to.x, z: to.z + (step.side === 0 ? 0.5 : -0.5) };
      this.movePlayers(targets, ms * 0.85, undefined, { [recv.id]: 'ready' }, {}, [recv.id]);
      this.time.delayedCall(260, () => {
        this.movePlayers({ [id]: gate }, 520, () => this.movePlayers({ [id]: home }, 600, undefined, {}, {}, [id]), {}, {}, [id]);
      });
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: ms,
        onUpdate: (tw) => {
          const u = tw.getValue() ?? 0;
          this.setBall(from.x + (to.x - from.x) * u, from.z + (to.z - from.z) * u, from.h + (to.h - from.h) * u + arc(u));
        },
        onComplete: () => {
          this.point = state;
          this.ballH = to.h;
          this.setBall(this.pos[recv.id].x, this.pos[recv.id].z, this.ballH, false);
          this.hitTurn();
        },
      });
    };

    // --- the hang: the ball stays where it is, the match waits for the decision
    const decline = (): void => {
      clearExtras();
      resume();
    };
    if (!human) {
      // the CPU (and your partner) goes for it most of the time when he has the legs and the guts
      this.time.delayedCall(450, () => (Math.random() < 0.4 + 0.08 * runner.stats.speed ? go() : decline()));
      return;
    }
    this.clearMenu();
    const bx = WIDTH / 2;
    const by = 500;
    const base = this.add.graphics().setDepth(9990);
    base.fillStyle(0xff8a1a, 1).fillRoundedRect(bx - 120, by - 34, 240, 68, 18);
    base.lineStyle(4, 0x0b2a5b, 1).strokeRoundedRect(bx - 120, by - 34, 240, 68, 18);
    const label = this.add
      .text(bx, by - 6, 'RUN OUT!', { fontFamily: DISPLAY, resolution: HD_SCALE, fontSize: '30px', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(9991)
      .setStroke('#0b2a5b', 5);
    const sub2 = this.add
      .text(bx, by + 22, `chase it outside  [${RUN_OUT_COST} G]`, { fontFamily: DISPLAY, resolution: HD_SCALE, fontSize: '12px', color: '#0b2a5b' })
      .setOrigin(0.5)
      .setDepth(9991);
    const bar = this.add.graphics().setDepth(9991);
    const halo = this.add.graphics().setDepth(9989);
    const hit = this.add.zone(bx - 130, by - 44, 260, 88).setOrigin(0, 0).setDepth(9992).setInteractive({ useHandCursor: true });
    this.tweens.add({ targets: [base, label, sub2], scale: { from: 0.7, to: 1 }, duration: 200, ease: 'Back.easeOut' });
    const t0 = this.time.now;
    const window = 2600;
    let decided = false;
    const close = (): void => {
      tick.remove();
      for (const o of [base, label, sub2, bar, halo, hit]) o.destroy();
    };
    const tick = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        const el = this.time.now - t0;
        const left = 1 - el / window;
        bar.clear().fillStyle(0x0b2a5b, 0.85).fillRect(bx - 110, by + 38, 220 * Math.max(0, left), 5);
        // the ball hangs, a ring pulses round it
        const p = project(hangX, hangZ, hangH);
        const k = 0.5 + 0.5 * Math.sin(el / 120);
        halo.clear().lineStyle(3, 0xffe066, 0.9 - 0.4 * k).strokeCircle(p.x, p.y, 16 + 8 * k);
        if (left <= 0 && !decided) {
          decided = true;
          close();
          decline();
        }
      },
    });
    hit.on('pointerdown', () => {
      if (decided) return;
      decided = true;
      sfx('select');
      close();
      go();
    });
  }

  /**
   * While the runner runs: the choice of the shot, LOB (always) or DOOR (flat through the opening by the net; only where the
   * angle allows it). Gone when he arrives; no touch means the lob.
   */
  private runOutChoice(door: DoorShot, ms: number, set: (m: RunOutMode) => void, bag: Phaser.GameObjects.GameObject[]): void {
    const y = 500;
    const items: Array<{ mode: RunOutMode; x: number; title: string; sub: string; on: boolean }> = [
      { mode: 'lob', x: WIDTH / 2 - 84, title: 'LOB', sub: 'over the wall · safe', on: true },
      { mode: 'door', x: WIDTH / 2 + 84, title: 'DOOR', sub: door.open ? `flat · ${door.window >= 0.6 ? 'wide' : 'narrow'} angle` : 'no angle from here', on: door.open },
    ];
    let chosen: RunOutMode = 'lob';
    const draw: Array<() => void> = [];
    for (const it of items) {
      const g = this.add.graphics().setDepth(9990);
      const t1 = this.add.text(it.x, y - 8, it.title, { fontFamily: DISPLAY, resolution: HD_SCALE, fontSize: '24px', color: it.on ? '#ffffff' : '#9aa7bb' }).setOrigin(0.5).setDepth(9991).setStroke('#0b2a5b', 5);
      const t2 = this.add.text(it.x, y + 18, it.sub, { fontFamily: DISPLAY, resolution: HD_SCALE, fontSize: '10px', color: it.on ? '#0b2a5b' : '#6b7a90' }).setOrigin(0.5).setDepth(9991);
      const z = this.add.zone(it.x - 78, y - 32, 156, 64).setOrigin(0, 0).setDepth(9992);
      if (it.on) z.setInteractive({ useHandCursor: true });
      const paint = (): void => {
        const sel = chosen === it.mode;
        g.clear();
        g.fillStyle(!it.on ? 0xdfe5ee : sel ? 0xff8a1a : 0x5b7db8, 1).fillRoundedRect(it.x - 76, y - 30, 152, 60, 14);
        g.lineStyle(sel ? 5 : 3, sel ? 0xffe066 : 0x0b2a5b, 1).strokeRoundedRect(it.x - 76, y - 30, 152, 60, 14);
      };
      draw.push(paint);
      paint();
      z.on('pointerdown', () => {
        chosen = it.mode;
        set(it.mode);
        sfx('select');
        for (const d of draw) d();
      });
      bag.push(g, t1, t2, z);
    }
    void ms;
    // (door open: the ball is better played through it when the angle is wide; the lob stays the default so a missed touch is safe)
  }

  private afterStep(step: Step, next: PointState, headline: string, coastMs = 0): void {
    const attacker = TEAMS[step.side][step.attackerIdx];
    const defender = TEAMS[other(step.side)][step.defenderIdx];
    this.point = next;

    const endPoint = (text: string, delay = Math.max(POINT_PAUSE + 870, Math.min(coastMs + 350, 2200) + 370)): void => {
      const winnerLine = step.pointWinner === null ? '' : `  >  POINT TO ${SIDE_NAME[step.pointWinner]}`;
      this.say(`${headline}\n${text}${winnerLine}`);
      const banner: Partial<Record<string, [string, string]>> = {
        'double-fault': ['DOUBLE FAULT', '#ff9a6a'],
        ace: ['ACE!', '#ffe066'],
        winner: ['WINNER!', '#ffe066'],
        error: ['ERROR', '#ff9a6a'],
      };
      const b = banner[step.outcome];
      const how: Partial<Record<string, string>> = {
        ace: shotLabel(step),
        winner: shotLabel(step),
        error:
          step.shot.wall === 'fence'
            ? `${step.shot.name} into the fence`
            : `${step.shot.name}: ${step.errorKind === 'glass' ? 'out, back glass' : step.errorKind === 'mesh' ? 'out, fence' : step.errorKind === 'side' ? 'out, side wall' : 'net'}`,
      };
      if (b) this.announce(b[0], b[1], how[step.outcome]);
      if (step.pointWinner === 0 && step.side === 0 && (step.outcome === 'ace' || step.outcome === 'winner')) this.countDailyWin(step);
      this.reactToPoint(step, coastMs);
      if (step.outcome === 'ace' || step.outcome === 'winner') {
        this.cameras.main.shake(140, 0.004);
        this.winFlash();
      }
      this.time.delayedCall(delay, () => this.endPoint(step.pointWinner as SideIndex));
    };

    switch (step.outcome) {
      case 'fault':
        if (this.practice) {
          this.say(`${headline}\nFAULT! (practice: back to the menu)`);
          this.announce('FAULT', '#ff9a6a');
          this.time.delayedCall(Math.max(POINT_PAUSE, Math.min(coastMs + 350, 2200)), () => this.practiceMenu());
          break;
        }
        this.say(`${headline}\nFAULT (${this.faultWhere(step)})! Second serve.`);
        this.announce('FAULT', '#ff9a6a', this.faultWhere(step));
        this.time.delayedCall(FAULT_PAUSE, () => this.backToServeSpots());
        break;
      case 'double-fault':
        endPoint('DOUBLE FAULT!');
        break;
      case 'ace':
        endPoint(step.late ? `${defender.name} did not decide in time and never touched it. ACE!` : 'ACE!');
        break;
      case 'in':
        if (this.practice && !this.isHuman(next.holder, next.hitterIdx)) {
          this.say(`${headline}\nIn play. (practice: back to the menu)`);
          if (this.practice === 'court') this.announce('IN PLAY', '#5db4ff');
          this.time.delayedCall(1300, () => this.practiceMenu());
          break;
        }
        this.say(headline);
        this.time.delayedCall(this.isHuman(next.holder, next.hitterIdx) ? NEXT_HIT_DELAY : CPU_NEXT_HIT_DELAY, () => this.hitTurn());
        break;
      case 'winner':
        endPoint(
          step.earlyError
            ? `${defender.name} goes for the Por Cuatro before the glass and fumbles it. Point!`
            : step.reboundBack
            ? `${attacker.name}: the ball comes off the glass and flies back over the net. Point!`
            : step.shot.overFence
            ? `${attacker.name} hits it out over the fence!`
            : `${attacker.name} wins the point with a winner!`,
        );
        break;
      case 'error':
        endPoint(
          step.shot.wall === 'fence'
            ? `${attacker.name} mishits the rulo straight into the fence. Error!`
            : step.forcedError
            ? `Under pressure, ${attacker.name} ${this.errorText(step)}. Forced error!`
            : `${attacker.name} ${this.errorText(step)}. Error!`,
        );
        break;
      case 'continue':
        if (this.practice && !this.isHuman(next.holder, next.hitterIdx)) {
          this.say(`${headline}\nIn play. (practice: back to the menu)`);
          if (this.practice === 'court') this.announce('IN PLAY', '#5db4ff');
          this.time.delayedCall(1300, () => this.practiceMenu());
          break;
        }
        this.say(headline);
        this.time.delayedCall(this.isHuman(next.holder, next.hitterIdx) ? NEXT_HIT_DELAY : CPU_NEXT_HIT_DELAY, () => this.hitTurn());
        break;
    }
  }

  /** Counts a point the hero's side won with a winner or an ace, by the kind of shot (for the daily tasks). */
  private countDailyWin(step: Step): void {
    const id = baseId(step.shot);
    const w = this.dailyWins;
    if (step.outcome === 'ace') w.ace++;
    else if (id === 'smash_x3' || id === 'smash_x4') w.smash++;
    else if (id === 'dejada') w.dejada++;
    else if (id === 'vibora' || id === 'bandeja') w.viboraBandeja++;
    else if (id.startsWith('bajada')) w.bajada++;
  }

  private endPoint(winner: SideIndex): void {
    if (this.practice) {
      this.practiceMenu();
      return;
    }
    this.guts = { ...this.point.guts };
    this.pointsWon[winner]++;
    this.longestRally = Math.max(this.longestRally, this.point.hits);
    const res = awardPoint(this.matchScore, winner);
    this.matchScore = res.score;

    // The pause after a game is a rest: double recovery (4 guts at stamina 5 instead of 2 after a point).
    const restMul = res.gameWon ? GAME_BREAK_RECOVERY_MUL : 1;
    for (const p of TEAMS.flat()) {
      this.guts[p.id] = recoverGuts(this.guts[p.id], gutsRecovery(p.stats.stamina) * restMul * (p.id === TEAMS[0][HUMAN_IDX].id ? 1 + this.recoveryPct : 1), p.maxGuts);
    }
    this.refreshScore();
    this.refreshGuts();
    sfx('point');
    this.clearMenu();
    this.crowdCheer(this.matchScore.winner !== null ? 'match' : res.gameWon ? 'game' : this.point.hits >= 8 ? 'rally' : 'point', winner === HUMAN_SIDE);

    if (this.matchScore.winner !== null) {
      this.celebrate(this.matchScore.winner, true);
      this.endMatch(this.matchScore.winner);
      return;
    }
    if (res.gameWon) {
      this.celebrate(winner, false);
      // The team that has just served hands the next service game of ITS side to its other player; the other team goes on with its own turn
      // (so in the first game of each team the first player serves: the hero in his pair).
      this.serverIdx[this.server] = 1 - this.serverIdx[this.server];
      this.server = other(this.server);
      this.say(`${this.lastSaid}\nGAME TO ${SIDE_NAME[winner]}!`);
      // the scene of the game (now and then); the pause after a game is kept either way
      const t0 = this.time.now;
      this.time.delayedCall(Math.min(GAME_PAUSE, 900), () =>
        playCutscene(this, winner === HUMAN_SIDE ? 'gameWon' : 'gameLost', this.cutCast(), () =>
          this.time.delayedCall(Math.max(250, GAME_PAUSE - (this.time.now - t0)), () => this.beginPoint()),
        ),
      );
    } else {
      this.time.delayedCall(POINT_PAUSE, () => this.beginPoint());
    }
  }

  private endMatch(winner: SideIndex, retired = false): void {
    if (this.over) return;
    this.over = true;
    this.clearMenu();
    this.setActive(null);
    // A match the hero retires from pays nothing (no XP and coins for giving up).
    const reward = retired ? { xp: 0, coins: 0 } : matchReward({ won: winner === 0, pointsWon: this.pointsWon[0], pointsLost: this.pointsWon[1], longestRally: this.longestRally });
    const levelBefore = levelOf(getSave().profile.xp);
    const out: { finished?: Finished; trophies: string[] } = { trophies: [] };
    // A quick match is a sparring: it changes nothing (no XP, coins, stats, records or achievements). Only career matches count.
    if (this.career) updateSave((d) => {
      const r = recordResult(d, winner === 0);
      // In a tournament the match pays nothing yet: the reward is kept and paid out with the prize when the tournament ends.
      const rep = reportMatch(r.profile, winner === 0, reward);
      const profile = rep.profile;
      out.finished = rep.finished;
      // Records and achievements (they count after the tournament result too).
      const records = recordMatch(r.records, {
        won: winner === 0,
        longestRally: this.longestRally,
        gamesLost: this.matchScore.games[1],
        aces: this.dailyWins.ace,
        smashes: this.dailyWins.smash,
        rankPoints: profile.career.rankPoints,
        position: out.finished ? positionOf(profile.career) : undefined,
      });
      const earned = newlyEarned(progressOf(r.stats, records, profile), r.achievements);
      const claimed = claim(profile, r.achievements, earned);
      out.trophies = earned.map((a) => `${a.name} +${a.coins}`);
      const facts = { won: winner === 0, points: this.pointsWon[0], longestRally: this.longestRally, ...this.dailyWins };
      const daily = addFacts(r.daily, dayKey(new Date()), facts);
      const weekly = addWeeklyFacts(r.weekly, weekKey(new Date()), facts);
      return { ...r, profile: claimed.profile, records, achievements: claimed.unlocked, daily, weekly };
    });
    const levelAfter = levelOf(getSave().profile.xp);
    this.time.delayedCall(500, () => sfx(winner === 0 ? 'win' : 'lose'));
    if (this.exitButton) for (const part of this.exitButton.parts) (part as Phaser.GameObjects.GameObject & { setVisible: (v: boolean) => unknown }).setVisible(false);
    this.say(retired ? 'YOU RETIRE: THE OPPONENTS WIN BY RETIREMENT' : winner === 0 ? 'YOU WIN THE MATCH!' : 'CPU WINS THE MATCH...');
    const games: [number, number] = [this.matchScore.games[0], this.matchScore.games[1]];
    // the end of the match (or of the tournament) has its scene before the result screen; not after a retirement
    const fin = out.finished;
    const occ: CutOccasion | null = retired ? null : fin ? tournamentEnd(fin.champion, fin.lostFinal) : winner === HUMAN_SIDE ? 'matchWon' : 'matchLost';
    const cupDef = fin?.cup ? CUPS.find((c) => c.id === fin.cup!.id) : undefined;
    const cast: CutCast = {
      ...this.cutCast(),
      ...(fin ? { event: fin.event } : {}),
      ...(fin?.cup ? { cup: { division: fin.cup.division, city: fin.cup.city, symbol: cupDef?.symbol ?? '', metal: fin.cup.kind } } : {}),
    };
    const toResult = (go: () => void): void => {
      if (occ) playCutscene(this, occ, cast, go);
      else go();
    };
    this.time.delayedCall(occ ? 1400 : 2200, () => toResult(() => this.scene.start('ResultScene', { winner, games, reward: this.career && !out.finished ? undefined : this.career ? reward : undefined, levelUp: levelAfter > levelBefore ? levelAfter : 0, packs: Math.max(0, levelAfter - levelBefore), career: this.career !== null, retired, rival: this.career?.opponents[0] ? { name: this.career.opponents[0].name, nick: this.career.opponents[0].nick, appearance: this.career.opponents[0].appearance } : undefined, trophies: out.trophies, finished: out.finished ? { event: out.finished.event, roundsWon: out.finished.roundsWon, champion: out.finished.champion, prize: out.finished.prize, matches: out.finished.matches, cup: out.finished.cup, cupBonuses: out.finished.cupBonuses } : undefined })));
  }

  /** Who and what the cutscenes of this match show: your pair, the opponents, the tournament and the round. */
  private cutCast(): CutCast {
    const hero = TEAMS[HUMAN_SIDE][HUMAN_IDX];
    const mate = TEAMS[HUMAN_SIDE][1 - HUMAN_IDX];
    return {
      hero: { name: hero.name, appearance: hero.appearance },
      partner: { name: mate.name, appearance: mate.appearance },
      opponents: TEAMS[1].map((p) => ({ name: p.name, appearance: p.appearance })),
      event: this.career?.event ?? this.career?.name,
      city: this.career?.city,
      round: this.career?.round,
    };
  }
}
