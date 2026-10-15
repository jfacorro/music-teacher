import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { type LessonState, LessonStatus } from '../../content/unlock';
import { Stars } from './Stars';
import { StarsSize } from './starsSize';

const CHECK = '✓';

/** One lesson or song in a list: done (✓), open, or locked, with its best stars. */
export function PathItem({
  title,
  href,
  state,
  current = false,
}: {
  title: string;
  href: string;
  state: LessonState;
  current?: boolean;
}) {
  const { t } = useTranslation('screens');
  const className = `path__item path__item--${state.status}${current ? ' is-current' : ''}`;
  return (
    <li className={className}>
      <span className="path__marker" aria-hidden="true">
        {state.status === LessonStatus.Completed ? (
          CHECK
        ) : state.status === LessonStatus.Locked ? (
          <LockIcon />
        ) : null}
      </span>
      {state.status === LessonStatus.Locked ? (
        <span className="path__title">
          {title}
          <span className="visually-hidden">{t('home.locked')}</span>
        </span>
      ) : (
        <Link className="path__title" to={href}>
          {title}
        </Link>
      )}
      {state.stars > 0 && <Stars stars={state.stars} size={StarsSize.Small} />}
    </li>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
      <path d="M8 1a3.5 3.5 0 0 0-3.5 3.5V7H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-.5V4.5A3.5 3.5 0 0 0 8 1Zm2 6H6V4.5a2 2 0 1 1 4 0V7Z" />
    </svg>
  );
}
