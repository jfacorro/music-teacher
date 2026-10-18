/**
 * Whether exercises start with the metronome on (Settings → Sound and timing): as each one
 * usually does (a lesson's choice, or on when playing along), always, or never. The checkbox on
 * each exercise still switches it for the moment.
 */
export const MetronomeChoice = {
  Auto: 'auto',
  On: 'on',
  Off: 'off',
} as const;
export type MetronomeChoice = (typeof MetronomeChoice)[keyof typeof MetronomeChoice];

export const METRONOME_CHOICES: readonly MetronomeChoice[] = Object.values(MetronomeChoice);

/** The metronome at the start of an exercise whose usual choice is `usual`. */
export function metronomeAtStart(choice: MetronomeChoice, usual: boolean): boolean {
  return choice === MetronomeChoice.Auto ? usual : choice === MetronomeChoice.On;
}
