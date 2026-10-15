import { useTranslation } from 'react-i18next';
import {
  DYNAMIC_BANDS,
  type DynamicsSummary,
  HairpinKind,
  type HairpinResult,
  Loudness,
  type PassageResult,
} from '../../../engine/dynamics';
import { markingText } from '../../../engine/markings';
import { LoudnessMeter } from '../../components/LoudnessMeter';

/** Results: each loud or soft passage and each crescendo or diminuendo, as played. */
export function DynamicsBreakdown({ dynamics }: { dynamics: DynamicsSummary }) {
  const { t } = useTranslation('screens');
  const { t: tTheory } = useTranslation('theory');
  return (
    <section className="dynamics-results">
      <h3>{t('practice.dynamics.heading')}</h3>
      <ul className="dynamics-results__list">
        {dynamics.passages.map((passage, index) => (
          <li key={`p${index}`} className="dynamics-results__item">
            <span className="dynamics-results__mark" title={tTheory(`markings.${passage.dynamic}`)}>
              {markingText(passage.dynamic)}
            </span>
            <span className="muted">{t('practice.dynamics.bar', { bar: passage.bar + 1 })}</span>
            <LoudnessMeter band={DYNAMIC_BANDS[passage.dynamic]} values={[passage.velocity]} />
            <Verdict ok={passage.ok} text={passageVerdict(passage, t)} />
          </li>
        ))}
        {dynamics.hairpins.map((hairpin, index) => (
          <li key={`h${index}`} className="dynamics-results__item">
            <span className="dynamics-results__mark" title={tTheory(`markings.${hairpin.kind}`)}>
              {t(`practice.dynamics.short.${hairpin.kind}`)}
            </span>
            <span className="muted">
              {hairpin.firstBar === hairpin.lastBar
                ? t('practice.dynamics.bar', { bar: hairpin.firstBar + 1 })
                : t('practice.dynamics.bars', {
                    first: hairpin.firstBar + 1,
                    last: hairpin.lastBar + 1,
                  })}
            </span>
            <LoudnessMeter values={[hairpin.from, hairpin.to]} />
            <Verdict ok={hairpin.ok} text={hairpinVerdict(hairpin, t)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

type T = ReturnType<typeof useTranslation<'screens'>>['t'];

function passageVerdict(passage: PassageResult, t: T): string {
  if (passage.ok) return t('practice.dynamics.right');
  return passage.loudness === Loudness.TooSoft
    ? t('practice.dynamics.tooSoft')
    : t('practice.dynamics.tooLoud');
}

function hairpinVerdict(hairpin: HairpinResult, t: T): string {
  if (hairpin.kind === HairpinKind.Crescendo) {
    return hairpin.ok ? t('practice.dynamics.louder') : t('practice.dynamics.notLouder');
  }
  return hairpin.ok ? t('practice.dynamics.softer') : t('practice.dynamics.notSofter');
}

function Verdict({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span className={ok ? 'dynamics-results__verdict is-ok' : 'dynamics-results__verdict'}>
      {text}
    </span>
  );
}
