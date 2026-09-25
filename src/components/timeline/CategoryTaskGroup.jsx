import { CheckCircle2, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { useTimelineStore } from '../../store/index.js';
import { getEffectiveAllocationForEntry, getResourceAllocationForEntry } from '../../engine/allocationDisplay.js';
import { findTaskShiftAtWeek } from '../../engine/taskTimelineEdits.js';
import { isCurrentWeek, isPastWeek } from '../../engine/timeline.js';
import {
  getTaskStatusValue,
  TASK_STATUS_AMBER,
  TASK_STATUS_COLORS,
  TASK_STATUS_COMPLETED,
  TASK_STATUS_GREEN,
  TASK_STATUS_RED,
} from '../../engine/taskStatus.js';
import { formatNumber } from '../../utils/format.js';
import TaskCell from './TaskCell.jsx';
import {
  CATEGORY_COLUMN_WIDTH,
  TASK_COLUMN_WIDTH,
  weekGridColumns,
} from './layout.js';
import { getDependenciesForEntity } from '../../utils/dependencies.js';

export default function CategoryTaskGroup({
  category,
  allocationView = 'resource',
  document,
  isSynthetic = false,
  rowHeight,
  schedule,
  tasks,
  weeks,
  weekColumnWidth,
  highlightedTaskIds = new Set(),
}) {
  const selectCategory = useTimelineStore((state) => state.selectCategory);
  const selectTask = useTimelineStore((state) => state.selectTask);
  const selectedCategoryId = useTimelineStore((state) => state.selectedCategoryId);
  const toggleCategory = useTimelineStore((state) => state.toggleCategory);
  const isSelected = selectedCategoryId === category.id;
  const visibleTasks = category.collapsed ? [] : tasks;
  const rowCount = Math.max(visibleTasks.length, 1);
  const totals = getTaskTotals(tasks);
  const categoryDependencies = getDependenciesForEntity(document, 'category', category.id);
  // Collapsing a category hides its per-task rows, but the per-week numbers behind them
  // still matter for a quick read - only computed while collapsed, since an expanded
  // category already shows this same information per task row.
  const collapsedWeekTotals = category.collapsed
    ? getCategoryWeekTotals(tasks, schedule, document, allocationView)
    : null;

  return (
    <section
      className="grid border-b border-line"
      style={{
        gridTemplateColumns: `${CATEGORY_COLUMN_WIDTH}px ${TASK_COLUMN_WIDTH}px 1fr`,
        gridTemplateRows: `repeat(${rowCount}, ${rowHeight}px)`,
      }}
    >
      <div
        className={`sticky left-0 z-[6] overflow-hidden border-r border-line px-2 py-0.5 text-xs font-semibold shadow-[1px_0_0_0_var(--tw-shadow-color)] shadow-line ${
          isSelected ? 'ring-2 ring-focus/60 font-bold' : ''
        }`}
        style={{
          gridRow: `1 / span ${rowCount}`,
          backgroundColor: category.color ?? '#f8fafc',
        }}
        onClick={() => !isSynthetic && selectCategory(category.id)}
      >
        <div className="flex h-full min-h-0 flex-col gap-0.5 overflow-hidden">
          <button
            type="button"
            className="app-tooltip flex min-w-0 items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-white/70"
            data-tooltip={category.collapsed ? 'Expand category' : 'Collapse category'}
            onClick={(event) => {
              event.stopPropagation();
              if (!isSynthetic) {
                toggleCategory(category.id);
              }
            }}
            aria-label={category.collapsed ? 'Expand category' : 'Collapse category'}
            disabled={isSynthetic}
          >
            {category.collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
            <span className="truncate">{category.name}</span>
          </button>
          {categoryDependencies.length > 0 ? (
            <button
              type="button"
              className="app-tooltip ml-1 inline-flex size-5 items-center justify-center rounded text-slate-700 hover:bg-white/70"
              data-tooltip="Has internal dependencies"
              aria-label={`Show internal dependencies for ${category.name}`}
              onClick={(event) => {
                event.stopPropagation();
                if (!isSynthetic) {
                  selectCategory(category.id);
                }
              }}
            >
              <Info size={13} />
            </button>
          ) : null}
          <div className="px-1 text-[10px] font-medium text-slate-600">
            {tasks.length} tasks
          </div>
          <div className="mt-auto px-1 text-[10px] font-medium text-slate-700">
            {formatNumber(totals.estimate)} / {formatNumber(totals.calc)}
          </div>
        </div>
      </div>

      {visibleTasks.length > 0 ? (
        visibleTasks.map((task, index) => (
          <TaskGridRow
            key={task.id}
            row={index + 1}
            rowHeight={rowHeight}
            allocationView={allocationView}
            task={task}
            document={document}
            weeks={weeks}
            schedule={schedule}
            rowColor={task.highlightColor ?? category.color}
            weekColumnWidth={weekColumnWidth}
            selectTask={selectTask}
            isExternallyHighlighted={highlightedTaskIds.has(task.id)}
          />
        ))
      ) : (
        <CollapsedRow
          row={1}
          rowHeight={rowHeight}
          weeks={weeks}
          weekColumnWidth={weekColumnWidth}
          weekTotals={collapsedWeekTotals}
        />
      )}
    </section>
  );
}

function TaskGridRow({
  row,
  rowHeight,
  allocationView,
  task,
  document,
  weeks,
  schedule,
  rowColor,
  selectTask,
  weekColumnWidth,
  isExternallyHighlighted = false,
}) {
  const selectedTaskId = useTimelineStore((state) => state.selectedTaskId);
  const selectedTaskWeekIndex = useTimelineStore((state) => state.selectedTaskWeekIndex);
  const isSelected = selectedTaskId === task.id;
  const taskSchedule = schedule.filter((item) => item.taskId === task.id);
  const taskDependencies = getDependenciesForEntity(document, 'task', task.id);

  return (
    <>
      <div
        className={`sticky z-[5] grid grid-cols-[1fr_48px] overflow-hidden border-b border-r border-slate-200 bg-white text-left hover:bg-slate-50 ${
          isSelected ? 'ring-2 ring-focus/40 z-[6]' : ''
        }`}
        style={{
          gridColumn: 2,
          gridRow: row,
          left: CATEGORY_COLUMN_WIDTH,
          height: rowHeight,
        }}
        onClick={() => selectTask(task.id)}
      >
        <div className="min-w-0 overflow-hidden px-2">
          <div className="flex min-w-0 items-center gap-1">
            <p
              className={`truncate text-xs font-medium leading-[inherit] ${task.completed ? 'italic text-slate-600' : ''} ${isSelected ? 'font-bold' : ''}`}
              style={{ lineHeight: `${rowHeight}px` }}
            >
              {task.name}
            </p>
            {task.completed ? (
              <CheckCircle2
                aria-label={`${task.name} completed`}
                role="img"
                title="Completed"
                className="shrink-0 text-emerald-600"
                size={13}
              />
            ) : null}
            {taskDependencies.length > 0 ? (
              <button
                type="button"
                className="app-tooltip inline-flex shrink-0 items-center justify-center text-slate-500 hover:text-slate-700"
                data-tooltip="Has internal dependencies"
                aria-label={`Show internal dependencies for ${task.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  selectTask(task.id);
                }}
              >
                <Info size={13} />
              </button>
            ) : null}
          </div>
        </div>
        <div className="overflow-hidden border-l border-line px-1 text-center text-xs" style={{ lineHeight: `${rowHeight}px` }}>
          {formatNumber(task.estimateWeeks)}
        </div>
      </div>
      <div
        className="grid"
        style={{
          gridColumn: 3,
          gridRow: row,
          gridTemplateColumns: weekGridColumns(weeks.length, weekColumnWidth),
        }}
        onClick={() => selectTask(task.id)}
      >
        {weeks.length > 0 ? (
          weeks.map((week) => {
            const entry = taskSchedule.find((item) => item.weekIndex === week.weekIndex);
            const isOverride = (task.resourceOverrides ?? []).some((override) => override.weekIndex === week.weekIndex);
            const allocation = allocationView === 'effective'
              ? getEffectiveAllocationForEntry(entry)
              : getResourceAllocationForEntry(document, task, week, entry);
            const shiftRule = findTaskShiftAtWeek(task, week.weekIndex);
            const isSelectedWeek = isSelected && selectedTaskWeekIndex === week.weekIndex;
            const hasDisplayedAllocation = Number(allocation) > 0;
            const statusColor = getTaskCellStatusColor(task, week, hasDisplayedAllocation);
            return (
              <TaskCell
                key={week.id}
                taskId={task.id}
                taskName={task.name}
                rowHeight={rowHeight}
                week={week}
                allocation={allocation}
                isManual={entry?.isManual}
                isOverride={isOverride}
                isLocked={task.completed || allocationView === 'effective'}
                isEditable={allocationView === 'resource'}
                isSelected={isSelectedWeek}
                isExternallyHighlighted={isExternallyHighlighted}
                shiftRule={shiftRule}
                cellColor={statusColor ?? (hasDisplayedAllocation ? rowColor : null)}
              />
            );
          })
        ) : (
          <TaskCell />
        )}
      </div>
    </>
  );
}

function getTaskCellStatusColor(task, week, hasAllocatedUnits = false) {
  if (!hasAllocatedUnits) {
    return null;
  }

  const status = getTaskStatusValue(task);

  if (status === TASK_STATUS_COMPLETED) {
    return TASK_STATUS_COLORS[TASK_STATUS_COMPLETED];
  }

  if (status === TASK_STATUS_GREEN && isPastWeek(week)) {
    return TASK_STATUS_COLORS[TASK_STATUS_GREEN];
  }

  if (status === TASK_STATUS_AMBER && isCurrentWeek(week)) {
    return TASK_STATUS_COLORS[TASK_STATUS_AMBER];
  }

  if (status === TASK_STATUS_RED && isCurrentWeek(week)) {
    return TASK_STATUS_COLORS[TASK_STATUS_RED];
  }

  return null;
}

function CollapsedRow({ row, rowHeight, weeks, weekColumnWidth, weekTotals }) {
  const columns = weeks.length > 0 ? weeks : [null];

  return (
    <>
      <div
        className="sticky z-[5] overflow-hidden border-b border-r border-slate-200 bg-white px-2 text-xs text-slate-500"
        style={{ gridColumn: 2, gridRow: row, left: CATEGORY_COLUMN_WIDTH, height: rowHeight, lineHeight: `${rowHeight}px` }}
      >
        Collapsed
      </div>
      <div className="grid" style={{ gridColumn: 3, gridRow: row, gridTemplateColumns: weekGridColumns(weeks.length, weekColumnWidth) }}>
        {columns.map((week, index) => {
          const total = week ? weekTotals?.get(week.weekIndex) : undefined;

          return (
            <div
              key={week?.id ?? index}
              aria-label={total ? `${formatNumber(total)} allocated in ${week.label} (read only, expand category to edit)` : undefined}
              className="overflow-hidden border-b border-r border-slate-200 px-1 text-center text-[11px] font-medium text-slate-500"
              style={{ height: rowHeight, lineHeight: `${rowHeight}px` }}
            >
              {total ? formatNumber(total) : ''}
            </div>
          );
        })}
      </div>
    </>
  );
}

function getTaskTotals(tasks) {
  return tasks.reduce(
    (totals, task) => ({
      estimate: totals.estimate + (Number(task.estimateWeeks) || 0),
      calc: totals.calc + (Number(task.calcWeeks) || 0),
    }),
    { estimate: 0, calc: 0 },
  );
}

// Sums this category's per-week allocations across its tasks, for the read-only summary
// line shown in place of individual task rows while the category is collapsed. Only
// "used" weeks (a positive total) are kept - an empty Map entry would just render blank
// anyway, but omitting them makes the "used week" contract explicit at the data level
// rather than relying on the render to hide zeros.
function getCategoryWeekTotals(tasks, schedule, document, allocationView) {
  const taskIds = new Set(tasks.map((task) => task.id));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const weekByIndex = new Map((document.weeks ?? []).map((week) => [week.weekIndex, week]));
  const totals = new Map();

  for (const entry of schedule) {
    if (!taskIds.has(entry.taskId)) {
      continue;
    }

    const task = taskById.get(entry.taskId);
    const week = weekByIndex.get(entry.weekIndex);
    const value =
      allocationView === 'effective'
        ? getEffectiveAllocationForEntry(entry)
        : getResourceAllocationForEntry(document, task, week, entry);

    totals.set(entry.weekIndex, (totals.get(entry.weekIndex) ?? 0) + (Number(value) || 0));
  }

  for (const [weekIndex, total] of totals) {
    if (total <= 0) {
      totals.delete(weekIndex);
    }
  }

  return totals;
}
