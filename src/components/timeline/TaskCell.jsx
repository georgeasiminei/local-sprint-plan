import { useState } from 'react';
import { useTimelineStore } from '../../store/index.js';

export default function TaskCell({ taskId, taskName, week, rowHeight, allocation, isManual, isOverride, isLocked, cellColor }) {
  const [isEditing, setIsEditing] = useState(false);
  const requestWeekEdit = useTimelineStore((state) => state.requestWeekEdit);
  const setTaskResourceFromWeek = useTimelineStore((state) => state.setTaskResourceFromWeek);

  function commit(value) {
    setIsEditing(false);
    if (!week || !taskId) {
      return;
    }
    requestWeekEdit(week, () => setTaskResourceFromWeek(taskId, week.weekIndex, Number(value)));
  }

  return (
    <div
      role={week && taskId && !isLocked ? 'button' : undefined}
      tabIndex={week && taskId && !isLocked ? 0 : undefined}
      aria-label={week && taskId && !isLocked ? `Set ${taskName ?? 'task'} resources in ${week.label}` : undefined}
      className="overflow-hidden border-b border-r border-slate-200 px-1 text-center text-xs"
      style={{ height: rowHeight, lineHeight: `${rowHeight}px`, ...(cellColor ? { backgroundColor: cellColor } : {}) }}
      onClick={(event) => {
        event.stopPropagation();
        if (week && !isLocked) {
          setIsEditing(true);
        }
      }}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && week && !isLocked) {
          event.preventDefault();
          setIsEditing(true);
        }
      }}
    >
      {isEditing ? (
        <input
          autoFocus
          className="h-5 w-11 rounded border border-line px-1 text-center text-[11px] focus:outline-none focus:ring-2 focus:ring-focus/20"
          defaultValue={allocation ?? ''}
          inputMode="decimal"
          type="text"
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              commit(event.currentTarget.value);
            }
            if (event.key === 'Escape') {
              setIsEditing(false);
            }
          }}
          onClick={(event) => event.stopPropagation()}
        />
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
