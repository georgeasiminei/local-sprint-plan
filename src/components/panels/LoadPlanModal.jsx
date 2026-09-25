import Button from '../ui/Button.jsx';
import Modal from '../ui/Modal.jsx';

import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';

export default function LoadPlanModal({ open, onClose, onDeleteSavedPlan, onLoad, onLoadJsonFile, savedPlans }) {
  const fileInputRef = useRef(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  // Snapshots are the app's only explicit local backup and aren't covered by undo, so a
  // mis-click next to the full-width Load button must not delete one outright - require
  // a second click on the same row within the same modal visit to confirm.
  useEffect(() => {
    if (!open) {
      setPendingDeleteId(null);
    }
  }, [open]);

  function handleDeleteClick(plan) {
    if (pendingDeleteId === plan.id) {
      onDeleteSavedPlan(plan.id);
      setPendingDeleteId(null);
      return;
    }

    setPendingDeleteId(plan.id);
  }

  return (
    <Modal title="Load plan" open={open} onClose={onClose}>
      {savedPlans.length === 0 ? (
        <p className="text-sm text-slate-500">No locally saved plans yet.</p>
      ) : (
        <div className="space-y-2">
          {savedPlans.map((plan) => {
            const isPendingDelete = pendingDeleteId === plan.id;

            return (
              <div key={plan.id} className="flex items-center gap-2">
                <button
                  type="button"
                  className="app-tooltip flex min-w-0 flex-1 items-center justify-between rounded border border-line px-3 py-2 text-left hover:bg-slate-50"
                  data-tooltip={`Load ${plan.name}`}
                  onClick={() => onLoad(plan.id)}
                >
                  <span className="truncate text-sm font-medium">{plan.name}</span>
                  <span className="ml-3 shrink-0 text-xs text-slate-500">
                    {new Date(plan.savedAt).toLocaleString()}
                  </span>
                </button>
                {isPendingDelete ? (
                  <Button
                    variant="ghost"
                    className="h-9 shrink-0 px-2 text-xs text-red-700 hover:text-red-800"
                    aria-label={`Confirm delete ${plan.name}`}
                    tooltip="Click again to permanently delete"
                    onClick={() => handleDeleteClick(plan)}
                  >
                    Confirm delete?
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    className="size-9 shrink-0 p-0 text-red-700 hover:text-red-800"
                    aria-label={`Delete ${plan.name}`}
                    tooltip={`Delete ${plan.name}`}
                    onClick={() => handleDeleteClick(plan)}
                  >
                    <Trash2 size={18} />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-4 flex justify-between gap-2">
        <input
          ref={fileInputRef}
          className="hidden"
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            const [file] = event.target.files ?? [];
            if (file) {
              onLoadJsonFile(file);
            }
            event.target.value = '';
          }}
        />
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()} tooltip="Load JSON from this computer">
          Load JSON
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
