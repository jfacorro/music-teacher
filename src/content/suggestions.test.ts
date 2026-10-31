import { describe, expect, it } from 'vitest';
import type { ResultRow } from '../storage/db';
import { ResultKind } from '../storage/progress';
import { CourseLevel, type Skill, type Unit } from './courses';
import { DAY_MS } from './review';
import { skillProgress } from './skills';
import { EarLevel } from './earTraining';
import { DrillLevel } from './sightReading';
import { type SongChoice, suggestPractice, SuggestionKind } from './suggestions';
import { lessonStates } from './unlock';

const unit = (id: string, lessons: [string, Skill][], minStars?: number): Unit => ({
  id,
  level: CourseLevel.Beginner,
  textVars: {},
  unlock: minStars === undefined ? null : { previousUnitMinStars: minStars },
  lessons: lessons.map(([lessonId, skill]) => ({
    id: lessonId,
    titleVars: {},
    builds: [],
    tryIt: { song: null, ear: null },
    skills: [skill],
  })),
});

const units = [
  unit('u1', [
    ['a', 'keyboard'],
    ['b', 'keyboard'],
  ]),
  unit(
    'u2',
    [
      ['c', 'chords'],
      ['d', 'chords'],
    ],
    1,
  ),
];
const song = (
  id: string,
  unitIndex: number | null,
  kind: ResultKind = ResultKind.Song,
): SongChoice => ({
  target: { kind, id },
  unit: unitIndex,
});
const songs = [song('s1', 0), song('s2', 1), song('7', null, ResultKind.MySong)];

const NOW = 100 * DAY_MS;
const daysAgo = (days: number) => NOW - days * DAY_MS;

/** A result: `key` like "lesson:a", played `days` ago. */
function result(key: string, stars: number, accuracy: number, days: number, extra = {}): ResultRow {
  return {
    key,
    bestStars: stars,
    bestAccuracy: accuracy,
    attempts: 1,
    completedAt: stars > 0 ? daysAgo(days) : null,
    lastPlayedAt: daysAgo(days),
    ...extra,
  };
}

function suggest(
  rows: ResultRow[],
  exclude?: string[],
  drillLevels: DrillLevel[] = [],
  earLevels: EarLevel[] = [],
  earKind?: ResultKind,
) {
  const results = Object.fromEntries(rows.map((row) => [row.key, row]));
  const starsOf = (id: string) => results[`lesson:${id}`]?.bestStars ?? 0;
  return suggestPractice({
    units,
    states: lessonStates(units, starsOf),
    results,
    songs,
    skills: skillProgress(['keyboard', 'chords'], units, (id) =>
      results[`lesson:${id}`] ? results[`lesson:${id}`]!.bestAccuracy : null,
    ),
    drillLevels,
    earLevels,
    earKind,
    now: NOW,
    exclude: exclude && new Set(exclude),
  }).map((s) => [s.kind, `${s.target.kind}:${s.target.id}`, ...(s.bars ? [s.bars] : [])]);
}

