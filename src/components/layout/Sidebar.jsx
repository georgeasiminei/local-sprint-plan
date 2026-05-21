import { X } from 'lucide-react';

export default function Sidebar({ actions = null, children, onClose, title }) {
  return (
    <aside className="w-full rounded border border-line bg-white shadow-panel lg:w-80">
      {title ? (
        <header className="flex items-center justify-between border-b border-line px-4 py-3 text-sm font-semibold">
          <span>{title}</span>
          <div className="flex items-center gap-1">
            {actions}
            {onClose ? (
              <button
                type="button"
                className="app-tooltip grid size-7 place-items-center rounded text-slate-500 hover:bg-panel hover:text-ink"
                data-tooltip="Close panel"
                onClick={onClose}
                aria-label="Close panel"
              >
                <X size={15} />
              </button>
            ) : null}
          </div>
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </aside>
  );
}
