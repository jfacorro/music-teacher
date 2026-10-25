/**
 * The vocal range test (Settings → Voice): which note is being held steadily, from the
 * microphone's pitch readings, and the closest voice type for a range.
 */

/** A note counts once it's held this long, ms. */
export const HOLD_MS = 500;
/** A reading missing for up to this long (a breath, a crackle) doesn't break the hold, ms. */
const GAP_MS = 150;

/** The lowest and highest notes held steadily, and the comfortable one (MIDI numbers). */
export interface VocalRange {
  low: number;
  high: number;
  comfortable: number;
  /** When it was measured (ms since 1970). */
  testedAt: number;
}

/** Follows the note being sung: the same note for `HOLD_MS` (or `holdMs`) is held. */
export class HeldNote {
  private note: number | null = null;
  private since = 0;
  private lastSeen = -Infinity;
  private readonly holdMs: number;

  constructor(holdMs = HOLD_MS) {
    this.holdMs = holdMs;
  }

  /**
   * A reading at `time` (ms): the nearest note, or null when nothing clear is heard. Returns the
   * note being sung and how far into holding it (0–1; 1 = held).
   */
  update(midi: number | null, time: number): { note: number | null; held: number } {
    if (midi === null) {
      if (time - this.lastSeen > GAP_MS) this.note = null;
    } else {
      if (midi !== this.note) {
        this.note = midi;
        this.since = time;
      }
      this.lastSeen = time;
    }
    return {
      note: this.note,
      held: this.note === null ? 0 : Math.min(1, (time - this.since) / this.holdMs),
    };
  }
}

export const VoiceType = {
  Bass: 'bass',
  Baritone: 'baritone',
  Tenor: 'tenor',
  Alto: 'alto',
  MezzoSoprano: 'mezzoSoprano',
  Soprano: 'soprano',
} as const;
export type VoiceType = (typeof VoiceType)[keyof typeof VoiceType];

/** Each voice type's usual range (MIDI numbers), only as a guide. */
const VOICE_RANGES: Readonly<Record<VoiceType, readonly [number, number]>> = {
  [VoiceType.Bass]: [40, 64], // E2–E4
  [VoiceType.Baritone]: [45, 69], // A2–A4
  [VoiceType.Tenor]: [48, 72], // C3–C5
  [VoiceType.Alto]: [53, 77], // F3–F5
  [VoiceType.MezzoSoprano]: [57, 81], // A3–A5
  [VoiceType.Soprano]: [60, 84], // C4–C6
};

/** The voice type whose usual range is nearest, counting both ends. */
export function closestVoiceType(low: number, high: number): VoiceType {
  const distance = (type: VoiceType) =>
    Math.abs(VOICE_RANGES[type][0] - low) + Math.abs(VOICE_RANGES[type][1] - high);
  return Object.values(VoiceType).reduce((best, type) =>
    distance(type) < distance(best) ? type : best,
  );
}
