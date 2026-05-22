import { useEffect, useRef, useState } from 'react';
import { useTimelineStore } from '../../store/index.js';

export default function TaskCell({
  taskId,
  taskName,
  week,
  rowHeight,
  allocation,
  isManual,
  isOverride,
  isLocked,
  isEditable = true,
  isSelected = false,
  cellColor,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState('');
  const clickTimerRef = useRef(null);
  const lastClickTimeRef = useRef(0);
  const requestWeekEdit = useTimelineStore((state) => state.requestWeekEdit);
  const setTaskResourceFromWeek = useTimelineStore((state) => state.setTaskResourceFromWeek);
  const selectTaskCell = useTimelineStore((state) => state.selectTaskCell);

  useEffect(() => () => window.clearTimeout(clickTimerRef.current), []);

  function openEditor() {
    if (!week || !taskId || !isEditable || isLocked) {
      return;
    }

    selectTaskCell(taskId, week.weekIndex);
    setDraftValue(allocation ?? '');
    setIsEditing(true);
  }

  function selectCell() {
    if (taskId) {
      selectTaskCell(taskId, week?.weekIndex ?? null);
    }
  }

  function commit(value) {
    setIsEditing(false);
    if (!week || !taskId || !isEditable || isLocked) {
      return;
    }
    requestWeekEdit(week, () => setTaskResourceFromWeek(taskId, week.weekIndex, Number(value)));
  }

  function unset() {
    setIsEditing(false);
    if (!week || !taskId || !isEditable || isLocked) {
      return;
    }

    requestWeekEdit(week, () => setTaskResourceFromWeek(taskId, week.weekIndex, 0));
  }

  return (
    <div
      role={week && taskId ? 'button' : undefined}
      tabIndex={week && taskId ? 0 : undefined}
      aria-label={week && taskId ? getCellLabel(taskName, week, isEditable && !isLocked) : undefined}
      className={`relative overflow-visible border-b border-r border-slate-200 px-1 text-center text-xs ${
        isSelected ? 'ring-2 ring-inset ring-focus/60' : ''
      }`}
      style={{ height: rowHeight, lineHeight: `${rowHeight}px`, ...(cellColor ? { backgroundColor: cellColor } : {}) }}
      onClick={(event) => {
        event.stopPropagation();
        if (!isEditable || isLocked) {
          selectCell();
          return;
        }

        const now = window.performance.now();
        const isDoubleClick = event.detail >= 2 || now - lastClickTimeRef.current < 500;
        lastClickTimeRef.current = now;

        if (isDoubleClick) {
          window.clearTimeout(clickTimerRef.current);
          openEditor();
          return;
        }

        selectCell();
        window.clearTimeout(clickTimerRef.current);
        clickTimerRef.current = window.setTimeout(() => {
          lastClickTimeRef.current = 0;
        }, 500);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        window.clearTimeout(clickTimerRef.current);
        openEditor();
      }}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && week) {
          event.preventDefault();
          selectCell();
          if (isEditable && !isLocked) {
            openEditor();
          }
        }
      }}
    >
      {isEditing ? (
        <div
          className="absolute left-1 top-1 z-30 flex items-center gap-1 rounded border border-line bg-white p-1 shadow-panel"
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          style={{ lineHeight: 1 }}
        >
          <input
            autoFocus
            aria-label={`Resource value for ${taskName ?? 'task'} in ${week.label}`}
            className="h-6 w-12 rounded border border-line px-1 text-center text-[11px] focus:outline-none focus:ring-2 focus:ring-focus/20"
            value={draftValue}
            inputMode="decimal"
            type="text"
            onChange={(event) => setDraftValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commit(draftValue);
              }
              if (event.key === 'Escape') {
                setIsEditing(false);
              }
            }}
          />
          <button
            type="button"
            className="h-6 rounded bg-focus px-2 text-[11px] font-medium text-white hover:bg-blue-700"
            onClick={() => commit(draftValue)}
          >
            Set
          </button>
          <button
            type="button"
            className="h-6 rounded border border-line px-2 text-[11px] font-medium text-slate-700 hover:bg-panel"
            onClick={unset}
          >
            Unset
          </button>
          <button
            type="button"
            aria-label="Cancel resource edit"
            className="grid size-6 place-items-center rounded text-[13px] font-semibold text-slate-500 hover:bg-panel hover:text-ink"
            onClick={() => setIsEditing(false)}
          >
            x
          </button>
        </div>
      ) : null}
      {!isEditing && (
        allocation ? (
          <span
            className={`inline-flex h-4 min-w-6 items-center justify-center rounded px-1 text-[11px] font-medium leading-4 ${
              isManual || isOverride ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'
            }`}
          >
            {allocation}
          </span>
        ) : (
          <span className="text-xs text-slate-300">{week ? '' : '-'}</span>
        )
      )}
    </div>
  );
}

function getCellLabel(taskName, week, canEdit) {
  if (canEdit) {
    return `Set ${taskName ?? 'task'} resources in ${week.label}`;
  }

  return `View ${taskName ?? 'task'} effective resources in ${week.label}`;
}
