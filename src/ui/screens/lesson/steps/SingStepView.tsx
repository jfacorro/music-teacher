import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { SingStep } from '../../../../content/lessons';
import type { StepResult } from '../../../../content/lessons/result';
import { ScoreView, SheetNotation } from '../../../../content/lessons/lesson';
import { useNoteNames } from '../../../../i18n/useNoteNames';
import { SING_CENTS, SING_CENTS_STRICT, SingMode } from '../../../../engine/singing';
import { moveAccompaniment } from '../../../../engine/lyrics';
import { fitToRange } from '../../../../engine/transpose';
import { useSettings } from '../../../../storage/settings';
import { useMicWhileShown } from '../../../hooks';
import { NotationSelect, ViewToggle } from '../../practice/ViewToggle';
import { KeyNoteButton, MovableDoNote } from '../../singing/KeyNoteButton';
import { LyricsSelect } from '../../singing/lyrics';
import { useLyricsLanguage } from '../../singing/useLyricsLanguage';
import { singNotations, startNotation } from '../../singing/singNotation';
import { SingRun } from '../../singing/SingRun';
import { ShortcutButton } from '../../../components/ShortcutButton';
import { ShortcutKey } from '../../../shortcuts';

interface SingStepViewProps {
  step: SingStep;
  text: string;
  onResult: (result: StepResult, passed: boolean) => void;
  onContinue: () => void;
}

/** Sing a melody, moved into your range: waiting for each note, along, or after listening. */
export function SingStepView({ step, text, onResult, onContinue }: SingStepViewProps) {
  const { t } = useTranslation('screens');
  useMicWhileShown();
  const range = useSettings((s) => s.vocalRange);
  const fit = useMemo(() => (range ? fitToRange(step.score, range) : null), [step, range]);
  // A song's piano part, moved with its melody.
  const piano = useMemo(
    () => (fit ? moveAccompaniment(step.score, step.accompaniment, fit.semitones) : []),
    [step, fit],
  );
  const lyrics = useLyricsLanguage(step.score);
  const [accompanied, setAccompanied] = useState(true);
  const [view, setView] = useState(step.view);
  const { system } = useNoteNames();
  const [notation, setNotation] = useState(() => startNotation(system, step.notation));
  const [guide, setGuide] = useState(step.guide);
  const [metronome, setMetronome] = useState(step.metronome);
  const passes = (stars: number) => stars >= step.pass.minStars;

  if (!fit) {
    return (
      <div className="lesson__step">
        <p className="lesson__text">{text}</p>
        <p className="muted">
          {t('sing.noRange')} <Link to="/settings#voice">{t('tuner.findRange')}</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="lesson__step">
      <p className="lesson__text">{text}</p>
      <div className="practice__options">
        <ViewToggle view={view} onChange={setView} lane />
        {view === ScoreView.Sheet && (
          <NotationSelect
            notation={notation}
            onChange={setNotation}
            options={singNotations(system)}
          />
        )}
        <LyricsSelect score={step.score} />
        {step.mode !== SingMode.ListenFirst && (
          <label className="checkbox" title={t(`sing.guideTip.${step.mode}`)}>
            <input type="checkbox" checked={guide} onChange={(e) => setGuide(e.target.checked)} />
            {t('sing.guide')}
          </label>
        )}
        {step.mode === SingMode.Along && piano.length > 0 && (
          <label className="checkbox" title={t('voiceSongs.pianoTip')}>
            <input
              type="checkbox"
              checked={accompanied}
              onChange={(e) => setAccompanied(e.target.checked)}
            />
            {t('voiceSongs.piano')}
          </label>
        )}
        {step.mode !== SingMode.Wait && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={metronome}
              onChange={(e) => setMetronome(e.target.checked)}
            />
            {t('practice.metronome')}
          </label>
        )}
        {!guide && step.mode !== SingMode.ListenFirst && <KeyNoteButton score={fit.score} />}
        {step.pass.minStars > 0 && (
          <span className="muted">{t('lesson.passRule', { stars: step.pass.minStars })}</span>
        )}
        {step.strict && <span className="muted">{t('sing.strict')}</span>}
      </div>
      {view === ScoreView.Sheet && notation === SheetNotation.Syllables && (
        <MovableDoNote score={fit.score} />
      )}
      {!fit.fits && <p className="notice">{t('sing.beyondRange')}</p>}
      <SingRun
        // A new range or mode starts over.
        key={`${fit.semitones}:${step.mode}`}
        score={fit.score}
        mode={step.mode}
        cents={step.strict ? SING_CENTS_STRICT : SING_CENTS}
        octave={step.octave}
        guide={guide}
        metronome={metronome}
        view={view}
        notation={notation}
        {...(lyrics && { lyrics })}
        accompaniment={piano}
        accompanied={accompanied && piano.length > 0}
        onFinish={({ stars, accuracy }) => onResult({ stars, accuracy }, passes(stars))}
        resultsActions={(summary) =>
          passes(summary.stars) ? (
            <ShortcutButton
              shortcut={ShortcutKey.Enter}
              className="button button--primary"
              title={t('lesson.tips.continue')}
              onClick={onContinue}
            >
              {t('lesson.continue')}
            </ShortcutButton>
          ) : null
        }
      />
    </div>
  );
}
