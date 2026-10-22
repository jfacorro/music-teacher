import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { findLesson } from '../../content/courses';
import { DAY_MS } from '../../content/review';
import { isSongId } from '../../content/songs';
import { type PracticeTarget, SuggestionKind } from '../../content/suggestions';
import { useContentText } from '../../i18n/useContentText';
import { useMySongs } from '../../storage/mySongs';
import { ResultKind, useProgress } from '../../storage/progress';
import {
  ensureTodayPlan,
  isDone,
  type PlanItem,
  suggestMore,
  useTodayPlan,
} from '../../storage/todayPlan';
import { barsParam } from '../barSelection';
import { isValueOf } from '../../lib/values';
import { DrillLevel } from '../../content/sightReading';
import { useDrillLevelName } from './sightReading/useDrillLevelName';
import { EarLevel } from '../../content/earTraining';
import { useEarLevelName } from './earTraining/useEarLevelName';

const CHECK = '✓';

/**
 * Where a suggestion leads: its lesson or song, with the bars to repeat for a weak spot, or a
 * drill at its level.
 */
function hrefOf(item: PlanItem): string {
  const { kind, id } = item.target;
  if (kind === ResultKind.Drill) return `/sight-reading?level=${id}`;
  if (kind === ResultKind.Ear) return `/ear-training?level=${id}`;
  const path =
    kind === ResultKind.Lesson
      ? `/lesson/${id}`
      : kind === ResultKind.MySong
        ? `/practice/my/${id}`
        : `/practice/${id}`;
  return item.bars ? `${path}?bars=${barsParam(item.bars)}` : path;
}

/** Whole days between when it was last played and when it was suggested. */
const daysSince = (item: PlanItem) =>
  Math.max(1, Math.floor((item.since - (item.lastPlayedAt ?? item.since)) / DAY_MS));

/** Today's practice on the home screen: a short session, ticked off as it's played. */
export function TodayCard() {
  const { t } = useTranslation('screens');
  const { t: ts } = useTranslation('songs');
  const courseText = useContentText('courses');
  const plan = useTodayPlan((s) => s.plan);
  const results = useProgress((s) => s.results);
  const mySongs = useMySongs((s) => s.songs);
  const [nothingMore, setNothingMore] = useState(false);
  const levelName = useDrillLevelName();
  const earLevelName = useEarLevelName();

  useEffect(() => ensureTodayPlan(), []);

  if (!plan || plan.items.length === 0) return null;

  const titleOf = ({ kind, id }: PracticeTarget) => {
    if (kind === ResultKind.Song) return isSongId(id) ? ts(`${id}.title`) : id;
    if (kind === ResultKind.Drill) {
      return isValueOf(DrillLevel, id) ? levelName(id) : t('sightReading.title');
    }
    if (kind === ResultKind.Ear) {
      return isValueOf(EarLevel, id) ? earLevelName(id) : t('earTraining.title');
    }
    if (kind === ResultKind.MySong) {
      return mySongs.find((song) => String(song.id) === id)?.title ?? t('progress.deletedSong');
    }
    const found = findLesson(id);
    return found ? courseText(`lessons.${id}`, found.lesson.titleVars) : id;
  };
  const detailOf = (item: PlanItem) => {
    switch (item.kind) {
      case SuggestionKind.Next:
        return t('today.details.next');
      case SuggestionKind.Review:
        return t('today.details.review', { days: daysSince(item) });
      case SuggestionKind.WeakSpot:
        return item.bars && item.bars.first !== item.bars.last
          ? t('today.details.weakBars', { first: item.bars.first + 1, last: item.bars.last + 1 })
          : t('today.details.weakBar', { bar: (item.bars?.first ?? 0) + 1 });
      case SuggestionKind.Song:
        return item.lastPlayedAt === undefined
          ? t('today.details.newSong')
          : t('today.details.song', { days: daysSince(item) });
      case SuggestionKind.Drill:
        return item.lastPlayedAt === undefined
          ? t('today.details.newDrill')
          : t('today.details.drill', { days: daysSince(item) });
      case SuggestionKind.Ear:
        return item.lastPlayedAt === undefined
          ? t('today.details.newEar')
          : t('today.details.ear', { days: daysSince(item) });
      case SuggestionKind.Skill:
        return t('today.details.skill', { skill: courseText(`skills.${item.skill ?? ''}`) });
    }
  };

  const done = plan.items.filter((item) => isDone(item, results)).length;
  const allDone = done === plan.items.length;

  return (
    <section className="card today" id="today" aria-labelledby="today-heading">
      <div className="today__header">
        <h2 id="today-heading">{t('today.title')}</h2>
        <span className="muted">{t('today.progress', { done, total: plan.items.length })}</span>
      </div>
      <p className="muted">{t('today.intro')}</p>
      <ol className="today__list">
        {plan.items.map((item) => {
          const finished = isDone(item, results);
          return (
            <li
              key={`${item.target.kind}:${item.target.id}`}
              className={finished ? 'is-done' : undefined}
            >
              <Link className="today__item" to={hrefOf(item)}>
                <span className="today__mark" aria-hidden="true">
                  {finished ? CHECK : null}
                </span>
                <span className="today__kind">{t(`today.kinds.${item.kind}`)}</span>
                <span className="today__title">{titleOf(item.target)}</span>
                <span className="today__detail">{detailOf(item)}</span>
                {finished && <span className="visually-hidden">{t('today.done')}</span>}
              </Link>
            </li>
          );
        })}
      </ol>
      {allDone && (
        <div className="today__footer">
          <p>{t('today.allDone')}</p>
          {nothingMore ? (
            <p className="muted">{t('today.nothingMore')}</p>
          ) : (
            <button
              type="button"
              className="button"
              title={t('today.moreTip')}
              onClick={() => setNothingMore(!suggestMore())}
            >
              {t('today.more')}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
