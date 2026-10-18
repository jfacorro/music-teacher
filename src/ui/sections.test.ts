import { describe, expect, it } from 'vitest';
import { Section, SECTION_PATHS, SECTIONS, sectionOf } from './sections';

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
