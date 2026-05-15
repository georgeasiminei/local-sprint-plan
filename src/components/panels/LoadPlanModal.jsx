import Button from '../ui/Button.jsx';
import Modal from '../ui/Modal.jsx';

import { useRef } from 'react';

export default function LoadPlanModal({ open, onClose, onLoad, onLoadJsonFile, savedPlans }) {
  const fileInputRef = useRef(null);

  return (
    <Modal title="Load plan" open={open} onClose={onClose}>
      {savedPlans.length === 0 ? (
        <p className="text-sm text-slate-500">No locally saved plans yet.</p>
      ) : (
        <div className="space-y-2">
          {savedPlans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              className="app-tooltip flex w-full items-center justify-between rounded border border-line px-3 py-2 text-left hover:bg-slate-50"
              data-tooltip={`Load ${plan.name}`}
              onClick={() => onLoad(plan.id)}
            >
              <span className="truncate text-sm font-medium">{plan.name}</span>
              <span className="ml-3 shrink-0 text-xs text-slate-500">
                {new Date(plan.savedAt).toLocaleString()}
              </span>
            </button>
          ))}
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
