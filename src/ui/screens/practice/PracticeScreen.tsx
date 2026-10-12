import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { isSongId, loadSong, type SongId } from '../../../content/songs';
import type { Score } from '../../../engine/score';
import { PracticeView } from './PracticeView';

type LoadState = { status: 'loading' } | { status: 'ready'; score: Score } | { status: 'error' };

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
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    loadSong(songId).then(
      (score) => !cancelled && setState({ status: 'ready', score }),
      (error: unknown) => {
        console.error(error);
        if (!cancelled) setState({ status: 'error' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [songId]);

  if (state.status === 'loading') return null;
  if (state.status === 'error') {
    return (
      <section className="screen">
        <p className="notice notice--problem">{t('practice.loadError')}</p>
        <Link to="/">{t('practice.backHome')}</Link>
      </section>
    );
  }
  return <PracticeView songId={songId} score={state.score} />;
}
