/**
 * Links between the courses (PLAN.md milestone 7.2). Theory lessons name the lessons they build
 * on and what to try next, in `theoryCourse.json`, so the piano and voice course files don't
 * change; the links back are worked out from that. Only what's open is ever offered, and from
 * a course you've started: the voice's units are all open from the first day.
 */
import { isValueOf } from '../lib/values';
import { Course, COURSE_UNITS, type CourseLesson, findLesson, THEORY_UNITS } from './courses';
import { EarLevel, openEarLevels } from './earTraining';
import { isSongId, SONG_UNITS, type SongId, VOICE_SONG_IDS, VOICE_SONGS_UNIT } from './songs';
import { isUnitOpen, type LessonState, lessonStates, LessonStatus } from './unlock';
import { openVoiceEarLevels } from './voiceEar';

/** The courses that have songs and ear training: where Theory's suggestions lead. */
export type PracticeCourse = typeof Course.Piano | typeof Course.Voice;

/** Every course's lessons, open or not. */
export type CourseStates = Readonly<Record<Course, ReadonlyMap<string, LessonState>>>;

export const courseStates = (starsOf: (lessonId: string) => number): CourseStates => ({
  [Course.Piano]: lessonStates(COURSE_UNITS[Course.Piano], starsOf),
  [Course.Voice]: lessonStates(COURSE_UNITS[Course.Voice], starsOf),
  [Course.Theory]: lessonStates(COURSE_UNITS[Course.Theory], starsOf),
});

/**
 * The theory lesson that explains a piano or voice lesson, if one is open: the first not done
 * yet, or the first one.
 */
export function whyLesson(lessonId: string, states: CourseStates): string | null {
  const theory = states[Course.Theory];
  const open = THEORY_UNITS.flatMap((unit) => unit.lessons)
    .filter(
      ({ id, builds }) =>
        builds.includes(lessonId) && theory.get(id)?.status !== LessonStatus.Locked,
    )
    .map(({ id }) => id);
  return open.find((id) => theory.get(id)?.status !== LessonStatus.Completed) ?? open[0] ?? null;
}

export const TryKind = {
  Lesson: 'lesson',
  Song: 'song',
  Ear: 'ear',
} as const;
export type TryKind = (typeof TryKind)[keyof typeof TryKind];

export type TryItem =
  | { kind: typeof TryKind.Lesson; id: string }
  | { kind: typeof TryKind.Song; id: SongId; course: PracticeCourse }
  | { kind: typeof TryKind.Ear; id: EarLevel; course: PracticeCourse };

const isStarted = (course: Course, states: CourseStates) =>
  [...states[course].values()].some(({ status }) => status === LessonStatus.Completed);

/** A song is open once its unit is; the voice's, once it has started singing them. */
function isSongOpen(id: SongId, course: PracticeCourse, states: CourseStates): boolean {
  const units = COURSE_UNITS[course];
  if (course === Course.Voice) {
    return (
      VOICE_SONG_IDS.includes(id) &&
      (units
        .find((unit) => unit.id === VOICE_SONGS_UNIT)
        ?.lessons.some(
          (lesson) => states[course].get(lesson.id)?.status === LessonStatus.Completed,
        ) ??
        false)
    );
  }
  const unit = units.find(({ id: unitId }) => unitId === SONG_UNITS[id]);
  return unit !== undefined && isStarted(course, states) && isUnitOpen(unit, states[course]);
}

function isEarOpen(level: EarLevel, course: PracticeCourse, states: CourseStates): boolean {
  const open = course === Course.Voice ? openVoiceEarLevels : openEarLevels;
  return open(COURSE_UNITS[course], states[course]).includes(level);
}

/**
 * What a theory lesson offers once finished: the lessons it builds on, in either course, then
 * its song and ear training level in `course`, the one you practice in. Only what's open.
 */
export function tryItems(
  { builds, tryIt: { song, ear } }: CourseLesson,
  course: PracticeCourse,
  states: CourseStates,
): TryItem[] {
  const open = (id: string) => {
    const found = findLesson(id);
    return (
      found !== null &&
      isStarted(found.course, states) &&
      states[found.course].get(id)?.status !== LessonStatus.Locked
    );
  };
  return [
    ...builds.filter(open).map((id) => ({ kind: TryKind.Lesson, id })),
    ...(song !== null && isSongId(song) && isSongOpen(song, course, states)
      ? [{ kind: TryKind.Song, id: song, course }]
      : []),
    ...(isValueOf(EarLevel, ear) && isEarOpen(ear, course, states)
      ? [{ kind: TryKind.Ear, id: ear, course }]
      : []),
  ];
}
