import Phaser from 'phaser';
import { getLang, show } from './i18n';

/**
 * Every text the game puts on the screen goes through `T` (Spanish mode only), also the ones set with `setText` or created with
 * `add.text` without a call to `T` in the scene (the match commentary, button labels, chips). English is returned unchanged.
 */
const proto = Phaser.GameObjects.Text.prototype;
const original = proto.setText;
proto.setText = function (this: Phaser.GameObjects.Text, value: string | string[]): Phaser.GameObjects.Text {
  if (getLang() !== 'es') return original.call(this, value);
  return original.call(this, Array.isArray(value) ? value.map((v) => show(v)) : show(String(value)));
};
