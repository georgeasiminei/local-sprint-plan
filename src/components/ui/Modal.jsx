import { X } from 'lucide-react';
import Button from './Button.jsx';

export default function Modal({ title, open, onClose, children }) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4">
      <section className="w-full max-w-xl rounded bg-white shadow-xl">
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