describe('suggestPractice', () => {
  it('starts a new learner with the first lesson and a song of their level', () => {
    expect(suggest([])).toEqual([
      [SuggestionKind.Next, 'lesson:a'],
      [SuggestionKind.Song, 'song:s1'],
    ]);
  });

  it('brings back a finished lesson when its review is due', () => {
    // Two stars: due after 7 days.
    expect(suggest([result('lesson:a', 2, 0.85, 8)])[1]).toEqual([
      SuggestionKind.Review,
      'lesson:a',
    ]);
    expect(suggest([result('lesson:a', 2, 0.85, 6)]).map(([kind]) => kind)).not.toContain(
      SuggestionKind.Review,
    );
  });

  it('never suggests locked lessons, or songs of a locked unit', () => {
    const suggestions = suggest([result('lesson:a', 3, 1, 1)]);
    expect(suggestions.flat()).not.toContain('lesson:c');
    expect(suggestions.flat()).not.toContain('song:s2');
    // Once unit 2 opens, its song can come up.
    const opened = suggest([
      result('lesson:a', 3, 1, 1),
      result('lesson:b', 3, 1, 1),
      result('song:s1', 3, 1, 1),
    ]);
    expect(opened.flat()).toContain('song:s2');
  });

  it('suggests the bars of a recent run that went badly, not an old one', () => {
    const weak = { weakBars: { first: 4, last: 5 } };
    expect(suggest([result('song:s1', 1, 0.7, 1, weak)])).toContainEqual([
      SuggestionKind.WeakSpot,
      'song:s1',
      { first: 4, last: 5 },
    ]);
    expect(suggest([result('song:s1', 1, 0.7, 20, weak)]).map(([kind]) => kind)).not.toContain(
      SuggestionKind.WeakSpot,
    );
  });

  it('suggests songs not played for a while, the learner’s own included', () => {
    const played = suggest([result('song:s1', 2, 0.9, 1)]);
    // s1 was played yesterday: the imported song comes up instead.
    expect(played).toContainEqual([SuggestionKind.Song, 'mySong:7']);
  });

  it('works on the weakest skill through its weakest lesson', () => {
    const suggestions = suggest([result('lesson:a', 1, 0.65, 1), result('lesson:b', 3, 0.98, 1)]);
    expect(suggestions).toContainEqual([SuggestionKind.Skill, 'lesson:a']);
  });

  it('doesn’t suggest a lesson already played at three-star accuracy to strengthen a skill', () => {
    // Keyboard is still weak (b is unplayed), but a went perfectly and b is the next lesson.
    const suggestions = suggest([result('lesson:a', 3, 1, 1)]);
    expect(suggestions.map(([kind]) => kind)).not.toContain(SuggestionKind.Skill);
  });

  it('leaves out what’s excluded and never repeats a lesson or song', () => {
    const suggestions = suggest([result('lesson:a', 1, 0.65, 10)], ['lesson:b']);
    const targets = suggestions.map(([, target]) => target);
    expect(targets).not.toContain('lesson:b');
    expect(new Set(targets).size).toBe(targets.length);
  });

  it('suggests a drill at the highest level open, unless one was played lately', () => {
    const levels = [DrillLevel.Treble, DrillLevel.TrebleRhythm];
    const drills = (rows: ResultRow[]) =>
      suggest(rows, undefined, levels).filter(([kind]) => kind === SuggestionKind.Drill);
    expect(drills([])).toEqual([[SuggestionKind.Drill, 'drill:trebleRhythm']]);
    expect(drills([result('drill:treble', 2, 0.85, 1)])).toEqual([]);
    expect(drills([result('drill:treble', 2, 0.85, 3)])).toEqual([
      [SuggestionKind.Drill, 'drill:trebleRhythm'],
    ]);
    expect(suggest([]).some(([kind]) => kind === SuggestionKind.Drill)).toBe(false);
  });

  it('suggests ear training at the highest level open, unless done lately', () => {
    const levels = [EarLevel.Notes, EarLevel.Intervals];
    const ear = (rows: ResultRow[]) =>
      suggest(rows, undefined, [], levels).filter(([kind]) => kind === SuggestionKind.Ear);
    expect(ear([])).toEqual([[SuggestionKind.Ear, 'ear:intervals']]);
    expect(ear([result('ear:notes', 3, 1, 0)])).toEqual([]);
  });

  it('suggests the voice’s ear training as its own', () => {
    const ear = (rows: ResultRow[]) =>
      suggest(rows, undefined, [], [EarLevel.Notes], ResultKind.VoiceEar).filter(
        ([kind]) => kind === SuggestionKind.Ear,
      );
    expect(ear([result('ear:notes', 3, 1, 0)])).toEqual([[SuggestionKind.Ear, 'voiceEar:notes']]);
    expect(ear([result('voiceEar:notes', 3, 1, 0)])).toEqual([]);
  });
});
