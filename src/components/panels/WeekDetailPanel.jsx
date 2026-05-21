import { useEffect, useMemo, useState } from 'react';
import {
  countPlanVacationDaysForWeek,
  resolveWeekResourceCount,
  resolveWorkingDaysForWeek,
} from '../../engine/resourceResolver.js';
import { useTimelineStore } from '../../store/index.js';
import Sidebar from '../layout/Sidebar.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';

export default function WeekDetailPanel({ document }) {
  const [applyOnlyThisWeek, setApplyOnlyThisWeek] = useState(false);
  const [vacationScope, setVacationScope] = useState('global');
  const selectedWeekIndex = useTimelineStore((state) => state.selectedWeekIndex);
  const closeSidebar = useTimelineStore((state) => state.closeSidebar);
  const requestWeekEdit = useTimelineStore((state) => state.requestWeekEdit);
  const setCategoryVacationDays = useTimelineStore((state) => state.setCategoryVacationDays);
  const setPlanVacationDays = useTimelineStore((state) => state.setPlanVacationDays);
  const setTaskVacationDays = useTimelineStore((state) => state.setTaskVacationDays);
  const setWeekFreeDays = useTimelineStore((state) => state.setWeekFreeDays);
  const setWeekResource = useTimelineStore((state) => state.setWeekResource);
  const setWeekResourceForSingleWeek = useTimelineStore((state) => state.setWeekResourceForSingleWeek);
  const week = document.weeks.find((item) => item.weekIndex === selectedWeekIndex) ?? document.weeks[0];
  const firstTeam = document.teams[0];
  const startingResourceCount = document.plan.startingResourceCount ?? document.weekResources[0]?.resourceCount ?? 0;
  const resourceCount = firstTeam && week
    ? resolveWeekResourceCount(week.weekIndex, firstTeam.id, document.weekResources, startingResourceCount)
    : 0;
  const workingDays = firstTeam && week
    ? resolveWorkingDaysForWeek(week, document.freedays, firstTeam.id)
    : 5;
  const scopedVacationDays = useMemo(() => {
    if (!week) {
      return 0;
    }

    const parsedScope = parseVacationScope(vacationScope);

    if (parsedScope.type === 'global') {
      return countPlanVacationDaysForWeek(week, document.plan?.vacations ?? []);
    }

    if (parsedScope.type === 'category') {
      const category = document.categories.find((item) => item.id === parsedScope.id);
      return (category?.vacations ?? []).find((vacation) => vacation.weekIndex === week.weekIndex)?.dayCount ?? 0;
    }

    const task = document.tasks.find((item) => item.id === parsedScope.id);
    return (task?.vacations ?? []).find((vacation) => vacation.weekIndex === week.weekIndex)?.dayCount ?? 0;
  }, [document.categories, document.plan?.vacations, document.tasks, vacationScope, week]);

  if (!week) {
    return (
      <Sidebar title="Week" onClose={closeSidebar}>
        <p className="text-sm text-slate-500">Select a week to edit it.</p>
      </Sidebar>
    );
  }

  function updateResources(value) {
    if (!firstTeam) {
      return;
    }

    requestWeekEdit(week, () => {
      const patch = {
        teamId: firstTeam.id,
        weekIndex: week.weekIndex,
        resourceCount: Number(value),
      };

      if (applyOnlyThisWeek) {
        setWeekResourceForSingleWeek(patch);
        return;
      }

      setWeekResource(patch);
    });
  }

  function updateVacationDays(value) {
    if (!firstTeam) {
      return;
    }

    requestWeekEdit(week, () => {
      const parsedScope = parseVacationScope(vacationScope);

      if (parsedScope.type === 'global') {
        setPlanVacationDays(week.weekIndex, Number(value));
        return;
      }

      if (parsedScope.type === 'category') {
        setCategoryVacationDays(parsedScope.id, week.weekIndex, Number(value));
        return;
      }

      setTaskVacationDays(parsedScope.id, week.weekIndex, Number(value));
    });
  }

  function updateWorkingDays(value) {
    if (!firstTeam) {
      return;
    }

    const normalizedWorkingDays = Math.max(0, Math.min(5, Math.floor(Number(value) || 0)));
    requestWeekEdit(week, () => setWeekFreeDays(firstTeam.id, week.weekIndex, 5 - normalizedWorkingDays));
  }

  return (
    <Sidebar title={`Week ${week.label}`} onClose={closeSidebar}>
      <div className="space-y-5">
        <section className="space-y-3">
          <label className="block text-sm font-medium">
            Resources
            <Input
              className="mt-1 w-full"
              value={resourceCount}
              aria-label={`Resources for ${week.label}`}
              inputMode="decimal"
              onCommit={updateResources}
              as={DeferredNumberInput}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={applyOnlyThisWeek}
              onChange={(event) => setApplyOnlyThisWeek(event.target.checked)}
            />
            Apply only to this week
          </label>
        </section>

        <section className="space-y-3">
          <div className="text-xs font-semibold uppercase text-slate-500">Working days</div>
          <label className="block text-sm font-medium">
            Working days this week
            <Input
              className="mt-1 w-full"
              value={workingDays}
              aria-label={`Working days for ${week.label}`}
              inputMode="numeric"
              onCommit={updateWorkingDays}
              as={DeferredNumberInput}
            />
          </label>
          <p className="text-xs text-slate-500">
            Use 4 when one national holiday makes it a four-day working week.
          </p>
        </section>

        <section className="space-y-3">
          <div className="text-xs font-semibold uppercase text-slate-500">Vacation days</div>
          <label className="block text-sm font-medium">
            Scope
            <Select
              className="mt-1 w-full"
              value={vacationScope}
              aria-label={`Vacation scope for ${week.label}`}
              onChange={(event) => setVacationScope(event.target.value)}
            >
              <option value="global">Entire plan</option>
              {document.categories.map((category) => (
                <option key={category.id} value={`category:${category.id}`}>
                  Category: {category.name}
                </option>
              ))}
              {document.tasks.map((task) => (
                <option key={task.id} value={`task:${task.id}`}>
                  Task: {task.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="block text-sm font-medium">
            Vacation days
            <Input
              className="mt-1 w-full"
              value={scopedVacationDays}
              aria-label={`Vacation days for ${week.label}`}
              inputMode="numeric"
              onCommit={updateVacationDays}
              as={DeferredNumberInput}
            />
          </label>
          <p className="text-xs text-slate-500">
            These are person-days. Entire-plan days affect every task, category days affect tasks in that category, and task days affect only the selected task.
          </p>
        </section>
      </div>
    </Sidebar>
  );
}

function parseVacationScope(scope) {
  if (scope === 'global') {
    return { type: 'global', id: null };
  }

  if (scope.startsWith('category:')) {
    return { type: 'category', id: scope.slice('category:'.length) };
  }

  if (scope.startsWith('task:')) {
    return { type: 'task', id: scope.slice('task:'.length) };
  }

  return { type: 'category', id: scope };
}

function DeferredNumberInput({ value, onCommit, ...props }) {
  const [draft, setDraft] = useState(String(value ?? ''));

  useEffect(() => {
    setDraft(String(value ?? ''));
  }, [value]);

  function commit() {
    if (draft === String(value ?? '')) {
      return;
    }

    onCommit(draft);
  }

  return (
    <input
      {...props}
      type="text"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        }
        if (event.key === 'Escape') {
          setDraft(String(value ?? ''));
          event.currentTarget.blur();
        }
      }}
    />
  );
}
