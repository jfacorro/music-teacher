/** How the keyboard and the falling notes are drawn. */

/** played: right in time · missed: never played · muted: not graded (other hand). */
export const NoteStyle = {
  Played: 'played',
  Missed: 'missed',
  Muted: 'muted',
} as const;
export type NoteStyle = (typeof NoteStyle)[keyof typeof NoteStyle];

/** Which keys show their note name. */
export const KeyLabels = {
  None: 'none',
  C: 'c',
  White: 'white',
} as const;
export type KeyLabels = (typeof KeyLabels)[keyof typeof KeyLabels];
