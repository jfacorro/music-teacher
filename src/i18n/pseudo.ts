/**
 * Pseudo-localization: accents every letter of translatable text and pads it by ~40%, so
 * hard-coded strings stand out and layouts get tested against longer languages.
 *
 * ICU-aware without a full parser: in ICU MessageFormat, literal text sits at even brace
 * depths (0, 2, 4…) and argument syntax at odd depths, e.g.
 *   "You have {count, plural, one {# star} other {# stars}}"
 *    ^ depth 0  ^ depth 1 (kept)  ^ depth 2 (accented)
 */

const ACCENTED: Record<string, string> = {
  a: 'á', b: 'ƀ', c: 'ç', d: 'ð', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'í', j: 'ĵ', k: 'ķ',
  l: 'ļ', m: 'ɱ', n: 'ñ', o: 'ó', p: 'þ', q: 'ǫ', r: 'ŕ', s: 'š', t: 'ţ', u: 'ú', v: 'ṽ',
  w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž',
  A: 'Á', B: 'Ɓ', C: 'Ç', D: 'Ð', E: 'É', F: 'Ƒ', G: 'Ĝ', H: 'Ĥ', I: 'Í', J: 'Ĵ', K: 'Ķ',
  L: 'Ļ', M: 'Ṁ', N: 'Ñ', O: 'Ó', P: 'Þ', Q: 'Ǫ', R: 'Ŕ', S: 'Š', T: 'Ţ', U: 'Ú', V: 'Ṽ',
  W: 'Ŵ', X: 'Ẋ', Y: 'Ý', Z: 'Ž',
}; // prettier-ignore

const EXPANSION = 0.4;

export function pseudoLocalize(message: string): string {
  let depth = 0;
  let letters = 0;
  let out = '';
  for (const ch of message) {
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    const accented = depth % 2 === 0 ? ACCENTED[ch] : undefined;
    if (accented) {
      letters++;
      out += accented;
    } else {
      out += ch;
    }
  }
  const padding = '~'.repeat(Math.ceil(letters * EXPANSION));
  return `[${out}${padding && ` ${padding}`}]`;
}

export type Resource = { [key: string]: string | Resource };

export function pseudoLocalizeResource(resource: Resource): Resource {
  return Object.fromEntries(
    Object.entries(resource).map(([key, value]) => [
      key,
      typeof value === 'string' ? pseudoLocalize(value) : pseudoLocalizeResource(value),
    ]),
  );
}
