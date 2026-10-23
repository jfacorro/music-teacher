import { describe, expect, it } from 'vitest';
import { TRANSLATED_LANGUAGES } from '../../i18n/languages';
import {
  COURSE_LEVELS,
  CourseLevel,
  EXERCISE_SKILLS,
  LESSON_ORDER,
  SKILLS,
  UNITS,
  findLesson,
  nextLessonId,
  unitsByLevel,
} from '../courses';
import { lessonExists, loadLesson } from '.';
import { LessonError, parseLesson, StepType } from './lesson';

type LessonText = { steps?: Record<string, string> };
const lessonTexts = import.meta.glob<LessonText>('/locales/*/lessons/*.json', {
  eager: true,
  import: 'default',
});
const courseTexts = import.meta.glob<{
  units: Record<string, { title?: string; description?: string }>;
  lessons: Record<string, string>;
  skills: Record<string, string>;
}>('/locales/*/courses.json', { eager: true, import: 'default' });
const lessonFiles = import.meta.glob('./*.json');

/** ICU argument names in a message, e.g. "Play {c} and {d}" → c, d. */
const argumentsOf = (message: string) =>
  [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();

describe('courses', () => {
  it('lists every lesson file exactly once', () => {
    const files = Object.keys(lessonFiles).map((path) => path.slice(2, -5));
    expect([...LESSON_ORDER].sort()).toEqual(files.sort());
    expect(new Set(LESSON_ORDER).size).toBe(LESSON_ORDER.length);
    for (const id of LESSON_ORDER) expect(lessonExists(id)).toBe(true);
  });

  it('finds lessons and what comes next', () => {
    expect(findLesson('u1-l2')).toMatchObject({ unit: { id: 'u1' }, index: 1 });
    expect(nextLessonId('u1-l6')).toBe('u2-l1');
    expect(nextLessonId(LESSON_ORDER.at(-1)!)).toBeNull();
    expect(findLesson('nope')).toBeNull();
  });

  it('groups the units in levels, in course order', () => {
    const order = UNITS.map((unit) => COURSE_LEVELS.indexOf(unit.level));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    const groups = unitsByLevel();
    expect(groups.map(({ level, units }) => [level, units.map(({ number }) => number)])).toEqual([
      [CourseLevel.Beginner, [1, 2, 3, 4]],
      [CourseLevel.Elementary, [5, 6, 7, 8]],
      [CourseLevel.LateElementary, [9, 10, 11]],
      [CourseLevel.EarlyIntermediate, [12, 13]],
    ]);
  });

  it('tags every lesson with what it practices, and every skill is practiced', () => {
    const lessons = UNITS.flatMap((unit) => unit.lessons);
    for (const lesson of lessons) expect(lesson.skills.length, lesson.id).toBeGreaterThan(0);
    const used = new Set(lessons.flatMap((lesson) => lesson.skills));
    // Skills with exercises of their own aren't in lessons.
    expect(SKILLS.filter((skill) => !used.has(skill))).toEqual(EXERCISE_SKILLS);
    for (const skill of EXERCISE_SKILLS) expect(used.has(skill)).toBe(false);
  });

  describe.each(TRANSLATED_LANGUAGES)('%s', (language) => {
    const texts = courseTexts[`/locales/${language}/courses.json`];

    it('names every skill', () => {
      for (const skill of SKILLS) expect(texts?.skills[skill], skill).toBeTruthy();
    });

    it('has a title for every unit and lesson, using only the provided note variables', () => {
      for (const unit of UNITS) {
        const unitText = texts?.units[unit.id];
        expect(unitText?.title, unit.id).toBeTruthy();
        for (const text of [unitText?.title ?? '', unitText?.description ?? '']) {
          for (const name of argumentsOf(text)) {
            expect(unit.textVars, `${unit.id} uses {${name}}`).toHaveProperty(name);
          }
        }
        for (const lesson of unit.lessons) {
          const title = texts?.lessons[lesson.id];
          expect(title, lesson.id).toBeTruthy();
          for (const name of argumentsOf(title ?? '')) {
            expect(lesson.titleVars, `${lesson.id} uses {${name}}`).toHaveProperty(name);
          }
        }
      }
    });
  });
});

describe('lessons', () => {
  // Every lesson is parsed here, so a typo in a note or a step fails the test run.
  describe.each(LESSON_ORDER)('%s', (id) => {
    it('loads and validates', async () => {
      const lesson = await loadLesson(id);
      expect(lesson.steps.length).toBeGreaterThan(0);
    });

    it.each(TRANSLATED_LANGUAGES)(
      'has text for every step in %s, with its note variables',
      async (language) => {
        const lesson = await loadLesson(id);
        const steps = lessonTexts[`/locales/${language}/lessons/${id}.json`]?.steps ?? {};
        for (const step of lesson.steps) {
          const text = steps[step.text];
          expect(text, `${id} › ${step.text}`).toBeTruthy();
          for (const name of argumentsOf(text ?? '')) {
            expect(step.textVars, `${id} › ${step.text} uses {${name}}`).toHaveProperty(name);
          }
        }
        // No leftover text for steps that don't exist.
        expect(Object.keys(steps).sort()).toEqual(
          [...new Set(lesson.steps.map((s) => s.text))].sort(),
        );
      },
    );
  });
});

describe('parseLesson', () => {
  const exercise = {
    type: 'exercise',
    text: 'play',
    mode: 'wait',
    score: {
      tempo: 60,
      timeSignature: [4, 4],
      notes: [{ note: 'C4', start: 0, duration: 1, hand: 'R' }],
    },
  };

  it('names notes, chords and scales in the text, and keys of either hand', async () => {
    const lesson = await parseLesson('x', {
      steps: [
        {
          type: 'explain',
          text: 'x',
          textVars: {
            c: 'C4',
            cMajor: { chord: 'C4', quality: 'major' },
            gScale: { scale: 'G4', quality: 'major' },
          },
          hand: 'R',
          keys: [
            { note: 'C3', finger: 5, hand: 'L' },
            { note: 'C4', finger: 1 },
          ],
        },
      ],
    });
    const step = lesson.steps[0]!;
    expect(step.textVars).toMatchObject({
      c: { midi: 60 },
      cMajor: { chord: { midi: 60 }, quality: 'major' },
      gScale: { scale: { midi: 67 }, quality: 'major' },
    });
    expect(step.type === StepType.Explain && step.keys.map((key) => key.hand)).toEqual([
      'L',
      undefined,
    ]);
  });

  it('parses every step type', async () => {
    const lesson = await parseLesson('x', {
      steps: [
        {
          type: 'explain',
          text: 'a',
          textVars: { c: 'C4' },
          keys: [{ note: 'C4', finger: 1 }],
          range: ['C3', 'C5'],
          staff: { clef: 'treble', notes: ['C4', 'G4'], names: true },
          music: {
            tempo: 60,
            timeSignature: [4, 4],
            notes: [{ note: 'C4', start: 0, duration: 1, hand: 'R', articulations: ['staccato'] }],
          },
        },
        { type: 'find', text: 'b', notes: ['C4', 'E4'] },
        {
          ...exercise,
          hands: 'R',
          pass: { minStars: 2 },
          metronome: true,
          view: 'sheet',
          notation: 'plain',
        },
        { type: 'exercise', text: 'song', mode: 'tempo', song: 'ode-to-joy', tempo: 80 },
        { type: 'quiz', text: 'q', notes: ['C4', 'G4'], count: 5, clef: 'treble' },
        { type: 'rhythm', text: 'r', pattern: 'q q h | e e q rq q', tempo: 90 },
      ],
    });
    expect(lesson.steps.map((s) => s.type)).toEqual([
      'explain',
      'find',
      'exercise',
      'exercise',
      'quiz',
      'rhythm',
    ]);
    expect(lesson.steps[4]).toMatchObject({
      notes: [{ midi: 60 }, { midi: 67 }],
      count: 5,
      clef: 'treble',
      pass: { minStars: 0 },
    });
    const rhythm = lesson.steps[5];
    expect(rhythm).toMatchObject({ view: 'sheet', metronome: true, score: { tempo: 90 } });
    expect(rhythm?.type === StepType.Rhythm && rhythm.score.notes.map((n) => n.start)).toEqual([
      0, 1, 2, 4, 4.5, 5, 7,
    ]);
    expect(lesson.steps[0]).toMatchObject({
      keys: [{ pitch: { midi: 60 }, finger: 1 }],
      range: [48, 72],
      hand: 'R',
      staff: { clef: 'treble', notes: [{ midi: 60 }, { midi: 67 }], names: true, bar: false },
      music: { notes: [{ pitch: { midi: 60 }, articulations: ['staccato'] }] },
    });
    expect(lesson.steps[1]).not.toHaveProperty('staff');
    expect(lesson.steps[2]).toMatchObject({
      hands: 'R',
      pass: { minStars: 2 },
      metronome: true,
      song: null,
      view: 'sheet',
      notation: 'plain',
    });
    expect(lesson.steps[3]).toMatchObject({
      song: 'ode-to-joy',
      score: { tempo: 80 },
      hands: 'both',
      view: 'falling',
      notation: null,
    });
  });

  it.each([
    ['an unknown step type', { type: 'dance', text: 'x' }, 'steps[0] › type'],
    ['a missing text key', { type: 'find', notes: ['C4'] }, 'steps[0] › text'],
    [
      'a bad note',
      { type: 'find', text: 'x', notes: ['H4'] },
      'steps[0] › notes[0]: Invalid note "H4"',
    ],
    ['a bad note variable', { type: 'explain', text: 'x', textVars: { c: 'C' } }, 'textVars › c'],
    ['an unknown song', { ...exercise, score: undefined, song: 'nope' }, 'song'],
    [
      'a bad score',
      { ...exercise, score: { tempo: 60, timeSignature: [4, 4], notes: [] } },
      'score › notes',
    ],
    ['a bad mode', { ...exercise, mode: 'fast' }, 'mode'],
    ['a bad view', { ...exercise, view: 'tab' }, 'view'],
    ['a bad notation', { ...exercise, notation: 'big' }, 'notation'],
    ['a bad pass rule', { ...exercise, pass: { minStars: 4 } }, 'minStars'],
    ['a quiz without notes', { type: 'quiz', text: 'x', notes: [] }, 'notes'],
    [
      'a staff picture with a bad clef',
      { type: 'explain', text: 'x', staff: { clef: 'alto', notes: ['C4'] } },
      'staff › clef',
    ],
    [
      'music with a bad note',
      { type: 'explain', text: 'x', music: { tempo: 60, timeSignature: [4, 4], notes: [{}] } },
      'music › notes[0]',
    ],
    ['too many quiz cards', { type: 'quiz', text: 'x', notes: ['C4'], count: 100 }, 'count'],
    ['a bad clef', { type: 'quiz', text: 'x', notes: ['C4'], clef: 'alto' }, 'clef'],
    [
      'a rhythm with a short bar',
      { type: 'rhythm', text: 'x', pattern: 'q q q', tempo: 60 },
      'pattern: bar 1 lasts 3 beats',
    ],
    ['a rhythm without a pattern', { type: 'rhythm', text: 'x', tempo: 60 }, 'pattern'],
    ['a backwards range', { type: 'find', text: 'x', notes: ['C4'], range: ['C5', 'C3'] }, 'range'],
    [
      'a chord of an unknown kind',
      { type: 'explain', text: 'x', textVars: { x: { chord: 'C4', quality: 'happy' } } },
      'textVars › x › quality',
    ],
    [
      'a variable that is neither',
      { type: 'explain', text: 'x', textVars: { x: { y: 1 } } },
      'textVars › x',
    ],
    [
      'a key for a third hand',
      { type: 'explain', text: 'x', keys: [{ note: 'C4', hand: 'X' }] },
      'keys › [0] › hand',
    ],
  ])('rejects %s with its location', async (_, step, message) => {
    await expect(parseLesson('x', { steps: [step] })).rejects.toThrow(LessonError);
    await expect(parseLesson('x', { steps: [step] })).rejects.toThrow(message);
  });
});
