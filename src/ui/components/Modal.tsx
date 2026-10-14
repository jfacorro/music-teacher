import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface ModalProps {
  /** The id of the element that names the dialog (usually its heading). */
  labelledBy: string;
  /** Called when the learner closes it: the close button, Escape, or a click outside. */
  onClose: () => void;
  children: ReactNode;
}

/**
 * A window floating over the page, with the rest dimmed: the browser's modal dialog, so focus
 * stays inside and Escape closes it.
 */
export function Modal({ labelledBy, onClose, children }: ModalProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    // Start on the dialog itself, not on its first button, so no key presses one by accident.
    dialog.focus();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={labelledBy}
      tabIndex={-1}
      onCancel={(event) => {
        event.preventDefault(); // the parent decides when it goes away
        onClose();
      }}
      // A click on the dimmed backdrop lands on the dialog element itself.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal__body">
        <button
          type="button"
          className="modal__close"
          aria-label={t('modal.close')}
          title={t('modal.closeTip')}
          onClick={onClose}
        >
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path
              d="M3 3l10 10M13 3L3 13"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        {children}
      </div>
    </dialog>
  );
}
