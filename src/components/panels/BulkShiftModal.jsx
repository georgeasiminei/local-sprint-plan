import { useState } from 'react';
import { useTimelineStore } from '../../store/index.js';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';

export default function BulkShiftModal({ document, open, onClose }) {
  const [weekDelta, setWeekDelta] = useState(1);
  const bulkShiftTasks = useTimelineStore((state) => state.bulkShiftTasks);
  const clearTaskSelection = useTimelineStore((state) => state.clearTaskSelection);
  const selectedTaskIds = useTimelineStore((state) => state.selectedTaskIds);
  const selectedTasks = document.tasks.filter((task) => selectedTaskIds.includes(task.id));

  function confirm() {
    bulkShiftTasks(selectedTaskIds, Number(weekDelta) || 0);
    clearTaskSelection();
    onClose();
  }

  return (
    <Modal title="Bulk shift" open={open} onClose={onClose}>
      <div className="space-y-4">
        <label className="block text-sm font-medium">
          Shift by weeks
          <Input
            className="mt-1 w-32"
            type="text"
            inputMode="numeric"
            value={weekDelta}
            onChange={(event) => setWeekDelta(Number(event.target.value))}
          />
        </label>

        <div className="max-h-64 overflow-auto rounded border border-line">
          {selectedTasks.map((task) => {
            const before = task.earliestStartWeek ?? document.plan.startWeek ?? document.weeks[0]?.weekIndex ?? 1;
            const after = Math.max(1, before + (Number(weekDelta) || 0));
            const beforeLabel = document.weeks.find((week) => week.weekIndex === before)?.label ?? `week ${before}`;
            const afterLabel = document.weeks.find((week) => week.weekIndex === after)?.label ?? `week ${after}`;
            return (
              <div key={task.id} className="grid grid-cols-[1fr_auto] gap-3 border-b border-line px-3 py-2 text-sm last:border-b-0">
                <span className="truncate">{task.name}</span>
                <span className="text-slate-500">
                  {beforeLabel} to {afterLabel}
                </span>
              </div>
            );
          })}
          {selectedTasks.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">Select tasks in the timeline first.</p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={selectedTasks.length === 0}>
            Apply shift
          </Button>
        </div>
      </div>
    </Modal>
  );
}
