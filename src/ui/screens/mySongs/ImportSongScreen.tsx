import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import {
  type ImportedMusic,
  ImportError,
  ImportErrorCode,
} from '../../../content/loaders/importedMusic';
import { defaultImportOptions } from '../../../content/loaders/importedScore';
import { IMPORT_FILE_TYPES, readMusicFile } from '../../../content/loaders/importFile';
import { addMySong } from '../../../storage/mySongs';
import { SongSetup } from './SongSetup';

interface ReadFile {
  music: ImportedMusic;
  fileName: string;
}

/** Choose a MIDI or MusicXML file, then set it up for practice and save it to My songs. */
export function ImportSongScreen() {
  const { t } = useTranslation('screens');
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<ReadFile | null>(null);
  const [error, setError] = useState<ImportErrorCode | null>(null);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const read = async (chosen: File) => {
    setReading(true);
    setError(null);
    try {
      setFile({ music: await readMusicFile(chosen), fileName: chosen.name });
    } catch (problem) {
      console.error('Could not import', chosen.name, problem);
      setError(problem instanceof ImportError ? problem.code : ImportErrorCode.Unreadable);
    } finally {
      setReading(false);
    }
  };

  if (file) {
    return (
      <section className="screen">
        <h1>{t('mySongs.setup.importTitle')}</h1>
        <SongSetup
          music={file.music}
          fileName={file.fileName}
          initial={{
            title: file.music.title ?? file.fileName,
            composer: file.music.composer,
            options: defaultImportOptions(file.music),
          }}
          saveLabel={t('mySongs.setup.saveAndPractice')}
          cancelLabel={t('mySongs.setup.chooseAnother')}
          onCancel={() => setFile(null)}
          onSave={async (details) => {
            const id = await addMySong({ ...details, fileName: file.fileName, music: file.music });
            await navigate(`/practice/my/${id}`);
          }}
        />
      </section>
    );
  }

  return (
    <section className="screen">
      <h1>{t('mySongs.import.title')}</h1>
      <div
        className={dragging ? 'card drop-zone is-dragging' : 'card drop-zone'}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const dropped = event.dataTransfer.files[0];
          if (dropped) void read(dropped);
        }}
      >
        <p>{t('mySongs.import.intro')}</p>
        <input
          ref={input}
          type="file"
          accept={IMPORT_FILE_TYPES}
          hidden
          onChange={(event) => {
            const chosen = event.target.files?.[0];
            event.target.value = ''; // choosing the same file again still counts
            if (chosen) void read(chosen);
          }}
        />
        <div className="button-row">
          <button
            type="button"
            className="button button--primary"
            disabled={reading}
            onClick={() => input.current?.click()}
          >
            {t('mySongs.import.choose')}
          </button>
        </div>
        <p className="muted">{reading ? t('mySongs.import.reading') : t('mySongs.import.drop')}</p>
        {error && (
          <p className="notice notice--problem" role="alert">
            {t(`mySongs.import.errors.${error}`)}
          </p>
        )}
      </div>
      <p>
        <Link to="/learn">{t('mySongs.backHome')}</Link>
      </p>
    </section>
  );
}
