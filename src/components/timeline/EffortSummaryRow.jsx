import { getResourceAllocationForEntry } from '../../engine/allocationDisplay.js';
import { useTimelineStore } from '../../store/index.js';
import { formatNumber } from '../../utils/format.js';
import { CATEGORY_COLUMN_WIDTH, TASK_COLUMN_WIDTH, weekGridColumns } from './layout.js';

export default function EffortSummaryRow({ document, rowHeight, weekColumnWidth }) {
  const selectWeek = useTimelineStore((state) => state.selectWeek);
  const effectiveAllocationByWeek = new Map();
  const resourceAllocationByWeek = new Map();

  for (const entry of document.schedule ?? []) {
    const week = document.weeks.find((item) => item.weekIndex === entry.weekIndex);
    const task = document.tasks.find((item) => item.id === entry.taskId);
    const resourceAllocation = getResourceAllocationForEntry(document, task, week, entry) ?? 0;
    effectiveAllocationByWeek.set(
      entry.weekIndex,
      (effectiveAllocationByWeek.get(entry.weekIndex) ?? 0) + (entry.allocatedUnits ?? 0),
    );
    resourceAllocationByWeek.set(
      entry.weekIndex,
      (resourceAllocationByWeek.get(entry.weekIndex) ?? 0) + resourceAllocation,
    );
  }

  return (
    <div
      className="grid border-b border-line bg-slate-50 text-left"
      style={{ gridTemplateColumns: `${CATEGORY_COLUMN_WIDTH}px ${TASK_COLUMN_WIDTH}px 1fr` }}
    >
      <div className="sticky left-0 z-[6] border-r border-line bg-slate-50" style={{ height: rowHeight }} />
      <div
        className="sticky z-[5] overflow-hidden border-r border-line bg-slate-50 px-2 text-[10px] font-semibold uppercase text-slate-600"
        style={{ left: CATEGORY_COLUMN_WIDTH, height: rowHeight, lineHeight: `${rowHeight}px` }}
      >
        Total effort
      </div>
      <div className="grid col-start-3" style={{ gridTemplateColumns: weekGridColumns(document.weeks.length, weekColumnWidth) }}>
        {document.weeks.map((week) => {
          const effectiveAssigned = effectiveAllocationByWeek.get(week.weekIndex) ?? 0;
          const resourceAssigned = resourceAllocationByWeek.get(week.weekIndex) ?? 0;

          return (
            <div
              key={week.id}
              role="button"
              tabIndex={0}
              className="app-tooltip overflow-hidden border-b border-r border-slate-200 px-1 text-center text-[11px] font-medium text-slate-700 hover:bg-white"
              style={{ height: rowHeight, lineHeight: `${rowHeight}px` }}
              aria-label={`Open week ${week.label}`}
              data-tooltip={`Open ${week.label}`}
              onClick={(event) => {
                event.stopPropagation();
                selectWeek(week.weekIndex);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  selectWeek(week.weekIndex);
                }
              }}
            >
              <span>
                {formatNumber(effectiveAssigned)}/{formatNumber(resourceAssigned)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
