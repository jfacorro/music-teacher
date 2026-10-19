import { describe, expect, it } from 'vitest';
import { closestVoiceType, HeldNote, HOLD_MS, VoiceType } from './vocalRange';

/** Feeds readings every 40 ms (about the microphone's rate) and returns the last result. */
function sing(held: HeldNote, notes: (number | null)[], start = 0) {
  return notes.map((midi, i) => held.update(midi, start + i * 40)).at(-1)!;
}

describe('HeldNote', () => {
  it('holds a note sung steadily for half a second', () => {
    const held = new HeldNote();
    expect(sing(held, Array<number>(7).fill(48))).toEqual({ note: 48, held: 240 / HOLD_MS });
    expect(sing(held, Array<number>(7).fill(48), 280)).toEqual({ note: 48, held: 1 });
  });

  it('starts over when the note changes, as when sliding', () => {
    const held = new HeldNote();
    const result = sing(held, [50, 50, 50, 49, 49, 48, 48, 48]);
    expect(result.note).toBe(48);
    expect(result.held).toBeCloseTo(80 / HOLD_MS);
  });

  it('keeps holding through a short gap, and lets go after a longer one', () => {
    const held = new HeldNote();
    expect(sing(held, [48, 48, null, null, 48, 48]).note).toBe(48);
    expect(sing(held, [null, null, null, null, null], 1000)).toEqual({ note: null, held: 0 });
  });
});

describe('closestVoiceType', () => {
  it('finds the voice type whose usual range is nearest', () => {
    expect(closestVoiceType(43, 64)).toBe(VoiceType.Bass); // G2–E4
    expect(closestVoiceType(46, 69)).toBe(VoiceType.Baritone); // B♭2–A4
    expect(closestVoiceType(48, 72)).toBe(VoiceType.Tenor); // C3–C5
    expect(closestVoiceType(55, 79)).toBe(VoiceType.Alto); // G3–G5
    expect(closestVoiceType(60, 86)).toBe(VoiceType.Soprano); // C4–D6
  });
});
