import { useState } from 'react';
import { useTimelineStore } from '../../store/index.js';
import { CATEGORY_COLUMN_WIDTH, TASK_COLUMN_WIDTH, weekGridColumns } from './layout.js';

export default function GridHeader({ weeks = [], sprints = [], weekColumnWidth }) {
  const [editingSprintId, setEditingSprintId] = useState(null);
  const setSprintNumber = useTimelineStore((state) => state.setSprintNumber);
  const selectWeek = useTimelineStore((state) => state.selectWeek);

  function commitSprint(sprint, value) {
    setEditingSprintId(null);
    setSprintNumber(sprint.order, value);
  }

  return (
    <div
      className="sticky top-0 z-10 grid border-b border-line bg-slate-50"
      style={{ gridTemplateColumns: `${CATEGORY_COLUMN_WIDTH}px ${TASK_COLUMN_WIDTH}px 1fr` }}
    >
      <div className="sticky left-0 z-[12] border-r border-line bg-slate-50 px-2 py-1.5 text-[10px] font-semibold uppercase text-slate-500">
        Category
      </div>
      <div
        className="sticky z-[11] border-r border-line bg-slate-50 px-2 py-1.5 text-[10px] font-semibold uppercase text-slate-500"
        style={{ left: CATEGORY_COLUMN_WIDTH }}
      >
        <div className="grid grid-cols-[30px_1fr_48px_48px]">
          <span />
          <span>Task</span>
          <span className="text-center">Est</span>
          <span className="text-center">Calc</span>
        </div>
      </div>
      <div className="col-start-3">
        {sprints.length > 0 ? (
          <div className="grid border-b border-line" style={{ gridTemplateColumns: weekGridColumns(weeks.length, weekColumnWidth) }}>
            {sprints.map((sprint) => (
              <div
                key={sprint.id}
                className="border-r border-line px-1.5 py-0.5 text-center text-[10px] font-medium text-slate-600"
                style={{ gridColumn: `${sprint.columnStart} / span ${sprint.columnSpan}` }}
              >
                {editingSprintId === sprint.id ? (
                  <input
                    autoFocus
                    className="h-5 w-14 rounded border border-line px-1 text-center text-[10px] focus:outline-none focus:ring-2 focus:ring-focus/20"
                    defaultValue={sprint.number ?? sprint.order}
                    inputMode="numeric"
                    type="text"
                    aria-label={`Sprint number for ${sprint.name}`}
                    onBlur={(event) => commitSprint(sprint, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        commitSprint(sprint, event.currentTarget.value);
                      }
                      if (event.key === 'Escape') {
                        setEditingSprintId(null);
                      }
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="app-tooltip w-full rounded px-1 py-0.5 hover:bg-white"
                    data-tooltip={`Edit ${sprint.name}`}
                    onClick={() => setEditingSprintId(sprint.id)}
                  >
                    {sprint.name}
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : null}
        <div className="grid border-b border-line" style={{ gridTemplateColumns: weekGridColumns(weeks.length, weekColumnWidth) }}>
          {weeks.length > 0 ? (
            weeks.map((week) => (
              <button
                key={week.id}
                type="button"
                className="app-tooltip border-r border-line px-1.5 py-1 text-center text-[11px] font-medium hover:bg-white"
                data-tooltip={`Open ${week.label}`}
                onClick={() => selectWeek(week.weekIndex)}
              >
                {week.label}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-xs text-slate-500">Add weeks to start planning</div>
          )}
        </div>
      </div>
    </div>
  );
}
