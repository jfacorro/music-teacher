/**
 * Today's practice plan (PLAN.md milestone 4.1): the day's suggestions, kept so they can be
 * ticked off as they're practiced. A new plan is made on the first visit of each day; more
 * suggestions can be added once it's done. Each course has its own.
 */
import { create } from 'zustand';
import { Course, COURSE_UNITS, UNITS } from '../content/courses';
import { courseSkills, skillProgress } from '../content/skills';
import { SONG_IDS, SONG_UNITS } from '../content/songs';
import { type Suggestion, suggestPractice, targetKey } from '../content/suggestions';
import { openEarLevels } from '../content/earTraining';
import { openVoiceEarLevels } from '../content/voiceEar';
import { openDrillLevels } from '../content/sightReading';
import { openSingDrillLevels } from '../content/sightSinging';
import { lessonStates } from '../content/unlock';
import { dayOf, db, type ResultRow } from './db';
import { useMySongs } from './mySongs';
import { exerciseAccuracies, resultKey, ResultKind, useProgress } from './progress';

export interface PlanItem extends Suggestion {
  /** When it was suggested: playing it from then on ticks it. */
  since: number;
  /** Practiced without finishing a run (e.g. three times through a weak spot). */
  practiced?: boolean;
}

export interface TodayPlan {
  /** Local day, e.g. "2026-10-16". */
  day: string;
  items: PlanItem[];
}

/** Where each course's plan is saved (the piano's kept its first name). */
const KEYS: Readonly<Record<Course, string>> = {
  [Course.Piano]: 'today',
  [Course.Voice]: 'today:voice',
};

export const useTodayPlan = create<{ plans: Partial<Record<Course, TodayPlan>> }>(() => ({
  plans: {},
}));

export async function loadTodayPlan(): Promise<void> {
  try {
    const courses = Object.values(Course);
    const rows = await db.settings.bulkGet(courses.map((course) => KEYS[course]));
    const plans: Partial<Record<Course, TodayPlan>> = {};
    courses.forEach((course, i) => {
      const plan = rows[i]?.value as TodayPlan | undefined;
      if (plan) plans[course] = plan;
    });
    useTodayPlan.setState({ plans });
  } catch (error) {
    console.error('Could not load today’s plan', error);
  }
}

function save(course: Course, plan: TodayPlan): void {
  useTodayPlan.setState((state) => ({ plans: { ...state.plans, [course]: plan } }));
  db.settings.put({ key: KEYS[course], value: plan }).catch((error: unknown) => {
    console.error('Could not save today’s plan', error);
  });
}

/** Suggestions for a course from the progress saved so far. */
function suggestNow(course: Course, now: number, exclude?: ReadonlySet<string>): Suggestion[] {
  const { results, log } = useProgress.getState();
  const lessonResult = (id: string) => results[resultKey(ResultKind.Lesson, id)];
  const units = COURSE_UNITS[course];
  const states = lessonStates(units, (id) => lessonResult(id)?.bestStars ?? 0);
  const skills = skillProgress(
    courseSkills(course),
    units,
    (id) => lessonResult(id)?.bestAccuracy ?? null,
    exerciseAccuracies(log),
  );
  // The voice has its lessons, sight-singing and ear training, for now: the songs are the piano's.
  if (course === Course.Voice) {
    return suggestPractice({
      units,
      states,
      results,
      songs: [],
      skills,
      drillLevels: openSingDrillLevels(units, states),
      drillKind: ResultKind.VoiceDrill,
      earLevels: openVoiceEarLevels(units, states),
      earKind: ResultKind.VoiceEar,
      now,
      exclude,
    });
  }
  const unitIndex = new Map(UNITS.map((unit, index) => [unit.id, index]));
  return suggestPractice({
    units,
    states,
    results,
    songs: [
      ...SONG_IDS.map((id) => ({
        target: { kind: ResultKind.Song, id },
        unit: unitIndex.get(SONG_UNITS[id]) ?? 0,
      })),
      ...useMySongs.getState().songs.map((song) => ({
        target: { kind: ResultKind.MySong, id: String(song.id) },
        unit: null,
      })),
    ],
    skills,
    drillLevels: openDrillLevels(units, states),
    earLevels: openEarLevels(units, states),
    now,
    exclude,
  });
}

/** Makes today's plan for a course if there's none yet for today. */
export function ensureTodayPlan(course: Course, now = Date.now()): void {
  if (useTodayPlan.getState().plans[course]?.day === dayOf(now)) return;
  save(course, {
    day: dayOf(now),
    items: suggestNow(course, now).map((suggestion) => ({ ...suggestion, since: now })),
  });
}

/** Adds new suggestions to today's plan, none already in it; false if there's nothing new. */
export function suggestMore(course: Course, now = Date.now()): boolean {
  const plan = useTodayPlan.getState().plans[course];
  const current = plan?.day === dayOf(now) ? plan.items : [];
  const more = suggestNow(course, now, new Set(current.map((item) => targetKey(item.target))));
  if (more.length === 0) return false;
  save(course, {
    day: dayOf(now),
    items: [...current, ...more.map((suggestion) => ({ ...suggestion, since: now }))],
  });
  return true;
}

/** Ticks the plans' items for this lesson or song, practiced without finishing a run. */
export function markPracticed(key: string): void {
  const { plans } = useTodayPlan.getState();
  for (const course of Object.values(Course)) {
    const plan = plans[course];
    if (!plan?.items.some((item) => targetKey(item.target) === key && !item.practiced)) continue;
    save(course, {
      ...plan,
      items: plan.items.map((item) =>
        targetKey(item.target) === key ? { ...item, practiced: true } : item,
      ),
    });
  }
}

/** Done: played since it was suggested, or practiced. */
export function isDone(item: PlanItem, results: Readonly<Record<string, ResultRow>>): boolean {
  return (
    item.practiced === true || (results[targetKey(item.target)]?.lastPlayedAt ?? 0) >= item.since
  );
}
