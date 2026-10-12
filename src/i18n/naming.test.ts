import { describe, expect, it } from 'vitest';
import { parseNote, pitchFromMidi } from '../theory/pitch';
import { NAMING_SYSTEMS, defaultNamingSystem, noteName, type NamingSystem } from './naming';

const name = (note: string, system: NamingSystem, octave = false) =>
  noteName(parseNote(note), system, { octave });

describe('noteName', () => {
  it.each([
    ['C4', 'C', 'Do', 'C'],
    ['D4', 'D', 'Re', 'D'],
    ['E4', 'E', 'Mi', 'E'],
    ['F4', 'F', 'Fa', 'F'],
    ['G4', 'G', 'Sol', 'G'],
    ['A4', 'A', 'La', 'A'],
    ['B4', 'B', 'Si', 'H'],
    ['C#4', 'C♯', 'Do♯', 'Cis'],
    ['F#4', 'F♯', 'Fa♯', 'Fis'],
    ['E#4', 'E♯', 'Mi♯', 'Eis'],
    ['B#3', 'B♯', 'Si♯', 'His'],
    ['Db4', 'D♭', 'Re♭', 'Des'],
    ['Eb4', 'E♭', 'Mi♭', 'Es'],
    ['Gb4', 'G♭', 'Sol♭', 'Ges'],
    ['Ab4', 'A♭', 'La♭', 'As'],
    ['Bb4', 'B♭', 'Si♭', 'B'],
    ['Cb4', 'C♭', 'Do♭', 'Ces'],
    ['C##4', 'C𝄪', 'Do𝄪', 'Cisis'],
    ['B##4', 'B𝄪', 'Si𝄪', 'Hisis'],
    ['Dbb4', 'D𝄫', 'Re𝄫', 'Deses'],
    ['Ebb4', 'E𝄫', 'Mi𝄫', 'Eses'],
    ['Abb4', 'A𝄫', 'La𝄫', 'Asas'],
    ['Bbb4', 'B𝄫', 'Si𝄫', 'Heses'],
  ])('%s → %s / %s / %s', (note, english, solfege, german) => {
    expect(name(note, 'english')).toBe(english);
    expect(name(note, 'solfege')).toBe(solfege);
    expect(name(note, 'german')).toBe(german);
  });

  it('appends the octave number when asked', () => {
    expect(name('C4', 'english', true)).toBe('C4');
    expect(name('F#3', 'solfege', true)).toBe('Fa♯3');
    expect(name('Bb2', 'german', true)).toBe('B2');
    expect(name('Cb4', 'english', true)).toBe('C♭4');
  });

  it('gives all 12 pitch classes distinct names in every system', () => {
    for (const system of NAMING_SYSTEMS) {
      for (const accidentals of ['sharps', 'flats'] as const) {
        const names = Array.from({ length: 12 }, (_, i) =>
          noteName(pitchFromMidi(60 + i, { accidentals }), system),
        );
        expect(new Set(names).size).toBe(12);
        expect(names.every((n) => n.length > 0)).toBe(true);
      }
    }
  });
});

describe('defaultNamingSystem', () => {
  it.each([
    ['en', 'english'],
    ['en-US', 'english'],
    ['en-XA', 'english'],
    ['nl', 'english'],
    ['es', 'solfege'],
    ['es-AR', 'solfege'],
    ['fr', 'solfege'],
    ['it', 'solfege'],
    ['pt-BR', 'solfege'],
    ['de', 'german'],
    ['de-AT', 'german'],
    ['sv', 'german'],
  ])('%s → %s', (language, system) => {
    expect(defaultNamingSystem(language)).toBe(system);
  });
});
