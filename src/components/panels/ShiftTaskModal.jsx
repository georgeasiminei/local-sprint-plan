import { useState } from 'react';
import { useTimelineStore } from '../../store/index.js';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';

export default function ShiftTaskModal({ document, open, onClose }) {
  const [weekDelta, setWeekDelta] = useState(1);
  const shiftTask = useTimelineStore((state) => state.shiftTask);
  const selectedTaskId = useTimelineStore((state) => state.selectedTaskId);
  const selectedTask = document.tasks.find((task) => task.id === selectedTaskId);
  const beforeWeek = selectedTask?.earliestStartWeek ?? document.plan.startWeek ?? document.weeks[0]?.weekIndex ?? 1;
  const afterWeek = Math.max(1, beforeWeek + (Number(weekDelta) || 0));
  const beforeLabel = document.weeks.find((week) => week.weekIndex === beforeWeek)?.label ?? `week ${beforeWeek}`;
  const afterLabel = document.weeks.find((week) => week.weekIndex === afterWeek)?.label ?? `week ${afterWeek}`;

  function confirm() {
    if (!selectedTaskId) {
      return;
    }

    shiftTask(selectedTaskId, Number(weekDelta) || 0);
    onClose();
  }

  return (
    <Modal title="Shift task" open={open} onClose={onClose}>
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
          {selectedTask ? (
            <div className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2 text-sm">
              <span className="truncate">{selectedTask.name}</span>
              <span className="text-slate-500">
                {beforeLabel} to {afterLabel}
              </span>
            </div>
          ) : (
            <p className="px-3 py-6 text-center text-sm text-slate-500">Select a task in the timeline first.</p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={!selectedTask}>
            Apply shift
          </Button>
        </div>
      </div>
    </Modal>
  );
}
