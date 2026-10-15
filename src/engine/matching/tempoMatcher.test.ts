import { describe, expect, it } from 'vitest';
import { scoreOf } from '../testUtils';
import { MIC_WINDOWS, MIDI_WINDOWS } from '../timing';
import { TempoMatcher } from './tempoMatcher';

// At 60 BPM one beat is one second, so beat offsets read as seconds.
const TEMPO = 60;
const C4 = 60;
const D4 = 62;
const E4 = 64;

const play = (matcher: TempoMatcher, pitch: number, beat: number, windows = MIDI_WINDOWS) =>
  matcher.play(pitch, beat, TEMPO, windows);

describe('TempoMatcher', () => {
  it('grades notes by how far off the beat they are', () => {
    const { notes } = scoreOf([
      ['C4', 0],
      ['D4', 1],
      ['E4', 2],
      ['C4', 3],
    ]);
    const matcher = new TempoMatcher(notes);
    expect(play(matcher, C4, 0.02)).toMatchObject({ kind: 'hit', grade: 'perfect', errorMs: 20 });
    expect(play(matcher, D4, 0.92)).toMatchObject({ kind: 'hit', grade: 'good' });
    expect(play(matcher, E4, 2.14)).toMatchObject({ kind: 'hit', grade: 'ok' });
    expect(matcher.done).toBe(false);
    expect(play(matcher, C4, 3)).toMatchObject({ kind: 'hit', note: notes[3] });
    expect(matcher.done).toBe(true);
  });

  it('reports a wrong key as extra', () => {
    const matcher = new TempoMatcher(scoreOf([['C4', 0]]).notes);
    expect(play(matcher, D4, 0)).toEqual({ kind: 'extra', pitch: D4, beat: 0 });
  });

  it('reports a right key outside the window as extra', () => {
    const matcher = new TempoMatcher(scoreOf([['C4', 1]]).notes);
    expect(play(matcher, C4, 0.8)).toMatchObject({ kind: 'extra' });
  });

  it('matches each note only once', () => {
    const matcher = new TempoMatcher(scoreOf([['C4', 0]]).notes);
    expect(play(matcher, C4, 0)).toMatchObject({ kind: 'hit' });
    expect(play(matcher, C4, 0.05)).toMatchObject({ kind: 'extra' });
  });

  it('picks the nearest of repeated notes', () => {
    const { notes } = scoreOf([
      ['C4', 0, 0.25],
      ['C4', 0.25, 0.25],
    ]);
    const matcher = new TempoMatcher(notes);
    expect(play(matcher, C4, 0.2)).toMatchObject({ kind: 'hit', note: notes[1] });
    expect(play(matcher, C4, 0.1)).toMatchObject({ kind: 'hit', note: notes[0] });
  });

  it('matches every key of a chord', () => {
    const { notes } = scoreOf([
      ['C4', 0],
      ['E4', 0],
      ['C3', 0, 1, 'L'],
    ]);
    const matcher = new TempoMatcher(notes);
    for (const [pitch, beat] of [
      [48, 0.01],
      [E4, -0.02],
      [C4, 0.03],
    ] as const) {
      expect(play(matcher, pitch, beat)).toMatchObject({ kind: 'hit', grade: 'perfect' });
    }
    expect(matcher.done).toBe(true);
  });

  it('misses notes once their window has passed', () => {
    const { notes } = scoreOf([
      ['C4', 0],
      ['D4', 1],
    ]);
    const matcher = new TempoMatcher(notes);
    expect(matcher.advance(0.15, TEMPO, MIDI_WINDOWS)).toEqual([]);
    expect(matcher.advance(0.16, TEMPO, MIDI_WINDOWS)).toEqual([notes[0]]);
    expect(matcher.advance(0.5, TEMPO, MIDI_WINDOWS)).toEqual([]); // reported once
    expect(play(matcher, C4, 0.16)).toMatchObject({ kind: 'extra' });
    expect(matcher.advance(2, TEMPO, MIDI_WINDOWS)).toEqual([notes[1]]);
    expect(matcher.done).toBe(true);
  });

  it('lists the notes that could be played at a beat', () => {
    const { notes } = scoreOf([
      ['C4', 0],
      ['E4', 0],
      ['G4', 1],
    ]);
    const matcher = new TempoMatcher(notes);
    expect(matcher.candidates(0.1, TEMPO, MIDI_WINDOWS).map((n) => n.pitch.midi)).toEqual([60, 64]);
    matcher.play(C4, 0, TEMPO, MIDI_WINDOWS);
    expect(matcher.candidates(0.1, TEMPO, MIDI_WINDOWS).map((n) => n.pitch.midi)).toEqual([64]);
    expect(matcher.candidates(0.5, TEMPO, MIDI_WINDOWS)).toEqual([]);
  });

  it('says which notes come next', () => {
    const { notes } = scoreOf([
      ['C4', 0],
      ['E4', 2],
      ['G4', 2],
    ]);
    const matcher = new TempoMatcher(notes);
    const upcoming = (beat: number) =>
      matcher.upcoming(beat, TEMPO, MIDI_WINDOWS).map((n) => n.pitch.midi);
    expect(upcoming(0.05)).toEqual([C4]); // in its window
    expect(upcoming(1)).toEqual([E4, 67]); // the next chord
    matcher.advance(5, TEMPO, MIDI_WINDOWS);
    expect(upcoming(5)).toEqual([]);
  });

  it('takes the rest of a chord', () => {
    const { notes } = scoreOf([
      ['C4', 0],
      ['E4', 0],
      ['G4', 1],
    ]);
    const matcher = new TempoMatcher(notes);
    const hit = matcher.play(C4, 0, TEMPO, MIDI_WINDOWS);
    expect(hit.kind === 'hit' && matcher.takeChord(hit.note).map((n) => n.pitch.midi)).toEqual([
      E4,
    ]);
    expect(matcher.upcoming(0.5, TEMPO, MIDI_WINDOWS).map((n) => n.pitch.midi)).toEqual([67]);
  });

  it('uses wider windows for the microphone', () => {
    const matcher = new TempoMatcher(scoreOf([['C4', 0]]).notes);
    expect(play(matcher, C4, 0.18, MIC_WINDOWS)).toMatchObject({ kind: 'hit', grade: 'ok' });
  });

  it('measures timing in real time, so faster tempos have tighter beat windows', () => {
    const matcher = new TempoMatcher(scoreOf([['C4', 0]], 120).notes);
    // 0.25 beats at 120 BPM = 125 ms → ok, not good.
    expect(matcher.play(C4, 0.25, 120, MIDI_WINDOWS)).toMatchObject({ grade: 'ok', errorMs: 125 });
  });
});
