import { describe, expect, it } from 'vitest';
import { TRANSLATED_LANGUAGES } from '../../i18n/languages';
import {
  Course,
  COURSE_LEVELS,
  COURSE_UNITS,
  CourseLevel,
  COURSES,
  EXERCISE_SKILLS,
  LESSON_ORDER,
  lessonOrder,
  SKILLS,
  UNITS,
  VOICE_UNITS,
  findLesson,
  nextLessonId,
  unitsByLevel,
} from '../courses';
import { lessonExists, loadLesson } from '.';
import { isGraded, LessonError, parseLesson, StepType } from './lesson';

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

/** Both courses' units and lessons. */
const ALL_UNITS = COURSES.flatMap((course) => COURSE_UNITS[course]);
const ALL_LESSONS = COURSES.flatMap((course) => lessonOrder(course));

/** ICU argument names in a message, e.g. "Play {c} and {d}" → c, d. */
const argumentsOf = (message: string) =>
  [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();

describe('courses', () => {
  it('lists every lesson file exactly once', () => {
    const files = Object.keys(lessonFiles).map((path) => path.slice(2, -5));
    expect([...ALL_LESSONS].sort()).toEqual(files.sort());
    expect(new Set(ALL_LESSONS).size).toBe(ALL_LESSONS.length);
    for (const id of ALL_LESSONS) expect(lessonExists(id)).toBe(true);
  });

  it('finds lessons of either course and what comes next in it', () => {
    expect(findLesson('u1-l2')).toMatchObject({
      course: Course.Piano,
      unit: { id: 'u1' },
      index: 1,
    });
    expect(findLesson('v1-l2')).toMatchObject({
      course: Course.Voice,
      unit: { id: 'v1' },
      index: 1,
    });
    expect(nextLessonId('u1-l6')).toBe('u2-l1');
    expect(nextLessonId('v1-l1')).toBe('v1-l2');
    // The end of one course doesn't lead into the other.
    expect(nextLessonId(LESSON_ORDER.at(-1)!)).toBeNull();
    expect(nextLessonId(lessonOrder(Course.Voice).at(-1)!)).toBeNull();
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
      [CourseLevel.EarlyIntermediate, [12, 13, 14]],
    ]);
    expect(
      unitsByLevel(VOICE_UNITS).map(({ level, units }) => [
        level,
        units.map(({ number }) => number),
      ]),
    ).toEqual([
      [CourseLevel.Beginner, [1, 2, 3, 4]],
      [CourseLevel.Elementary, [5, 6, 7, 8]],
    ]);
  });

  it('tags every lesson with what it practices, and every skill is practiced', () => {
    const lessons = ALL_UNITS.flatMap((unit) => unit.lessons);
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
      for (const unit of ALL_UNITS) {
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
  describe.each(ALL_LESSONS)('%s', (id) => {
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

/** A melody to sing: no hands. */
const melody = {
  tempo: 80,
  timeSignature: [4, 4],
  notes: [
    { note: 'C4', start: 0, duration: 2 },
    { note: 'D4', start: 2, duration: 2 },
  ],
};

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

  it('parses theory questions and notes to find', async () => {
    const lesson = await parseLesson('test', {
      steps: [
        {
          type: 'question',
          text: 'a',
          kind: 'intervalName',
          answers: ['majorThird', 'perfectFifth'],
          roots: ['D4'],
          show: 'staff',
          count: 4,
        },
        {
          type: 'build',
          text: 'b',
          kind: 'stepSize',
          answers: ['half'],
          roots: ['C4'],
          pass: { minStars: 2 },
        },
      ],
    });
    expect(lesson.steps[0]).toMatchObject({
      type: 'question',
      show: 'staff',
      count: 4,
      questions: { kind: 'intervalName', answers: ['majorThird', 'perfectFifth'] },
    });
    expect(lesson.steps[1]).toMatchObject({ type: 'build', count: 10, pass: { minStars: 2 } });
    expect(lesson.steps.every(isGraded)).toBe(true);
  });

  it('rejects theory questions it couldn’t deal', async () => {
    const question = {
      type: 'question',
      text: 'a',
      kind: 'intervalName',
      answers: ['majorThird'],
      roots: ['C4'],
      show: 'staff',
    };
    const parse = (changes: object) =>
      parseLesson('test', { steps: [{ ...question, ...changes }] });
    await expect(parse({ show: 'nowhere' })).rejects.toThrow('show');
    await expect(parse({ kind: 'nothing' })).rejects.toThrow('kind');
    await expect(parse({ answers: [] })).rejects.toThrow('answers');
    await expect(parse({ answers: ['half'] })).rejects.toThrow('not an answer');
    await expect(parse({ roots: [] })).rejects.toThrow('roots');
    await expect(parse({ roots: ['E##4'], answers: ['majorSecond'] })).rejects.toThrow(
      'no "majorSecond" above',
    );
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
        { type: 'warmUp', text: 'w' },
        { type: 'match', text: 'm', within: 2, count: 5, pass: { minStars: 1 } },
        { type: 'match', text: 'all' },
        { type: 'sing', text: 's', mode: 'listenFirst', score: melody, strict: true },
      ],
    });
    expect(lesson.steps.map((s) => s.type)).toEqual([
      'explain',
      'find',
      'exercise',
      'exercise',
      'quiz',
      'rhythm',
      'warmUp',
      'match',
      'match',
      'sing',
    ]);
    expect(lesson.steps[9]).toMatchObject({
      mode: 'listenFirst',
      view: 'falling',
      strict: true,
      octave: false,
      guide: true,
      metronome: false,
      pass: { minStars: 1 },
    });
    expect(lesson.steps[7]).toMatchObject({ within: 2, count: 5, pass: { minStars: 1 } });
    // By default: the whole range, ten notes.
    expect(lesson.steps[8]).toMatchObject({ within: null, count: 10, pass: { minStars: 1 } });
    expect(lesson.steps.map(isGraded)).toEqual([
      false,
      true,
      true,
      true,
      true,
      true,
      false,
      true,
      true,
      true,
    ]);
    expect(lesson.steps[4]).toMatchObject({
      notes: [{ midi: 60 }, { midi: 67 }],
      count: 5,
      clef: 'treble',
      pass: { minStars: 1 },
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
    ['a step that asks for no stars', { ...exercise, pass: { minStars: 0 } }, 'minStars'],
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
    ['a match reaching too far', { type: 'match', text: 'x', within: 25 }, 'within'],
    ['a match within part of a step', { type: 'match', text: 'x', within: 1.5 }, 'within'],
    ['no notes to match', { type: 'match', text: 'x', count: 0 }, 'count'],
    ['a sing step without a mode', { type: 'sing', text: 'x', score: melody }, 'mode'],
    [
      'two notes at once to sing',
      {
        type: 'sing',
        text: 'x',
        mode: 'wait',
        score: { ...melody, notes: [...melody.notes, { note: 'E4', start: 0, duration: 1 }] },
      },
      'score › notes[1]',
    ],
    [
      'a melody to sing with repeats',
      {
        type: 'sing',
        text: 'x',
        mode: 'along',
        score: { ...melody, repeats: [{ from: 0, to: 4 }] },
      },
      'repeats',
    ],
    [
      'a guide that is neither on nor off',
      { type: 'sing', text: 'x', mode: 'along', score: melody, guide: 'yes' },
      'guide',
    ],
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
