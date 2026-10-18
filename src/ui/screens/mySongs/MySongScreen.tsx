import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import type { MySongRow } from '../../../storage/db';
import { deleteMySong, updateMySong } from '../../../storage/mySongs';
import { Modal } from '../../components/Modal';
import { LoadStatus } from '../../loadStatus';
import { useTopBarDetail } from '../../topBar';
import { SongSetup } from './SongSetup';
import { useMySong } from './useMySong';

/** An imported song's settings: title, hands, transposition and tempo; or delete it. */
export function MySongScreen() {
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
        <Link to="/songs">{t('mySongs.backHome')}</Link>
      </section>
    );
  }
  return <SongSettings key={state.song.id} song={state.song} id={state.song.id} />;
}

function SongSettings({ song, id }: { song: MySongRow; id: number }) {
  const { t } = useTranslation('screens');
  const navigate = useNavigate();
  const headingId = useId();
  const [confirming, setConfirming] = useState(false);
  const practice = `/practice/my/${id}`;
  useTopBarDetail(song.title);

  return (
    <section className="screen">
      <h1>{t('mySongs.setup.editTitle')}</h1>
      <SongSetup
        music={song.music}
        fileName={song.fileName}
        initial={song}
        saveLabel={t('mySongs.setup.save')}
        cancelLabel={t('mySongs.setup.cancel')}
        onCancel={() => void navigate(practice)}
        onSave={async (details) => {
          await updateMySong(id, details);
          await navigate(practice);
        }}
      >
        <button type="button" className="button button--danger" onClick={() => setConfirming(true)}>
          {t('mySongs.setup.delete')}
        </button>
      </SongSetup>

      {confirming && (
        <Modal labelledBy={headingId} onClose={() => setConfirming(false)}>
          <h2 id={headingId}>{t('mySongs.setup.deleteTitle', { title: song.title })}</h2>
          <p>{t('mySongs.setup.deleteText')}</p>
          <div className="button-row">
            <button
              type="button"
              className="button button--danger"
              onClick={async () => {
                await deleteMySong(id);
                await navigate('/songs');
              }}
            >
              {t('mySongs.setup.deleteConfirm')}
            </button>
            <button type="button" className="button" onClick={() => setConfirming(false)}>
              {t('mySongs.setup.keep')}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
