import { resolveWeekResourceCount } from '../../engine/resourceResolver.js';
import { useTimelineStore } from '../../store/index.js';
import { formatNumber } from '../../utils/format.js';
import { CATEGORY_COLUMN_WIDTH, TASK_COLUMN_WIDTH, weekGridColumns } from './layout.js';

export default function EffortSummaryRow({ document, rowHeight, weekColumnWidth }) {
  const selectWeek = useTimelineStore((state) => state.selectWeek);
  const firstTeam = document.teams?.[0];
  const startingResourceCount = document.plan.startingResourceCount ?? document.weekResources[0]?.resourceCount ?? 0;
  const allocationByWeek = new Map();

  for (const entry of document.schedule ?? []) {
    allocationByWeek.set(entry.weekIndex, (allocationByWeek.get(entry.weekIndex) ?? 0) + (entry.allocatedUnits ?? 0));
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
          const assigned = allocationByWeek.get(week.weekIndex) ?? 0;
          const capacity = firstTeam
            ? resolveWeekResourceCount(week.weekIndex, firstTeam.id, document.weekResources, startingResourceCount)
            : 0;

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
                {formatNumber(assigned)}/{formatNumber(capacity)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
