/**
 * Today's practice (PLAN.md milestone 4.1): a short session picked from where the learner is —
 * the next lesson, a lesson due for review, a weak spot to loop, a song not played for a while,
 * a sight-reading drill now and then (milestone 4.3), and a lesson for the weakest skill.
 *
 * Only what the learner has reached is suggested: never a locked lesson, a song above their
 * level, or a skill they haven't started; reviews and weak spots come from what they've played.
 */
import type { LoopRange } from '../engine/session';
import type { ResultRow } from '../storage/db';
import { resultKey, ResultKind } from '../storage/progress';
import type { Skill, Unit } from './courses';
import { DAY_MS, reviewOf } from './review';
import type { DrillLevel } from './sightReading';
import { type SkillProgress, SkillLevel } from './skills';
import { STAR_THRESHOLDS } from '../engine/scoring';
import { isUnitOpen, type LessonState, LessonStatus, nextLessonToPlay } from './unlock';

export const SuggestionKind = {
  Next: 'next',
  Review: 'review',
  WeakSpot: 'weakSpot',
  Song: 'song',
  Drill: 'drill',
  Skill: 'skill',
} as const;
export type SuggestionKind = (typeof SuggestionKind)[keyof typeof SuggestionKind];

/** A lesson, a song, an imported song or a drill level, as its results are saved. */
export interface PracticeTarget {
  kind: ResultKind;
  id: string;
}

export interface Suggestion {
  kind: SuggestionKind;
  target: PracticeTarget;
  /** Weak spot: the bars to repeat. */
  bars?: LoopRange;
  /** Skill: the one to strengthen. */
  skill?: Skill;
  /** Review, weak spot, song and drill: when it was last played (ms), if ever. */
  lastPlayedAt?: number;
}

export interface SongChoice {
  target: PracticeTarget;
  /** Index of the unit it belongs to; null for the learner's own songs (any level). */
  unit: number | null;
}

export interface PracticeInput {
  units: readonly Unit[];
  states: ReadonlyMap<string, LessonState>;
  results: Readonly<Record<string, ResultRow>>;
  songs: readonly SongChoice[];
  skills: readonly SkillProgress[];
  /** Sight-reading levels open, easiest first. */
  drillLevels: readonly DrillLevel[];
  now: number;
  /** Targets not to suggest again (by result key), e.g. already in today's plan. */
  exclude?: ReadonlySet<string>;
}

export const MAX_SUGGESTIONS = 5;
/** A weak spot older than this is stale: the learner has moved on. */
export const WEAK_SPOT_DAYS = 14;
/** A song played more recently than this isn't "not played for a while". */
export const SONG_REST_DAYS = 3;
/** A drill is suggested when none was played for this long. */
export const DRILL_REST_DAYS = 2;
const THREE_STARS = STAR_THRESHOLDS[2];

export const targetKey = (target: PracticeTarget) => resultKey(target.kind, target.id);
const lesson = (id: string): PracticeTarget => ({ kind: ResultKind.Lesson, id });

export function suggestPractice(input: PracticeInput): Suggestion[] {
  const { units, states, results, now } = input;
  const suggestions: Suggestion[] = [];
  const taken = new Set(input.exclude ?? []);
  /** Adds it unless its lesson or song is already suggested; true if added. */
  const add = (suggestion: Suggestion) => {
    const key = targetKey(suggestion.target);
    if (taken.has(key)) return false;
    taken.add(key);
    suggestions.push(suggestion);
    return true;
  };
  const lessons = units.flatMap((unit) => unit.lessons);
  const resultOf = (target: PracticeTarget) => results[targetKey(target)];

  // The next lesson on the learning path.
  const next = nextLessonToPlay(units, states);
  if (next) add({ kind: SuggestionKind.Next, target: lesson(next) });

  // The finished lesson most overdue for review.
  const due = lessons
    .flatMap(({ id }) => {
      const row = resultOf(lesson(id));
      const review = row && row.bestStars >= 1 ? reviewOf(row) : null;
      return row && review && review.reviewDue <= now
        ? [{ id, lastPlayedAt: row.lastPlayedAt, overdue: now - review.reviewDue }]
        : [];
    })
    .sort((a, b) => b.overdue - a.overdue);
  due.some(({ id, lastPlayedAt }) =>
    add({ kind: SuggestionKind.Review, target: lesson(id), lastPlayedAt }),
  );

  // Songs at the learner's level: those of the units they've opened, and their own.
  const level = units.reduce((last, unit, index) => (isUnitOpen(unit, states) ? index : last), 0);
  const songs = input.songs.filter((song) => song.unit === null || song.unit <= level);

  // The latest song run that left bars to work on.
  const weak = songs
    .flatMap((song) => {
      const row = resultOf(song.target);
      return row?.weakBars && now - row.lastPlayedAt <= WEAK_SPOT_DAYS * DAY_MS
        ? [{ target: song.target, bars: row.weakBars, lastPlayedAt: row.lastPlayedAt }]
        : [];
    })
    .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt);
  weak.some((spot) => add({ kind: SuggestionKind.WeakSpot, ...spot }));

  // A song not played for a while: one never played first, then the longest unplayed.
  const rested = songs
    .map((song) => ({ target: song.target, lastPlayedAt: resultOf(song.target)?.lastPlayedAt }))
    .filter(
      ({ lastPlayedAt }) =>
        lastPlayedAt === undefined || now - lastPlayedAt >= SONG_REST_DAYS * DAY_MS,
    )
    .sort((a, b) => (a.lastPlayedAt ?? 0) - (b.lastPlayedAt ?? 0));
  rested.some((song) =>
    add({
      kind: SuggestionKind.Song,
      target: song.target,
      ...(song.lastPlayedAt !== undefined && { lastPlayedAt: song.lastPlayedAt }),
    }),
  );

  // A sight-reading drill now and then, at the highest level open.
  const drillLevel = input.drillLevels.at(-1);
  if (drillLevel) {
    const lastDrill = input.drillLevels
      .map((level) => resultOf({ kind: ResultKind.Drill, id: level })?.lastPlayedAt ?? 0)
      .reduce((latest, at) => Math.max(latest, at), 0);
    if (now - lastDrill >= DRILL_REST_DAYS * DAY_MS) {
      add({
        kind: SuggestionKind.Drill,
        target: { kind: ResultKind.Drill, id: drillLevel },
        ...(lastDrill > 0 && { lastPlayedAt: lastDrill }),
      });
    }
  }

  // The weakest skill started: its lesson played least well (short of three stars), or else an
  // open one not played yet. Lessons already played at three-star accuracy aren't suggested.
  const started = input.skills
    .filter((skill) => skill.played > 0 && skill.level !== SkillLevel.Mastered)
    .sort((a, b) => a.mastery - b.mastery);
  started.some(({ skill }) => {
    const candidates = lessons
      .filter((l) => l.skills.includes(skill) && states.get(l.id)?.status !== LessonStatus.Locked)
      .map((l) => ({ id: l.id, accuracy: resultOf(lesson(l.id))?.bestAccuracy ?? null }))
      .filter(({ accuracy }) => accuracy === null || accuracy < THREE_STARS)
      .sort((a, b) => (a.accuracy ?? Infinity) - (b.accuracy ?? Infinity));
    return candidates.some(({ id }) =>
      add({ kind: SuggestionKind.Skill, target: lesson(id), skill }),
    );
  });

  return suggestions.slice(0, MAX_SUGGESTIONS);
}
