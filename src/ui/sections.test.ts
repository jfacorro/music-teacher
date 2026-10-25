import { describe, expect, it } from 'vitest';
import { Course, COURSES } from '../content/courses';
import { COURSE_SECTIONS, Section, SECTION_PATHS, SECTIONS, sectionOf } from './sections';

describe('COURSE_SECTIONS', () => {
  it('gives each course Home, Learn and Settings, and the voice the Tuner for Free play', () => {
    for (const course of COURSES) {
      const sections = COURSE_SECTIONS[course];
      expect(sections.slice(0, 2)).toEqual([Section.Home, Section.Learn]);
      expect(sections.at(-1)).toBe(Section.Settings);
      // In the sidebar's order.
      expect(sections).toEqual(SECTIONS.filter((section) => sections.includes(section)));
    }
    expect(COURSE_SECTIONS[Course.Piano]).toContain(Section.FreePlay);
    expect(COURSE_SECTIONS[Course.Piano]).not.toContain(Section.Tuner);
    expect(COURSE_SECTIONS[Course.Voice]).toEqual([
      Section.Home,
      Section.Learn,
      Section.EarTraining,
      Section.Tuner,
      Section.Settings,
    ]);
  });
});

describe('sectionOf', () => {
  it('finds each section from its own page', () => {
    for (const section of SECTIONS) expect(sectionOf(SECTION_PATHS[section])).toBe(section);
  });

  it('puts the pages inside a section under it', () => {
    expect(sectionOf('/lesson/u9-l2')).toBe(Section.Learn);
    expect(sectionOf('/practice/can-can')).toBe(Section.Songs);
    expect(sectionOf('/practice/my/12')).toBe(Section.Songs);
    expect(sectionOf('/my-songs/import')).toBe(Section.Songs);
  });

  it('is Home for anything else, without matching a longer name', () => {
    expect(sectionOf('/nowhere')).toBe(Section.Home);
    expect(sectionOf('/learner')).toBe(Section.Home);
  });
});
