import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { importedScore } from '../../../content/loaders/importedScore';
import type { MySongRow } from '../../../storage/db';
import { ResultKind } from '../../../storage/progress';
import { ICONS } from '../../icons';
import { LoadStatus } from '../../loadStatus';
import { PracticeView } from '../practice/PracticeView';
import { useMySong } from './useMySong';

/** Practicing an imported song: the same tools as the built-in songs. */
export function MySongPracticeScreen() {
  const { songId } = useParams();
  const state = useMySong(songId);
  const { t } = useTranslation('screens');

  if (state.status === LoadStatus.Loading) return null;
  if (state.status === LoadStatus.Error || state.song?.id === undefined) {
    return (
      <section className="screen">
        <p className="notice notice--problem">
          {state.status === LoadStatus.Error ? t('mySongs.loadError') : t('mySongs.notFound')}
        </p>
        <Link to="/">{t('mySongs.backHome')}</Link>
      </section>
    );
  }
  return <MySongPractice key={state.song.id} song={state.song} id={state.song.id} />;
}

function MySongPractice({ song, id }: { song: MySongRow; id: number }) {
  const { t } = useTranslation('screens');
  const { score } = useMemo(() => importedScore(song.music, song.options), [song]);
  const settings = (
    <Link className="button" to={`/my-songs/${id}`} title={t('practice.songSettingsTip')}>
      <span className="button__icon" aria-hidden="true">
        {ICONS.settings}
      </span>
      {t('practice.songSettings')}
    </Link>
  );

  if (!score) {
    return (
      <section className="screen">
        <h1>{song.title}</h1>
        <p className="notice notice--problem">{t('practice.noNotes')}</p>
        {settings}
      </section>
    );
  }
  return (
    <PracticeView
      title={song.title}
      composer={song.composer}
      score={score}
      result={{ kind: ResultKind.MySong, id: String(id) }}
      actions={settings}
    />
  );
}
