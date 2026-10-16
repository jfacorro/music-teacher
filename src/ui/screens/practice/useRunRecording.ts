import { useEffect, useRef, useState } from 'react';
import { audioIfReady, soundLeadMs, startAudio } from '../../../audio/audio';
import { scheduleAhead } from '../../../audio/lookAhead';
import { type RecordedNote, Recorder, type Recording } from '../../../engine/recording';
import {
  type HandFilter,
  type PracticeSession,
  PracticeMode,
  SessionStatus,
} from '../../../engine/session';
import { windowsFor } from '../../../engine/timing';
import type { Transport } from '../../../engine/transport';
import { subscribeNotes } from '../../../input/bus';
import { InputSource, NoteEventType } from '../../../input/types';
import { loadRecording, saveRecording } from '../../../storage/recordings';
import { useAnimationFrame } from '../../hooks';

/** Playback starts this many beats before the first note, and ends this long after the last. */
const PLAYBACK_MARGIN_BEATS = 1;
/** Notes released at once still sound this long. */
const SHORTEST_BEATS = 0.1;

interface RunRecordingOptions {
  /** Where the latest recording is kept; none: nothing is recorded. */
  key: string | undefined;
  session: PracticeSession;
  transport: Transport;
  mode: PracticeMode;
  hands: HandFilter;
}

export interface RunRecording {
  /** The latest finished run (this time, or kept from before). */
  recording: Recording | null;
  listening: boolean;
  /** Plays the recording back, in time with the music on screen. */
  listen: () => Promise<void>;
  stop: () => void;
  /** Keys sounding in the playback now. */
  playbackKeys: ReadonlySet<number>;
}

const NONE: ReadonlySet<number> = new Set();

/**
 * Records each run (PLAN.md milestone 4.2): the keys played, on the music's timeline. A
 * finished run replaces the kept recording; playing it back moves the music along with it.
 * Autoplay runs aren't recorded (the app plays them).
 */
export function useRunRecording({
  key,
  session,
  transport,
  mode,
  hands,
}: RunRecordingOptions): RunRecording {
  const [recording, setRecording] = useState<Recording | null>(null);
  const [listening, setListening] = useState(false);
  const [playbackKeys, setPlaybackKeys] = useState<ReadonlySet<number>>(NONE);
  const recorder = useRef<Recorder | null>(null);
  const playing = useRef(false);
  useEffect(() => {
    playing.current = listening;
  }, [listening]);
  // Leaving mid-playback silences it.
  useEffect(
    () => () => {
      if (!playing.current) return;
      transport.pause();
      audioIfReady()?.stopAccompaniment();
    },
    [transport],
  );
  const enabled = key !== undefined && mode !== PracticeMode.Autoplay;

  // The kept recording, unless this visit already has a newer one.
  useEffect(() => {
    if (!enabled || !key) return;
    let cancelled = false;
    void loadRecording(key).then((kept) => {
      if (!cancelled && kept) setRecording((current) => current ?? kept);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, key]);

  // A run starting from the beginning gets a fresh recorder; a finished run is kept, and so
  // is each time through a loop (which goes on until stopped).
  useEffect(() => {
    if (!enabled || !key) return;
    const keep = (notes: RecordedNote[]) => {
      if (notes.length === 0) return;
      const kept: Recording = {
        notes,
        tempo: transport.tempo,
        hands,
        from: session.musicStart,
        to: session.musicEnd,
        windows:
          mode === PracticeMode.Tempo ? windowsFor(notes[0]?.source ?? InputSource.Midi) : null,
      };
      setRecording(kept);
      void saveRecording(key, kept);
    };
    let { status, lastPass } = session.getState();
    return session.subscribe(() => {
      const state = session.getState();
      if (state.status === SessionStatus.Playing && status === SessionStatus.Ready) {
        recorder.current = new Recorder();
      }
      if (state.status === SessionStatus.Finished && status !== SessionStatus.Finished) {
        keep(recorder.current?.finish(transport.position()) ?? []);
        recorder.current = null;
      } else if (state.lastPass && state.lastPass !== lastPass && recorder.current) {
        keep(recorder.current.finish(session.musicEnd));
        recorder.current = new Recorder();
      }
      if (state.status === SessionStatus.Ready) recorder.current = null; // started over
      status = state.status;
      lastPass = state.lastPass;
    });
  }, [enabled, key, session, transport, mode, hands]);

  // Every key while the run is on, as the session read it (a microphone note heard an octave
  // off counts as the note expected): call after the session subscribes to the keys.
  useEffect(() => {
    if (!enabled) return;
    const read = new Map<number, number>();
    return subscribeNotes((event) => {
      const beat = transport.positionAt(event.time);
      if (event.type === NoteEventType.Off) {
        recorder.current?.release(read.get(event.pitch) ?? event.pitch, beat);
        read.delete(event.pitch);
        return;
      }
      const status = session.getState().status;
      if (status !== SessionStatus.Playing && status !== SessionStatus.Waiting) return;
      const pitch = session.displayPitch(event.pitch);
      read.set(event.pitch, pitch);
      recorder.current?.press(pitch, event.velocity, event.source, beat);
    });
  }, [enabled, session, transport]);

  // Playback: the recorded keys, on the music's timeline, with how hard they were played.
  useEffect(() => {
    if (!listening || !recording) return;
    return scheduleAhead(
      transport,
      (from, to) => {
        for (const note of recording.notes) {
          if (note.start > from && note.start <= to) {
            audioIfReady()?.accompany(
              note.pitch,
              transport.timeAt(note.start),
              transport.timeAt(Math.max(note.end, note.start + SHORTEST_BEATS)),
              note.velocity / 127,
            );
          }
        }
      },
      { leadMs: soundLeadMs },
    );
  }, [listening, recording, transport]);

  const end = recording
    ? Math.max(recording.to, ...recording.notes.map((note) => note.end)) + PLAYBACK_MARGIN_BEATS
    : 0;
  const stop = () => {
    transport.pause();
    audioIfReady()?.stopAccompaniment();
    setListening(false);
    setPlaybackKeys(NONE);
    // A run not started yet starts from its lead-in again.
    if (session.getState().status === SessionStatus.Ready) session.restart();
  };

  useAnimationFrame(() => {
    if (!listening || !recording) return;
    const beat = transport.position();
    // The end, or the music stopped some other way (starting over, choosing bars).
    if (beat >= end || !transport.playing) {
      stop();
      return;
    }
    const sounding = recording.notes
      .filter(
        (note) => note.start <= beat && beat < Math.max(note.end, note.start + SHORTEST_BEATS),
      )
      .map((note) => note.pitch);
    if (
      sounding.length !== playbackKeys.size ||
      sounding.some((pitch) => !playbackKeys.has(pitch))
    ) {
      setPlaybackKeys(new Set(sounding));
    }
  });

  const listen = async () => {
    if (!recording) return;
    await startAudio().catch((error: unknown) => console.warn('No audio', error));
    const first = Math.min(recording.from, ...recording.notes.map((note) => note.start));
    transport.pause();
    transport.seek(first - PLAYBACK_MARGIN_BEATS);
    transport.play();
    setListening(true);
  };

  return { recording, listening, listen, stop, playbackKeys };
}
