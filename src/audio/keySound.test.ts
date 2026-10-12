import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emitNote, setActiveSources } from '../input/bus';
import { useInstrument } from '../input/routing';
import { noteOff, noteOn } from '../engine/testUtils';
import { useSettings } from '../storage/settings';
import { startKeySound } from './keySound';

const audio = vi.hoisted(() => ({ noteOn: vi.fn(), noteOff: vi.fn(), click: vi.fn() }));
vi.mock('./audio', () => ({ startAudio: () => Promise.resolve(audio) }));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('startKeySound', () => {
  let stop: () => void;
  beforeEach(() => {
    vi.clearAllMocks();
    setActiveSources(() => true);
    useSettings.setState({ keySound: true });
    useInstrument.setState({ instrument: null });
    stop = startKeySound();
  });
  afterEach(() => stop());

  it('plays the computer and on-screen keyboards', async () => {
    emitNote(noteOn(60, 0, 'dev'));
    emitNote(noteOn(64, 0, 'screen'));
    emitNote(noteOff(60, 10, 'dev'));
    await flush();
    expect(audio.noteOn.mock.calls).toEqual([
      [60, 100],
      [64, 100],
    ]);
    expect(audio.noteOff.mock.calls).toEqual([[60]]);
  });

  it('leaves MIDI and microphone notes silent', async () => {
    emitNote(noteOn(60, 0, 'midi'));
    emitNote(noteOn(62, 0, 'mic'));
    await flush();
    expect(audio.noteOn).not.toHaveBeenCalled();
  });

  it('stays silent when turned off or while listening through the microphone', async () => {
    useSettings.setState({ keySound: false });
    emitNote(noteOn(60, 0, 'dev'));
    useSettings.setState({ keySound: true });
    useInstrument.setState({ instrument: 'mic' });
    emitNote(noteOn(62, 0, 'dev'));
    emitNote(noteOff(62, 0, 'dev'));
    await flush();
    expect(audio.noteOn).not.toHaveBeenCalled();
    expect(audio.noteOff).not.toHaveBeenCalled();
  });
});
