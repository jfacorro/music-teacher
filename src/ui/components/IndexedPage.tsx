import {
  Fragment,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';

/** A section of the page: an element with this id, and its name in the index. */
export interface IndexItem {
  id: string;
  label: string;
}

/** Sections listed together, under a heading or (without one) on their own. */
export interface IndexGroup {
  heading?: string;
  items: readonly IndexItem[];
}

const jump = (id: string) => {
  const element = document.getElementById(id);
  // A folded section (e.g. a finished unit on Learn) opens, so what's in it shows; any other
  // opened one folds back, so at most one is open.
  for (const other of document.querySelectorAll<HTMLDetailsElement>(
    '.page-layout__content details[open]',
  )) {
    if (other !== element) other.open = false;
  }
  if (element instanceof HTMLDetailsElement) element.open = true;
  element?.scrollIntoView({ block: 'start' });
};

const scrollMargin = (element: Element) =>
  parseFloat(getComputedStyle(element).scrollMarginBlockStart) || 0;

/**
 * The sections showing (one can show nothing, like Settings' microphone check without a
 * microphone) and the one scrolled to: the last whose top is under the top bar. It also sizes
 * the room after the content, so the last section too can scroll up to the top bar.
 */
function useSections(
  ids: readonly string[],
  content: RefObject<HTMLElement | null>,
  room: RefObject<HTMLElement | null>,
) {
  const [state, setState] = useState<{
    shown: readonly string[];
    current: string | null;
    /** The room after the content, px. */
    room: number;
  }>({ shown: ids, current: null, room: 0 });
  const update = useCallback(() => {
    const elements = ids.flatMap((id) => {
      const element = document.getElementById(id);
      return element && element.childElementCount > 0 ? [element] : [];
    });
    const last = elements.at(-1);
    const end = room.current;
    let needed = 0;
    if (last && end) {
      const main = end.closest('main');
      const padding = main ? parseFloat(getComputedStyle(main).paddingBlockEnd) || 0 : 0;
      const below = end.getBoundingClientRect().top - last.getBoundingClientRect().top;
      needed = Math.max(0, Math.floor(window.innerHeight - scrollMargin(last) - below - padding));
    }
    const passed = elements.filter(
      (element) => element.getBoundingClientRect().top <= scrollMargin(element) + 1,
    );
    const shown = elements.map((element) => element.id);
    const current = (passed.at(-1) ?? elements[0])?.id ?? null;
    setState((previous) =>
      previous.current === current &&
      previous.room === needed &&
      previous.shown.join() === shown.join()
        ? previous
        : { shown, current, room: needed },
    );
  }, [ids, room]);
  useEffect(() => {
    // Once the sections are on the page.
    const first = setTimeout(update);
    const changes = new MutationObserver(update);
    if (content.current) changes.observe(content.current, { childList: true, subtree: true });
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      clearTimeout(first);
      changes.disconnect();
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [content, update]);
  // A jump updates it right away, without waiting for the scroll event.
  return { ...state, refresh: update };
}

/**
 * A page with an index of its sections beside it: it follows the scroll, highlighting the
 * section under the top bar, and a click jumps to one. Without room beside the content, it's a
 * "Jump to" menu at the top instead. A link to a section (`/settings#sound`) shows it.
 */
export function IndexedPage({
  groups,
  children,
}: {
  groups: readonly IndexGroup[];
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { hash } = useLocation();
  const content = useRef<HTMLDivElement>(null);
  const room = useRef<HTMLDivElement>(null);
  // The same sections keep the same list, even when the groups are built again.
  const idsKey = groups.flatMap((group) => group.items.map((item) => item.id)).join(' ');
  const ids = useMemo(() => idsKey.split(' '), [idsKey]);
  const { shown, current, room: roomPx, refresh } = useSections(ids, content, room);
  const go = (id: string) => {
    jump(id);
    refresh();
  };
  useEffect(() => {
    if (hash) jump(hash.slice(1));
  }, [hash]);

  const shownItems = (group: IndexGroup) => group.items.filter((item) => shown.includes(item.id));

  return (
    <>
      <label className="page-jump">
        <span>{t('pageIndex.jumpTo')}</span>
        <select value={current ?? ''} onChange={(event) => go(event.target.value)}>
          {groups.map((group, index) => {
            const options = shownItems(group).map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ));
            return group.heading ? (
              <optgroup key={index} label={group.heading}>
                {options}
              </optgroup>
            ) : (
              <Fragment key={index}>{options}</Fragment>
            );
          })}
        </select>
      </label>
      <div className="page-layout">
        <div className="page-layout__content" ref={content}>
          {children}
          <div ref={room} aria-hidden="true" style={{ blockSize: roomPx }} />
        </div>
        <nav className="page-index" aria-label={t('pageIndex.label')}>
          {groups.map((group, index) => (
            <Fragment key={index}>
              {group.heading && <p className="page-index__group">{group.heading}</p>}
              {shownItems(group).map((item, i) => (
                <a
                  key={item.id}
                  // A group without a heading: spaced like one.
                  className={
                    !group.heading && i === 0 && index > 0 ? 'page-index__alone' : undefined
                  }
                  // Long names are cut short: the whole name on hover.
                  title={item.label}
                  href={`#${item.id}`}
                  aria-current={item.id === current ? 'true' : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    go(item.id);
                  }}
                >
                  {item.label}
                </a>
              ))}
            </Fragment>
          ))}
        </nav>
      </div>
    </>
  );
}
