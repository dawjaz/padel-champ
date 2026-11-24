import Phaser from 'phaser';
import { WIDTH } from '../config';
import { HERO_DEFAULTS } from '../career/profile';
import { cleanName, MAX_NAME, MAX_NICK } from '../game/names';
import { getSave, updateSave } from '../save';
import { applyLightScreen, drawCard, makeThemeButton, screenHeader, TC, themeText } from '../theme';

type Field = 'name' | 'nick';

const ROWS = ['1234567890', 'QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

/** Edit the hero's name and nickname with an on-screen keyboard (a physical keyboard works too). */
export class NameEditScene extends Phaser.Scene {
  private back = 'CharacterScene';
  private values: Record<Field, string> = { name: '', nick: '' };
  private active: Field = 'name';
  private texts!: Record<Field, Phaser.GameObjects.Text>;
  private frames!: Record<Field, Phaser.GameObjects.Graphics>;
  private cursorOn = true;
  /** The first key typed in a field replaces the old text (the whole field counts as selected). */
  private fresh: Record<Field, boolean> = { name: true, nick: true };

  constructor() {
    super('NameEditScene');
  }

  init(data: { back?: string }): void {
    this.back = data.back ?? 'CharacterScene';
    const p = getSave().profile;
    this.values = { name: p.name, nick: p.nick };
    this.active = 'name';
    this.fresh = { name: true, nick: true };
  }

  create(): void {
    applyLightScreen(this);
    screenHeader(this, 'Name', { onBack: () => this.scene.start(this.back) });
    this.texts = {} as Record<Field, Phaser.GameObjects.Text>;
    this.frames = {} as Record<Field, Phaser.GameObjects.Graphics>;
    const fields: [Field, string, number][] = [['name', 'NAME', 76], ['nick', 'NICKNAME', 140]];
    for (const [f, label, y] of fields) {
      this.frames[f] = this.add.graphics().setPosition(30, y);
      themeText(this, 44, y + 12, label, { size: 11, color: TC.sub, origin: [0, 0.5] });
      this.texts[f] = themeText(this, WIDTH / 2, y + 38, '', { size: 24, font: 'display' });
      const z = this.add.zone(WIDTH / 2, y + 30, 300, 60).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => {
        this.active = f;
        this.fresh[f] = true;
        this.refresh();
      });
    }

    // Keyboard.
    const keyW = 32;
    const gap = 3;
    const press = (ch: string): void => this.type(ch);
    ROWS.forEach((row, r) => {
      const n = row.length + (r === 3 ? 2 : 0);
      const x0 = WIDTH / 2 - (n * keyW + (n - 1) * gap) / 2 + keyW / 2;
      const y = 252 + r * 46;
      [...row].forEach((ch, i) => makeThemeButton(this, x0 + i * (keyW + gap), y, keyW, 40, ch, () => press(ch), 'secondary', 16));
      if (r === 3) makeThemeButton(this, x0 + row.length * (keyW + gap) + (keyW + gap) / 2, y, keyW * 2 + gap, 40, 'DEL', () => this.type('BACK'), 'blue', 13);
    });
    const y4 = 252 + 4 * 46;
    makeThemeButton(this, 62, y4, 62, 40, "'", () => press("'"), 'secondary', 16);
    makeThemeButton(this, 128, y4, 62, 40, '-', () => press('-'), 'secondary', 16);
    makeThemeButton(this, 258, y4, 190, 40, 'SPACE', () => press(' '), 'secondary', 14);

    makeThemeButton(this, WIDTH / 2, 520, 250, 50, 'SAVE', () => this.save(), 'primary', 22);
    makeThemeButton(this, WIDTH / 2, 580, 250, 40, 'CANCEL', () => this.scene.start(this.back), 'secondary', 16);

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Backspace') this.type('BACK');
      else if (e.key === 'Enter') (this.active === 'name' ? ((this.active = 'nick'), this.refresh()) : this.save());
      else if (e.key === 'Tab') {
        e.preventDefault();
        this.active = this.active === 'name' ? 'nick' : 'name';
        this.refresh();
      } else if (e.key.length === 1) this.type(e.key.toUpperCase());
    });
    this.time.addEvent({ delay: 450, loop: true, callback: () => { this.cursorOn = !this.cursorOn; this.refresh(); } });
    this.refresh();
  }

  private type(ch: string): void {
    const f = this.active;
    const max = f === 'name' ? MAX_NAME : MAX_NICK;
    let v = this.values[f];
    if (this.fresh[f]) {
      v = '';
      this.fresh[f] = false;
    }
    if (ch === 'BACK') v = v.slice(0, -1);
    else if (/^[A-Za-z0-9 '-]$/.test(ch) && v.length < max && !(ch === ' ' && (v === '' || v.endsWith(' ')))) v += ch;
    this.values[f] = v;
    this.cursorOn = true;
    this.refresh();
  }

  private refresh(): void {
    for (const f of ['name', 'nick'] as Field[]) {
      const on = f === this.active;
      const g = this.frames[f];
      g.clear();
      drawCard(g, 300, 60, { radius: 14, shadow: 3, stroke: on ? TC.orange : TC.navy });
      this.texts[f].setText(this.values[f].toUpperCase() + (on && this.cursorOn && !this.fresh[f] ? '|' : ' ')).setColor(on && this.fresh[f] ? '#d93f00' : '#0b2a5b');
    }
  }

  private save(): void {
    updateSave((d) => {
      const def = HERO_DEFAULTS[d.profile.gender];
      const name = cleanName(this.values.name, MAX_NAME, def.name);
      const nick = cleanName(this.values.nick, MAX_NICK, def.nick);
      return { ...d, profile: { ...d.profile, name, nick } };
    });
    this.scene.start(this.back);
  }
}
