/**
 * Today's practice plan (PLAN.md milestone 4.1): the day's suggestions, kept so they can be
 * ticked off as they're practiced. A new plan is made on the first visit of each day; more
 * suggestions can be added once it's done.
 */
import { create } from 'zustand';
import { SKILLS, UNITS } from '../content/courses';
import { skillProgress } from '../content/skills';
import { SONG_IDS, SONG_UNITS } from '../content/songs';
import { type Suggestion, suggestPractice, targetKey } from '../content/suggestions';
import { openDrillLevels } from '../content/sightReading';
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

const KEY = 'today';

export const useTodayPlan = create<{ plan: TodayPlan | null }>(() => ({ plan: null }));

export async function loadTodayPlan(): Promise<void> {
  try {
    const row = await db.settings.get(KEY);
    useTodayPlan.setState({ plan: (row?.value as TodayPlan | undefined) ?? null });
  } catch (error) {
    console.error('Could not load today’s plan', error);
  }
}

function save(plan: TodayPlan): void {
  useTodayPlan.setState({ plan });
  db.settings.put({ key: KEY, value: plan }).catch((error: unknown) => {
    console.error('Could not save today’s plan', error);
  });
}

/** Suggestions from the progress saved so far. */
function suggestNow(now: number, exclude?: ReadonlySet<string>): Suggestion[] {
  const { results, log } = useProgress.getState();
  const lessonResult = (id: string) => results[resultKey(ResultKind.Lesson, id)];
  const unitIndex = new Map(UNITS.map((unit, index) => [unit.id, index]));
  const states = lessonStates(UNITS, (id) => lessonResult(id)?.bestStars ?? 0);
  return suggestPractice({
    units: UNITS,
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
    skills: skillProgress(
      SKILLS,
      UNITS,
      (id) => lessonResult(id)?.bestAccuracy ?? null,
      exerciseAccuracies(log),
    ),
    drillLevels: openDrillLevels(UNITS, states),
    now,
    exclude,
  });
}

/** Makes today's plan if there's none yet for today. */
export function ensureTodayPlan(now = Date.now()): void {
  if (useTodayPlan.getState().plan?.day === dayOf(now)) return;
  save({
    day: dayOf(now),
    items: suggestNow(now).map((suggestion) => ({ ...suggestion, since: now })),
  });
}

/** Adds new suggestions to today's plan, none already in it; false if there's nothing new. */
export function suggestMore(now = Date.now()): boolean {
  const plan = useTodayPlan.getState().plan;
  const current = plan?.day === dayOf(now) ? plan.items : [];
  const more = suggestNow(now, new Set(current.map((item) => targetKey(item.target))));
  if (more.length === 0) return false;
  save({
    day: dayOf(now),
    items: [...current, ...more.map((suggestion) => ({ ...suggestion, since: now }))],
  });
  return true;
}

/** Ticks the plan's items for this lesson or song, practiced without finishing a run. */
export function markPracticed(key: string): void {
  const plan = useTodayPlan.getState().plan;
  if (!plan?.items.some((item) => targetKey(item.target) === key && !item.practiced)) return;
  save({
    ...plan,
    items: plan.items.map((item) =>
      targetKey(item.target) === key ? { ...item, practiced: true } : item,
    ),
  });
}

/** Done: played since it was suggested, or practiced. */
export function isDone(item: PlanItem, results: Readonly<Record<string, ResultRow>>): boolean {
  return (
    item.practiced === true || (results[targetKey(item.target)]?.lastPlayedAt ?? 0) >= item.since
  );
}
