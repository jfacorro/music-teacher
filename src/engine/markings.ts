/**
 * Italian score markings (PLAN.md §2.6): tempo words and dynamics. They're written the same in
 * every language (only their explanations are translated, in theory.json › markings).
 */

export const TEMPO_MARKINGS = ['adagio', 'andante', 'moderato', 'allegretto', 'allegro'] as const;
export const DYNAMIC_MARKINGS = ['pp', 'p', 'mp', 'mf', 'f', 'ff'] as const;

export type Marking = (typeof TEMPO_MARKINGS)[number] | (typeof DYNAMIC_MARKINGS)[number];

const ALL: readonly string[] = [...TEMPO_MARKINGS, ...DYNAMIC_MARKINGS];

export function isMarking(value: unknown): value is Marking {
  return typeof value === 'string' && ALL.includes(value);
}

export function isDynamic(marking: Marking): boolean {
  return (DYNAMIC_MARKINGS as readonly string[]).includes(marking);
}

/** As printed in a score: "Moderato", "mf". */
export function markingText(marking: Marking): string {
  return isDynamic(marking) ? marking : marking[0]!.toUpperCase() + marking.slice(1);
}
