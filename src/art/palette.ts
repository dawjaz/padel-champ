/** Parses "#rrggbb" (or "rrggbb") into 0xRRGGBB. Throws on bad input so typos in data files are caught early. */
export function hex(value: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  if (!m) throw new Error(`Bad colour: "${value}"`);
  return parseInt(m[1], 16);
}

/** Multiplies each channel by `factor` (<1 darker, >1 lighter), clamped to 0..255. */
export function shade(color: number, factor: number): number {
  const ch = (shift: number): number => Math.max(0, Math.min(255, Math.round(((color >> shift) & 0xff) * factor)));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
