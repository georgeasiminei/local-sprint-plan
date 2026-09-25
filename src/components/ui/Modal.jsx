import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import Button from './Button.jsx';

export default function Modal({ title, open, onClose, children }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    // Don't steal focus from a field that already claimed it via autoFocus.
    if (!dialogRef.current?.contains(document.activeElement)) {
      dialogRef.current?.focus();
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        // Capture phase + stopPropagation: an open modal must own Escape before it
        // reaches useKeyboardShortcuts' bubble-phase window listener, otherwise
        // dismissing the modal also clears the grid selection and closes the sidebar
        // behind it.
        event.stopPropagation();
        onClose();
      }
    }

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="w-full max-w-xl rounded bg-white shadow-xl focus:outline-none"
      >
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <Button variant="ghost" className="size-8 p-0" onClick={onClose} aria-label="Close">
            <X size={16} />
          </Button>
        </header>
        <div className="p-4">{children}</div>
      </section>
    </div>
  );
}
