import { ScoreView } from '../content/lessons';

/**
 * How exercises show the music at the start (Settings → Appearance): as each one usually does (a
 * lesson's choice, or falling notes for a song), or always falling notes or sheet music. The
 * toggle on each exercise still switches it for the moment.
 */
export const ViewChoice = {
  Auto: 'auto',
  Falling: ScoreView.Falling,
  Sheet: ScoreView.Sheet,
} as const;
export type ViewChoice = (typeof ViewChoice)[keyof typeof ViewChoice];

export const VIEW_CHOICES: readonly ViewChoice[] = Object.values(ViewChoice);

/** The view at the start of an exercise whose usual view is `usual`. */
export function viewAtStart(choice: ViewChoice, usual: ScoreView): ScoreView {
  return choice === ViewChoice.Auto ? usual : choice;
}
