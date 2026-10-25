import { SheetNotation, SING_NOTATIONS } from '../../../content/lessons';
import { NamingSystem } from '../../../i18n/naming';

/**
 * The sheet music levels a singer can choose (PLAN.md milestone 6.5). Do, re, mi from the key
 * note (movable do) only with letter note names: with solfège note names, do is C, so the notes
 * keep their own names.
 */
export function singNotations(system: NamingSystem): readonly SheetNotation[] {
  return system === NamingSystem.Solfege
    ? SING_NOTATIONS.filter((notation) => notation !== SheetNotation.Syllables)
    : SING_NOTATIONS;
}

/**
 * The level to start with: the one asked for (a lesson step's), else do, re, mi with letter note
 * names and the note names with solfège ones, so the learner needn't choose. Do, re, mi asked for
 * with solfège note names shows the note names.
 */
export function startNotation(system: NamingSystem, asked: SheetNotation | null): SheetNotation {
  const options = singNotations(system);
  if (asked && options.includes(asked)) return asked;
  return asked === SheetNotation.Syllables ? SheetNotation.Names : options[0]!;
}
