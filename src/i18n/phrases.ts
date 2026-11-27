// Sentences the match commentary builds from parts (player names, shot names, directions). Each line has one pattern
// (English) and a Spanish template; `{1}`, `{2}` are the captured parts, which are translated again (a shot name or a direction
// is looked up, a player name stays). Patterns match one line (the caller splits at line breaks).

export const PHRASES: Array<[RegExp, string]> = [
  // coin toss
  [/^(HEADS|TAILS)! You win the toss and serve first\.$/, '¡{1}! Ganas el sorteo y sacas primero.'],
  [/^(HEADS|TAILS)! (.+) wins the toss and serves first\.$/, '¡{1}! {2} gana el sorteo y saca primero.'],
  [/^(.+) SERVES FIRST$/, '{1} SACA PRIMERO'],
  [/^(HEADS|TAILS): you called it$/, '{1}: acertaste'],
  [/^(HEADS|TAILS): wrong call$/, '{1}: fallaste'],
  [/^STAR POINT: (.+) will receive\.$/, 'PUNTO DE ESTRELLA: {1} restará.'],
  // the shot that is played
  [/^([^:\n]+): serve( \(2nd serve\))?$/, '{1}: saque{2}'],
  [/^([^:\n]+): (.+), which corner\?$/, '{1}: {2}, ¿a qué esquina?'],
  [/^([^:\n]+): (.+), which way\?$/, '{1}: {2}, ¿hacia dónde?'],
  [/^([^:\n]+): (.+) (parallel|middle|cross)! \(risky\)$/, '{1}: {2} {3}! (arriesgado)'],
  [/^([^:\n]+): (.+) (parallel|middle|cross)!$/, '{1}: {2} {3}!'],
  [/^([^:\n]+): (.+)! \(risky\)$/, '{1}: {2}! (arriesgado)'],
  [/^([^:\n]+): (.+)!$/, '{1}: {2}!'],
  [/^(\S+) gets the (.+) back$/, '{1} recupera la pelota ({2})'],
  [/^(\S+) reads the (.+) and gets it back!$/, '¡{1} lee el golpe ({2}) y la devuelve!'],
  // run out
  [/^(\S+) runs out after it!$/, '¡{1} sale tras ella!'],
  [/^(\S+) gets there but the ball does not find the door!$/, '¡{1} llega, pero la pelota no encuentra la puerta!'],
  [/^(\S+) gets there but cannot play it back: TOO FAR!$/, '¡{1} llega, pero no puede devolverla: DEMASIADO LEJOS!'],
  [/^(\S+) plays it flat through the door! The rally goes on, under heavy pressure\.$/, '¡{1} la juega plana por la puerta! El punto sigue, bajo mucha presión.'],
  [/^(\S+) gets it back from outside the court! The rally goes on\.$/, '¡{1} la devuelve desde fuera de la pista! El punto sigue.'],
  [/^(\S+) fires it through the door$/, '{1} la manda por la puerta'],
  [/^(\S+) gets it back$/, '{1} la devuelve'],
  [/^flat · (wide|narrow) angle$/, 'plano · ángulo {1}'],
  // how a point ends
  [/^(.*) {2}> {2}POINT TO (.+)$/, '{1}  >  PUNTO PARA {2}'],
  [/^(\S+) did not decide in time and never touched it\. ACE!$/, '{1} no decidió a tiempo y ni la tocó. ¡ACE!'],
  [/^(\S+) goes for the Por Cuatro before the glass and fumbles it\. Point!$/, '{1} va a por el Por Cuatro antes del cristal y falla. ¡Punto!'],
  [/^(\S+): the ball comes off the glass and flies back over the net\. Point!$/, '{1}: la pelota sale del cristal y vuelve sobre la red. ¡Punto!'],
  [/^(\S+) hits it out over the fence!$/, '¡{1} la manda fuera por encima de la reja!'],
  [/^(\S+) wins the point with a winner!$/, '¡{1} gana el punto con un golpe ganador!'],
  [/^(\S+) mishits the rulo straight into the fence\. Error!$/, '{1} falla el rulo y da directo en la reja. ¡Error!'],
  [/^Under pressure, (\S+) (.+)\. Forced error!$/, 'Bajo presión, {1} {2}. ¡Error forzado!'],
  [/^(\S+) (sends it .+|hits the .+|bounces .+)\. Error!$/, '{1} {2}. ¡Error!'],
  [/^FAULT \((.+)\)! Second serve\.$/, '¡FALTA ({1})! Segundo saque.'],
  [/^(\S+): (sends it .+|hits the .+|bounces .+|net)$/, '{1}: {2}'],
  [/^GAME TO (.+)!$/, '¡JUEGO PARA {1}!'],
  // practice and labels
  [/^WINNERS (\d+) {2}IN PLAY (\d+) {2}ERRORS (\d+)$/, 'GANADORES {1}  EN JUEGO {2}  ERRORES {3}'],
  [/^GOT IT BACK (\d+) {2}TOO FAR (\d+)$/, 'DEVUELTAS {1}  DEMASIADO LEJOS {2}'],
  [/^SPECIAL \[(\d+)\]( RISKY)?$/, 'ESPECIAL [{1}]{2}'],
  [/^\[(\d+)\]( RISKY)?$/, '[{1}]{2}'],
  [/^\[(left|right) side\]$/, '[lado {1}]'],
  [/^-> (.+)$/, '-> {1}'],
  [/^PRACTICE · (.+)$/, 'PRÁCTICA · {1}'],
  [/^(.+) \[(\d+)\]( RISKY)?$/, '{1} [{2}]{3}'],
];

const MAX_DEPTH = 3;

/** The Spanish version of one line built from parts, or undefined when no pattern fits. `tr` translates a captured part (or leaves it). */
export function phrase(line: string, tr: (part: string, depth: number) => string, depth = 0): string | undefined {
  if (depth >= MAX_DEPTH) return undefined;
  for (const [re, template] of PHRASES) {
    const m = re.exec(line);
    if (!m) continue;
    return template.replace(/\{(\d+)\}/g, (_x, i: string) => {
      const part = m[Number(i)];
      return part === undefined ? '' : tr(part, depth + 1);
    });
  }
  return undefined;
}
