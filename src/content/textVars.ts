/**
 * Variables in content text (lesson steps, course titles): a note, a chord or a scale. They're
 * named when the text is shown, in the user's naming system ("C major" / "Do mayor").
 */
import type { ChordQuality } from '../theory/chords';
import type { Pitch } from '../theory/pitch';

export const ScaleQuality = {
  Major: 'major',
} as const;
export type ScaleQuality = (typeof ScaleQuality)[keyof typeof ScaleQuality];

export interface ChordVar {
  /** The root, as written (its octave doesn't show). */
  chord: Pitch;
  quality: ChordQuality;
}

export interface ScaleVar {
  /** The first note, as written (its octave doesn't show). */
  scale: Pitch;
  quality: ScaleQuality;
}

export type TextVar = Pitch | ChordVar | ScaleVar;

export function isChordVar(value: TextVar): value is ChordVar {
  return 'chord' in value;
}

export function isScaleVar(value: TextVar): value is ScaleVar {
  return 'scale' in value;
}
