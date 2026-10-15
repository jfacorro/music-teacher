/**
 * Helpers for constant objects such as `PracticeMode = { Wait: 'wait', Tempo: 'tempo' } as const`
 * (the project's enums: erasable TypeScript, plain strings at run time).
 */

type Constants = Readonly<Record<string, string>>;

/** Every value of a constant object, in declaration order. */
export function valuesOf<T extends Constants>(constants: T): T[keyof T][] {
  return Object.values(constants) as T[keyof T][];
}

/** Whether `value` (e.g. read from JSON) is one of the constant object's values. */
export function isValueOf<T extends Constants>(constants: T, value: unknown): value is T[keyof T] {
  return typeof value === 'string' && Object.values(constants).includes(value);
}

/** The values for an error message: `"wait" or "tempo"`, `"a", "b" or "c"`. */
export function describeValues(constants: Constants): string {
  const quoted = Object.values(constants).map((value) => `"${value}"`);
  return quoted.length < 2
    ? (quoted[0] ?? '')
    : `${quoted.slice(0, -1).join(', ')} or ${quoted.at(-1)}`;
}
