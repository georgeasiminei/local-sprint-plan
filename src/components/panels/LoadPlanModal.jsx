import Button from '../ui/Button.jsx';
import Modal from '../ui/Modal.jsx';

export default function LoadPlanModal({ open, onClose, onLoad, savedPlans }) {
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
              className="flex w-full items-center justify-between rounded border border-line px-3 py-2 text-left hover:bg-slate-50"
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
      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
