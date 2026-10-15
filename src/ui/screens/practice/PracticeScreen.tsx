import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { isSongId, loadSong, type SongId } from '../../../content/songs';
import type { Score } from '../../../engine/score';
import { ResultKind } from '../../../storage/progress';
import { PracticeView } from './PracticeView';
import { LoadStatus } from '../../loadStatus';

type LoadState =
  | { status: typeof LoadStatus.Loading }
  | { status: typeof LoadStatus.Ready; score: Score }
  | { status: typeof LoadStatus.Error };

export function PracticeScreen() {
  const { songId } = useParams();
  const { t } = useTranslation('screens');

  if (!isSongId(songId)) {
    return (
      <section className="screen">
        <p className="notice notice--problem">{t('practice.notFound')}</p>
        <Link to="/">{t('practice.backHome')}</Link>
      </section>
    );
  }
  return <SongLoader key={songId} songId={songId} />;
}

function SongLoader({ songId }: { songId: SongId }) {
  const { t } = useTranslation('screens');
  const { t: ts } = useTranslation('songs');
  const [state, setState] = useState<LoadState>({ status: LoadStatus.Loading });

  useEffect(() => {
    let cancelled = false;
    loadSong(songId).then(
      (score) => !cancelled && setState({ status: LoadStatus.Ready, score }),
      (error: unknown) => {
        console.error(error);
        if (!cancelled) setState({ status: LoadStatus.Error });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [songId]);

  if (state.status === LoadStatus.Loading) return null;
  if (state.status === LoadStatus.Error) {
    return (
      <section className="screen">
        <p className="notice notice--problem">{t('practice.loadError')}</p>
        <Link to="/">{t('practice.backHome')}</Link>
      </section>
    );
  }
  return (
    <PracticeView
      title={ts(`${songId}.title`)}
      composer={ts(`${songId}.composer`)}
      score={state.score}
      result={{ kind: ResultKind.Song, id: songId }}
    />
  );
}
