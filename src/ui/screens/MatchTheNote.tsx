/**
 * Match the note (PLAN.md milestone 6.1), on the Tuner page and in voice lessons: the app plays a
 * note from the saved range, and the singer sings it back and holds it in tune, in any octave.
 * Ten notes a run (on the Tuner), scored by the ones matched in time.
 */
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { audioIfReady, soundLeadMs, startAudio } from '../../audio/audio';
import {
  centsFrom,
  MATCH_CENTS,
  matchSummary,
  type MatchSummary,
  matchTargets,
  type NoteMatch,
  NoteMatcher,
} from '../../engine/matchNote';
import { AVERAGE_OF, exactPitch, IN_TUNE_CENTS, TRACE_MS } from '../../engine/tuner';
import { formatPercent } from '../../i18n/format';
import { useNoteNames } from '../../i18n/useNoteNames';
import { ignoreMicUntil, useMic } from '../../input/mic/micInput';
import { downloadBlob } from '../../input/mic/recording';
import { startVoiceRecording } from '../../input/mic/voiceRecording';
import { activityTimer, recordPracticeTime } from '../../storage/progress';
import { type VocalRange } from '../../engine/vocalRange';
import { useSettings } from '../../storage/settings';
import { pitchFromMidi } from '../../theory/pitch';
import { PitchLeanLine } from '../components/PitchLeanLine';
import { Stars } from '../components/Stars';
import { ICONS } from '../icons';
import { Needle, Trace, type TracePoint } from './TunerParts';
import { ShortcutButton } from '../components/ShortcutButton';
import { ShortcutKey } from '../shortcuts';

/** The exercise's id in saved results. */
export const MATCH_ID = 'matchNote';
/** How long each note is played (ms). */
const NOTE_MS = 1200;
/** The note starts this long after asking, so it's never cut (ms). */
const START_DELAY_MS = 150;
/** How long the app's piano keeps ringing for the microphone after the note (ms). */
const RING_MS = 600;
/** Pause on a matched note before the next one. */
const NEXT_NOTE_MS = 1200;

/** A note to work out instead of copy: what's played and said for it. */
export interface MatchClue {
  /** The note played. */
  play: number;
  /** What to sing. */
  prompt: string;
  /** The button that plays it again. */
  again: string;
}

interface MatchTheNoteProps {
  /** The note to sing, while there is one (to show on the range's keyboard). */
  onTarget?: (midi: number | null) => void;
  /** The notes of a run, from the range (by default, the whole range: `matchTargets`). */
  pick?: (range: VocalRange) => number[];
  /** A run is over: how it went, and how long it took (ms). */
  onFinish?: (summary: MatchSummary, durationMs: number) => void;
  /** More buttons beside Retry on the results (e.g. Continue in a lesson). */
  actions?: (summary: MatchSummary) => ReactNode;
  /** The card's title (Match the note by default). */
  title?: string;
  /** What to do, before starting (the Tuner's explanation by default). */
  intro?: string;
  /**
   * Each note's clue, by its place in the run: the note isn't played or named, and the tuner shows
   * only how far off the singing is.
   */
  clue?: (index: number) => MatchClue;
  /**
   * Show the tuner's needle and line against the note to sing (in lessons; the Tuner page has its
   * own above the card).
   */
  tuner?: boolean;
}

