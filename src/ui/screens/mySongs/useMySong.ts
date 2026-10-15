import { useEffect, useState } from 'react';
import type { MySongRow } from '../../../storage/db';
import { getMySong } from '../../../storage/mySongs';
import { LoadStatus } from '../../loadStatus';

export type MySongState =
  | { status: typeof LoadStatus.Loading }
  | { status: typeof LoadStatus.Ready; song: MySongRow | null }
  | { status: typeof LoadStatus.Error };

/** An imported song by the id in the address (`song` is null when there's no such song). */
export function useMySong(idParam: string | undefined): MySongState {
  const id = Number(idParam);
  const valid = Number.isInteger(id);
  /** The last load, with the id it was for. */
  const [loaded, setLoaded] = useState<{ id: number; state: MySongState } | null>(null);

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    getMySong(id).then(
      (song) => {
        if (!cancelled) setLoaded({ id, state: { status: LoadStatus.Ready, song: song ?? null } });
      },
      (error: unknown) => {
        console.error(error);
        if (!cancelled) setLoaded({ id, state: { status: LoadStatus.Error } });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id, valid]);

  if (!valid) return { status: LoadStatus.Ready, song: null };
  return loaded?.id === id ? loaded.state : { status: LoadStatus.Loading };
}
