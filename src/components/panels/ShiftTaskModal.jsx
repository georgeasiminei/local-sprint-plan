import { useEffect, useState } from 'react';
import { useTimelineStore } from '../../store/index.js';
import { findTaskShiftAtWeek } from '../../engine/taskTimelineEdits.js';
import Modal from '../ui/Modal.jsx';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';

export default function ShiftTaskModal({ document, open, onClose }) {
  const [weekDelta, setWeekDelta] = useState('1');
  const deleteTaskShift = useTimelineStore((state) => state.deleteTaskShift);
  const requestWeekEdit = useTimelineStore((state) => state.requestWeekEdit);
  const shiftTaskRemainder = useTimelineStore((state) => state.shiftTaskRemainder);
  const selectedTaskId = useTimelineStore((state) => state.selectedTaskId);
  const selectedTaskWeekIndex = useTimelineStore((state) => state.selectedTaskWeekIndex);
  const selectedTask = document.tasks.find((task) => task.id === selectedTaskId);
  const selectedShift = findTaskShiftAtWeek(selectedTask, selectedTaskWeekIndex);
  const anchorWeekIndex = selectedShift?.anchorWeekIndex ?? selectedTaskWeekIndex;
  const anchorWeek = document.weeks.find((week) => week.weekIndex === anchorWeekIndex);
  const anchorLabel = anchorWeek?.label ?? (anchorWeekIndex ? `week ${anchorWeekIndex}` : 'selected week');
  const afterLabel = anchorWeekIndex
    ? formatShiftedWeekLabel(document, anchorWeekIndex, Number(weekDelta) || 0)
    : 'selected week';
  const isEditingShift = Boolean(selectedShift);

  useEffect(() => {
    if (!open) {
      return;
    }

    setWeekDelta(selectedShift ? String(selectedShift.weekDelta ?? 1) : '1');
  }, [open, selectedShift]);

  function confirm() {
    if (!selectedTaskId || !anchorWeekIndex) {
      return;
    }

    requestWeekEdit(anchorWeek, () =>
      shiftTaskRemainder(selectedTaskId, anchorWeekIndex, Number(weekDelta) || 0, selectedShift?.id ?? null),
    );
    onClose();
  }

  function removeShift() {
    if (!selectedTaskId || !selectedShift) {
      return;
    }

    requestWeekEdit(anchorWeek, () => deleteTaskShift(selectedTaskId, selectedShift.id));
    onClose();
  }

  return (
    <Modal title={isEditingShift ? 'Edit shift' : 'Shift task'} open={open} onClose={onClose}>
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
          {selectedTask && anchorWeekIndex ? (
            <div className="space-y-1 px-3 py-2 text-sm">
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <span className="truncate">{selectedTask.name}</span>
                <span className="text-slate-500">
                  from {anchorLabel} to {afterLabel}
                </span>
              </div>
              {isEditingShift ? (
                <p className="text-xs text-slate-500">This is the first week after an existing shift. Change the value or delete the shift.</p>
              ) : null}
            </div>
          ) : (
            <p className="px-3 py-6 text-center text-sm text-slate-500">Select a task cell in the timeline first.</p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          {isEditingShift ? (
            <Button variant="ghost" className="text-red-700 hover:text-red-800" onClick={removeShift}>
              Delete shift
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={!selectedTask || !anchorWeekIndex}>
            {isEditingShift ? 'Update shift' : 'Apply shift'}
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