export function MatchTheNote({
  onTarget,
  pick,
  onFinish,
  actions,
  title,
  intro,
  clue,
  tuner = false,
}: MatchTheNoteProps) {
  const { t, i18n } = useTranslation('screens');
  const names = useNoteNames();
  const range = useSettings((s) => s.vocalRange);
  const [targets, setTargets] = useState<number[]>([]);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<NoteMatch[]>([]);
  /** The note is being played: the microphone waits. */
  const [sounding, setSounding] = useState(false);
  const [held, setHeld] = useState(0);
  const [matched, setMatched] = useState(false);
  const [late, setLate] = useState(false);
  /** How far off what's being sung is, in cents from the note (averaged), or null. */
  const [off, setOff] = useState<number | null>(null);
  /** The last few seconds of singing, for the tuner's line. */
  const [trace, setTrace] = useState<TracePoint[]>([]);
  const matcher = useRef<NoteMatcher | null>(null);
  const listenFrom = useRef(0);
  const soundTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const nextTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const startedAt = useRef(0);
  /** The run's audio, to save as a recording for tuning how singing is judged. */
  const recorder = useRef<ReturnType<typeof startVoiceRecording> | null>(null);

  const target = targets[index];
  const running = target !== undefined;
  const finished = targets.length > 0 && !running;
  const summary = finished ? matchSummary(done) : null;
  const noteName = (midi: number) => names.name(pitchFromMidi(midi), { octave: true });

  useEffect(() => onTarget?.(running ? target : null), [running, target, onTarget]);

  const play = async (midi: number) => {
    // Nothing counts until the note has been heard.
    listenFrom.current = Infinity;
    const engine = await startAudio().catch((error: unknown) => {
      console.warn('No audio', error);
      return null;
    });
    if (!engine) {
      listenFrom.current = performance.now();
      matcher.current?.listen(listenFrom.current);
      return;
    }
    engine.stopAccompaniment();
    const start = performance.now() + START_DELAY_MS + soundLeadMs();
    engine.accompany(midi, start, start + NOTE_MS);
    const until = start + NOTE_MS + engine.outputDelayMs() + RING_MS;
    ignoreMicUntil(until);
    listenFrom.current = until;
    matcher.current?.listen(until);
    setSounding(true);
    setOff(null);
    clearTimeout(soundTimer.current);
    soundTimer.current = setTimeout(() => setSounding(false), until - performance.now());
  };
  useEffect(
    () => () => {
      clearTimeout(soundTimer.current);
      clearTimeout(nextTimer.current);
      recorder.current?.stop();
      audioIfReady()?.stopAccompaniment();
    },
    [],
  );

  const ask = (midi: number, at: number) => {
    matcher.current = new NoteMatcher(midi);
    setTrace([]);
    setHeld(0);
    setMatched(false);
    setLate(false);
    void play(clue?.(at).play ?? midi);
  };

  const begin = () => {
    if (!range) return;
    const fresh = pick ? pick(range) : matchTargets(range);
    startedAt.current = performance.now();
    recorder.current?.stop();
    recorder.current = startVoiceRecording(useMic.getState().gateDb);
    setTargets(fresh);
    setIndex(0);
    setDone([]);
    ask(fresh[0]!, 0);
  };

  const next = () => {
    const current = matcher.current;
    if (!current) return;
    matcher.current = null;
    const result = current.result();
    const now = performance.now();
    recorder.current?.note(
      { target: result.target, matched: current.matched, inTime: result.inTime },
      Math.min(listenFrom.current, now),
      now,
    );
    const results = [...done, result];
    setDone(results);
    setIndex((i) => i + 1);
    const following = targets[index + 1];
    if (following !== undefined) {
      ask(following, index + 1);
      return;
    }
    recorder.current?.stop();
    onFinish?.(matchSummary(results), performance.now() - startedAt.current);
  };
  const nextRef = useRef(next);
  useEffect(() => {
    nextRef.current = next;
  });

  // The singing, once the note has been heard; a match moves on by itself.
  useEffect(() => {
    if (!running) return;
    const recent: number[] = [];
    const timer = activityTimer();
    const unsubscribe = useMic.subscribe(({ reading }) => {
      const now = performance.now();
      const current = matcher.current;
      if (!current || current.matched) return;
      if (now < listenFrom.current) {
        recent.length = 0;
        return;
      }
      const pitch = reading ? exactPitch(reading) : null;
      if (pitch === null) recent.length = 0;
      else {
        timer.activity();
        recent.push(pitch);
        if (recent.length > AVERAGE_OF) recent.shift();
      }
      if (tuner) {
        setTrace((previous) => [
          ...previous.filter((point) => now - point.time <= TRACE_MS),
          { time: now, pitch },
        ]);
      }
      const average = recent.reduce((sum, value) => sum + value, 0) / recent.length;
      setOff(recent.length === 0 ? null : centsFrom(current.target, average));
      setHeld(current.update(pitch, now));
      setLate(!current.inTime(now));
      if (current.matched) {
        setMatched(true);
        nextTimer.current = setTimeout(() => nextRef.current(), NEXT_NOTE_MS);
      }
    });
    return () => {
      unsubscribe();
      void recordPracticeTime(timer.stop());
    };
  }, [running, tuner]);

  if (!range) {
    return (
      <div className="card match">
        <h2>{t('tuner.match.title')}</h2>
        <p className="muted">
          {t('tuner.match.noRange')} <Link to="/settings#voice">{t('tuner.findRange')}</Link>
        </p>
      </div>
    );
  }

  if (summary) {
    const how = (note: NoteMatch) =>
      note.inTime
        ? t(note.offset! > 0 ? 'tuner.sharp' : 'tuner.flat', { cents: Math.abs(note.offset!) })
        : note.offset === null || Math.abs(note.offset) <= IN_TUNE_CENTS
          ? t('tuner.match.notInTime')
          : t(note.offset > 0 ? 'tuner.match.notInTimeHigh' : 'tuner.match.notInTimeLow');
    return (
      <section className="card match match--results" aria-labelledby="match-results">
        <h2 id="match-results">{t('tuner.match.results')}</h2>
        <Stars stars={summary.stars} />
        <p className="results__accuracy">
          <span className="muted">{t('practice.results.accuracy')}</span>
          <strong>{formatPercent(summary.accuracy, i18n.language)}</strong>
        </p>
        <p>{t('tuner.match.matchedCount', { count: summary.matched, total: summary.total })}</p>
        <PitchLeanLine lean={summary.lean} />
        {summary.toWorkOn.length === 0 ? (
          <p>{t('tuner.match.allGood')}</p>
        ) : (
          <>
            <h3>{t('tuner.match.toWorkOn')}</h3>
            <ul className="match__work-on">
              {summary.toWorkOn.map((note) => (
                <li key={note.target}>
                  {t('tuner.match.workOn', { note: noteName(note.target), how: how(note) })}
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="button-row">
          <ShortcutButton
            shortcut={ShortcutKey.Space}
            className="button button--primary"
            onClick={begin}
          >
            {t('practice.results.retry')}
          </ShortcutButton>
          <button
            type="button"
            className="button"
            title={t('tuner.match.saveTip')}
            onClick={() => {
              const file = recorder.current?.save();
              const name = `voice-match-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}`;
              if (file) downloadBlob(file, `${name}.wav`);
            }}
          >
            {t('tuner.match.save')}
          </button>
          {actions?.(summary)}
        </div>
      </section>
    );
  }

  if (!running) {
    return (
      <div className="card match">
        <h2>{title ?? t('tuner.match.title')}</h2>
        <p className="muted">{intro ?? t('tuner.match.intro')}</p>
        <div className="button-row">
          <ShortcutButton
            shortcut={ShortcutKey.Enter}
            className="button button--primary"
            onClick={begin}
          >
            <span className="button__icon" aria-hidden="true">
              {ICONS.listen}
            </span>
            {t('tuner.match.begin')}
          </ShortcutButton>
        </div>
      </div>
    );
  }

  const asked = clue?.(index);
  const message = sounding
    ? t('tuner.match.listen')
    : matched
      ? late
        ? t('tuner.match.matchedLate')
        : t('tuner.match.matched')
      : late
        ? t('tuner.match.late')
        : off === null
          ? asked
            ? t('lesson.build.sing')
            : t('tuner.match.sing')
          : Math.abs(off) <= MATCH_CENTS
            ? t('tuner.match.hold')
            : off < 0
              ? t('tuner.match.higher')
              : t('tuner.match.lower');

  return (
    <div className="card match">
      <h2>{asked?.prompt ?? title ?? t('tuner.match.title')}</h2>
      <p className="muted">
        {t('tuner.match.progress', { current: index + 1, total: targets.length })}
      </p>
      <div className="match__live">
        <div className="match__note">
          {!asked && <strong>{noteName(target)}</strong>}
          <span className="hold-bar">
            <span style={{ inlineSize: `${Math.round(held * 100)}%` }} />
          </span>
        </div>
        <p
          className={
            matched && !late
              ? 'notice notice--ok'
              : late && !matched
                ? 'notice notice--problem'
                : 'match__message'
          }
          role="status"
        >
          {message}
        </p>
      </div>
      {tuner && (
        <div className="match__tuner">
          {off !== null && <Needle cents={off} zone={MATCH_CENTS} span={2 * MATCH_CENTS} />}
          {!asked && (
            <Trace
              points={trace}
              around={target}
              labelFor={(midi) => names.name(pitchFromMidi(midi), { octave: false })}
            />
          )}
        </div>
      )}
      <div className="button-row">
        <ShortcutButton
          shortcut={ShortcutKey.Space}
          className="button"
          disabled={sounding || matched}
          onClick={() => void play(asked?.play ?? target)}
        >
          <span className="button__icon" aria-hidden="true">
            {ICONS.volume}
          </span>
          {asked?.again ?? t('tuner.match.hearAgain')}
        </ShortcutButton>
        <button type="button" className="button" disabled={sounding || matched} onClick={next}>
          {t('tuner.match.skip')}
        </button>
      </div>
    </div>
  );
}
