import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
  const [newVacationScope, setNewVacationScope] = useState('global');
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
  const vacationOptions = useMemo(() => getVacationScopeOptions(document), [document]);
  const vacationEntries = useMemo(
    () => (week ? getVacationEntries(document, week, vacationOptions) : []),
    [document, vacationOptions, week],
  );
  const usedVacationScopes = new Set(vacationEntries.map((entry) => entry.scope));
  const availableVacationOptions = vacationOptions.filter((option) => !usedVacationScopes.has(option.value));

  useEffect(() => {
    if (availableVacationOptions.length === 0) {
      setNewVacationScope('');
      return;
    }

    if (!availableVacationOptions.some((option) => option.value === newVacationScope)) {
      setNewVacationScope(availableVacationOptions[0].value);
    }
  }, [availableVacationOptions, newVacationScope]);

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

  function updateVacationDays(scope, value) {
    if (!firstTeam) {
      return;
    }

    requestWeekEdit(week, () => {
      const parsedScope = parseVacationScope(scope);

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

  function addVacationEntry() {
    if (!newVacationScope) {
      return;
    }

    updateVacationDays(newVacationScope, 1);
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
          {vacationEntries.length > 0 ? (
            <div className="space-y-2">
              {vacationEntries.map((entry) => (
                <div key={entry.scope} className="grid grid-cols-[1fr_64px_32px] items-end gap-2">
                  <div className="min-w-0 text-sm">
                    <div className="truncate font-medium">{entry.label}</div>
                    <div className="text-[11px] text-slate-500">{entry.typeLabel}</div>
                  </div>
                  <Input
                    className="w-full px-2 text-center"
                    value={entry.dayCount}
                    aria-label={`Vacation days for ${entry.label} in ${week.label}`}
                    inputMode="numeric"
                    onCommit={(value) => updateVacationDays(entry.scope, value)}
                    as={DeferredNumberInput}
                  />
                  <button
                    type="button"
                    className="app-tooltip grid size-8 place-items-center rounded text-red-700 hover:bg-red-50 hover:text-red-800"
                    data-tooltip={`Remove vacation days for ${entry.label}`}
                    aria-label={`Remove vacation days for ${entry.label}`}
                    onClick={() => updateVacationDays(entry.scope, 0)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No vacation days set for this week.</p>
          )}
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Select
              className="w-full"
              value={newVacationScope}
              aria-label={`New vacation scope for ${week.label}`}
              onChange={(event) => setNewVacationScope(event.target.value)}
              disabled={availableVacationOptions.length === 0}
            >
              {availableVacationOptions.length === 0 ? <option value="">All scopes added</option> : null}
              {availableVacationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <button
              type="button"
              className="app-tooltip inline-flex h-9 items-center justify-center rounded border border-line bg-white px-3 text-sm font-medium hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
              data-tooltip="Add vacation scope"
              aria-label={`Add vacation scope for ${week.label}`}
              disabled={!newVacationScope}
              onClick={addVacationEntry}
            >
              <Plus size={16} />
            </button>
          </div>
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

function getVacationScopeOptions(document) {
  return [
    { value: 'global', label: 'Entire plan', typeLabel: 'Plan' },
    ...document.categories.map((category) => ({
      value: `category:${category.id}`,
      label: `Category: ${category.name}`,
      typeLabel: 'Category',
    })),
    ...document.tasks.map((task) => ({
      value: `task:${task.id}`,
      label: `Task: ${task.name}`,
      typeLabel: 'Task',
    })),
  ];
}

function getVacationEntries(document, week, options) {
  const optionsByValue = new Map(options.map((option) => [option.value, option]));
  const entries = [];
  const planDayCount = countPlanVacationDaysForWeek(week, document.plan?.vacations ?? []);

  if (planDayCount > 0) {
    entries.push({ ...optionsByValue.get('global'), scope: 'global', dayCount: planDayCount });
  }

  for (const category of document.categories) {
    const dayCount = (category.vacations ?? []).find((vacation) => vacation.weekIndex === week.weekIndex)?.dayCount ?? 0;
    const scope = `category:${category.id}`;
    if (dayCount > 0) {
      entries.push({ ...optionsByValue.get(scope), scope, dayCount });
    }
  }

  for (const task of document.tasks) {
    const dayCount = (task.vacations ?? []).find((vacation) => vacation.weekIndex === week.weekIndex)?.dayCount ?? 0;
    const scope = `task:${task.id}`;
    if (dayCount > 0) {
      entries.push({ ...optionsByValue.get(scope), scope, dayCount });
    }
  }

  return entries.filter((entry) => entry.label);
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
