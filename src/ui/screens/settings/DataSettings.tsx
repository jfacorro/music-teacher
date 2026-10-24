import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_NAME } from '../../../appName';
import {
  type Backup,
  BackupError,
  backupFileName,
  exportBackup,
  importBackup,
  parseBackup,
} from '../../../storage/backup';
import { Modal } from '../../components/Modal';

const ImportProblem = {
  NotBackup: 'notBackup',
  Failed: 'failed',
} as const;
type ImportProblem = (typeof ImportProblem)[keyof typeof ImportProblem];

/**
 * Export everything to a file, or replace it with a file's contents: to keep a copy, or to
 * move between the browser and the desktop app (each keeps its own data).
 */
export function DataSettings() {
  const { t } = useTranslation('screens');
  const input = useRef<HTMLInputElement>(null);
  const headingId = useId();
  const [pending, setPending] = useState<Backup | null>(null);
  const [problem, setProblem] = useState<ImportProblem | null>(null);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    const backup = await exportBackup();
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(backup)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = backupFileName();
    link.click();
    URL.revokeObjectURL(url);
  };

  const read = async (file: File) => {
    setProblem(null);
    try {
      setPending(parseBackup(JSON.parse(await file.text())));
    } catch (error) {
      console.error('Not a backup', error);
      setProblem(
        error instanceof BackupError || error instanceof SyntaxError
          ? ImportProblem.NotBackup
          : ImportProblem.Failed,
      );
    }
  };

  const replace = async (backup: Backup) => {
    setBusy(true);
    try {
      await importBackup(backup);
      location.reload(); // start again from the imported settings and progress
    } catch (error) {
      console.error('Could not import', error);
      setProblem(ImportProblem.Failed);
      setPending(null);
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <h2>{t('settings.data.heading')}</h2>
      <p className="muted">{t('settings.data.intro')}</p>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void read(file);
        }}
      />
      <div className="button-row">
        <button
          type="button"
          className="button"
          title={t('settings.data.exportTip')}
          onClick={() => void download()}
        >
          {t('settings.data.export')}
        </button>
        <button
          type="button"
          className="button"
          title={t('settings.data.importTip')}
          onClick={() => input.current?.click()}
        >
          {t('settings.data.import')}
        </button>
      </div>
      {problem && (
        <p className="notice notice--problem" role="alert">
          {t(`settings.data.problems.${problem}`, { app: APP_NAME })}
        </p>
      )}
      {pending && (
        <Modal labelledBy={headingId} onClose={() => setPending(null)}>
          <h2 id={headingId}>{t('settings.data.confirmTitle')}</h2>
          <p>{t('settings.data.confirmText')}</p>
          <div className="button-row">
            <button
              type="button"
              className="button button--danger"
              disabled={busy}
              onClick={() => void replace(pending)}
            >
              {t('settings.data.replace')}
            </button>
            <button type="button" className="button" onClick={() => setPending(null)}>
              {t('settings.data.cancel')}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
