import { useTimelineStore } from '../../store/index.js';
import Button from '../ui/Button.jsx';
import Modal from '../ui/Modal.jsx';

export default function PastWeekEditModal() {
  const pendingPastWeekEdit = useTimelineStore((state) => state.pendingPastWeekEdit);
  const confirmPastWeekEdit = useTimelineStore((state) => state.confirmPastWeekEdit);
  const cancelPastWeekEdit = useTimelineStore((state) => state.cancelPastWeekEdit);

  return (
    <Modal title="Edit past week?" open={Boolean(pendingPastWeekEdit)} onClose={cancelPastWeekEdit}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          {pendingPastWeekEdit?.week?.label ?? 'This week'} is in the past. Continuing will change historical plan data.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={cancelPastWeekEdit}>
            Cancel
          </Button>
          <Button onClick={confirmPastWeekEdit}>Continue</Button>
        </div>
      </div>
    </Modal>
  );
}
