/**
 * What the page on screen adds after its section in the top bar, e.g. "Learn / Unit 9 · Staccato"
 * or "Song practice / Can-Can"; the browser tab's title follows it.
 */
import { useEffect } from 'react';
import { create } from 'zustand';

export const useTopBar = create<{ detail: string | null }>(() => ({ detail: null }));

/** Shows `detail` after the section in the top bar while the calling page is on screen. */
export function useTopBarDetail(detail: string | null): void {
  useEffect(() => {
    useTopBar.setState({ detail });
    return () => useTopBar.setState({ detail: null });
  }, [detail]);
}
