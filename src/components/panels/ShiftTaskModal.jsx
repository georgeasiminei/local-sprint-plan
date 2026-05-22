import { useState } from 'react';
import { useTimelineStore } from '../../store/index.js';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';

export default function ShiftTaskModal({ document, open, onClose }) {
  const [weekDelta, setWeekDelta] = useState('1');
  const requestWeekEdit = useTimelineStore((state) => state.requestWeekEdit);
  const shiftTaskRemainder = useTimelineStore((state) => state.shiftTaskRemainder);
  const selectedTaskId = useTimelineStore((state) => state.selectedTaskId);
  const selectedTaskWeekIndex = useTimelineStore((state) => state.selectedTaskWeekIndex);
  const selectedTask = document.tasks.find((task) => task.id === selectedTaskId);
  const anchorWeek = document.weeks.find((week) => week.weekIndex === selectedTaskWeekIndex);
  const anchorLabel = anchorWeek?.label ?? (selectedTaskWeekIndex ? `week ${selectedTaskWeekIndex}` : 'selected week');
  const afterLabel = selectedTaskWeekIndex
    ? formatShiftedWeekLabel(document, selectedTaskWeekIndex, Number(weekDelta) || 0)
    : 'selected week';

  function confirm() {
    if (!selectedTaskId || !selectedTaskWeekIndex) {
      return;
    }

    requestWeekEdit(anchorWeek, () => shiftTaskRemainder(selectedTaskId, selectedTaskWeekIndex, Number(weekDelta) || 0));
    onClose();
  }

  return (
    <Modal title="Shift task" open={open} onClose={onClose}>
      <div className="space-y-4">
        <label className="block text-sm font-medium">
          Shift remaining work by weeks
          <Input
            className="mt-1 w-32"
            type="text"
            inputMode="decimal"
            value={weekDelta}
            onChange={(event) => setWeekDelta(event.target.value)}
          />
        </label>

        <div className="max-h-64 overflow-auto rounded border border-line">
          {selectedTask && selectedTaskWeekIndex ? (
            <div className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2 text-sm">
              <span className="truncate">{selectedTask.name}</span>
              <span className="text-slate-500">
                from {anchorLabel} to {afterLabel}
              </span>
            </div>
          ) : (
            <p className="px-3 py-6 text-center text-sm text-slate-500">Select a task cell in the timeline first.</p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={!selectedTask || !selectedTaskWeekIndex}>
            Apply shift
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function formatShiftedWeekLabel(document, weekIndex, weekDelta) {
  const shiftedWeek = weekIndex + Math.floor(Math.max(0, weekDelta));
  const fractional = Math.max(0, weekDelta) % 1;
  const label = document.weeks.find((week) => week.weekIndex === shiftedWeek)?.label ?? `week ${shiftedWeek}`;

  if (fractional === 0) {
    return label;
  }

  return `${label} + ${fractional.toFixed(1)} week`;
}
