import { useTranslation } from 'react-i18next';
import type { KeyMark } from '../../engine/session';
import { screenKeyDown, screenKeyUp } from '../../input/dev/screenInput';

interface TapPadProps {
  /** The key a tap plays (rhythm exercises count any key). */
  pitch: number;
  /** A note is due now. */
  due: boolean;
  pressed: boolean;
  mark?: KeyMark;
}

/** One big key for rhythm exercises, in place of the keyboard: tap it, or any key. */
export function TapPad({ pitch, due, pressed, mark }: TapPadProps) {
  const { t } = useTranslation('screens');
  const className = ['tap-pad', due && 'is-due', pressed && 'is-pressed', mark && `is-${mark}`]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={className}
      // Taps come from the pointer; keyboard users tap any key, and Space stays play/pause.
      tabIndex={-1}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        screenKeyDown(pitch, event.timeStamp);
      }}
      onPointerUp={(event) => screenKeyUp(pitch, event.timeStamp)}
      onPointerCancel={(event) => screenKeyUp(pitch, event.timeStamp)}
    >
      {t('practice.tap')}
    </button>
  );
}
