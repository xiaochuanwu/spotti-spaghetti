import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '../i18n';

const getFocusableElements = (node) => (
  Array.from(node?.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  ) || []).filter(element => !element.disabled && element.getAttribute('aria-hidden') !== 'true')
);

export const ConfirmDialog = ({
  confirmLabel,
  destructive = false,
  isOpen,
  message,
  onCancel,
  onConfirm,
  title,
}) => {
  const { t } = useI18n();
  const dialogRef = useRef(null);
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousActiveElement = document.activeElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => cancelButtonRef.current?.focus());

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = getFocusableElements(dialogRef.current);
      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previousActiveElement?.focus?.();
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm animate-fade-in"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="w-full max-w-md rounded-2xl border border-[#e5e5e7] bg-white p-5 shadow-2xl dark:border-[#333336] dark:bg-[#1d1d1f]"
      >
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            destructive
              ? 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300'
              : 'bg-[#f0f5ff] text-[#0071e3] dark:bg-[#071426]'
          }`}>
            <AlertTriangle size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 id="confirm-dialog-title" className="text-base font-bold text-[#1d1d1f] dark:text-[#f5f5f7]">
              {title}
            </h2>
            <p id="confirm-dialog-message" className="mt-2 text-sm leading-6 text-[#6e6e73] dark:text-[#a1a1a6]">
              {message}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            className="rounded-full bg-[#e8e8ed] px-4 py-2 text-xs font-bold text-[#1d1d1f] transition-colors hover:bg-[#dcdce2] dark:bg-[#2d2d30] dark:text-[#f5f5f7] dark:hover:bg-[#3a3a3d]"
          >
            {t('confirm.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-full px-4 py-2 text-xs font-bold text-white transition-colors ${
              destructive
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[#0071e3] hover:bg-[#0077ed]'
            }`}
          >
            {confirmLabel || t('confirm.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};
