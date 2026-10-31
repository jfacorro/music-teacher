import { parseLesson, type Lesson } from './lesson';

// One chunk per lesson, loaded when the lesson opens.
const loaders = import.meta.glob<unknown>('./*.json', { import: 'default' });

export function lessonExists(id: string): boolean {
  return `./${id}.json` in loaders;
}

/** Loads and validates a lesson; throws `LessonError` with the location of any problem. */
export async function loadLesson(id: string): Promise<Lesson> {
  const loader = loaders[`./${id}.json`];
  if (!loader) throw new Error(`Unknown lesson "${id}"`);
  return parseLesson(id, await loader());
}

/** i18next namespace with the lesson's text (`locales/<lang>/lessons/<id>.json`). */
export function lessonNamespace(id: string): string {
  return `lessons/${id}`;
}

export type {
  Lesson,
  LessonStep,
  ExplainStep,
  StaffNotes,
  FindStep,
  ExerciseStep,
  QuizStep,
  RhythmStep,
  WarmUpStep,
  MatchStep,
  SingStep,
  QuestionStep,
  BuildStep,
} from './lesson';
export {
  isGraded,
  SHEET_NOTATIONS,
  SING_NOTATIONS,
  QuizClef,
  ScoreView,
  SheetNotation,
  StaffClef,
  StepType,
} from './lesson';
