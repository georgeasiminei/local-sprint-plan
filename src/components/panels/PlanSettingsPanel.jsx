import { useEffect, useState } from 'react';
import { useTimelineStore } from '../../store/index.js';
import { DEFAULT_ROW_HEIGHT, DEFAULT_WEEK_COLUMN_WIDTH } from '../../constants/defaults.js';
import Sidebar from '../layout/Sidebar.jsx';
import Badge from '../ui/Badge.jsx';
import Input from '../ui/Input.jsx';

export default function PlanSettingsPanel({ document }) {
  const closeSidebar = useTimelineStore((state) => state.closeSidebar);
  const updatePlanSettings = useTimelineStore((state) => state.updatePlanSettings);

  return (
    <Sidebar title="Settings" onClose={closeSidebar}>
      <div className="space-y-5">
        <section className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">
              Start year
              <Input
                className="mt-1 w-full"
                type="text"
                inputMode="numeric"
                value={document.plan.startYear ?? document.weeks[0]?.weekYear ?? new Date().getFullYear()}
                onChange={(event) => updatePlanSettings({ startYear: Number(event.target.value) })}
              />
            </label>
            <label className="block text-sm font-medium">
              Start week
              <Input
                className="mt-1 w-full"
                type="text"
                inputMode="numeric"
                value={document.plan.startWeek ?? document.weeks[0]?.weekIndex ?? 1}
                onChange={(event) => updatePlanSettings({ startWeek: Number(event.target.value) })}
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">
              Row height
              <DeferredSettingInput
                className="mt-1 w-full"
                value={document.plan.rowHeight ?? DEFAULT_ROW_HEIGHT}
                aria-label="Timeline row height in pixels"
                onCommit={(rowHeight) => updatePlanSettings({ rowHeight })}
              />
            </label>
            <label className="block text-sm font-medium">
              Week width
              <DeferredSettingInput
                className="mt-1 w-full"
                value={document.plan.weekColumnWidth ?? DEFAULT_WEEK_COLUMN_WIDTH}
                aria-label="Timeline week column width in pixels"
                onCommit={(weekColumnWidth) => updatePlanSettings({ weekColumnWidth })}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{document.weeks.length} calculated weeks</Badge>
            <Badge>{document.sprints.length} sprints</Badge>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={document.plan.showInternalDependencyLines !== false}
              onChange={(event) => updatePlanSettings({ showInternalDependencyLines: event.target.checked })}
            />
            Show internal dependency lines
          </label>
        </section>

        <p className="text-sm text-slate-500">
          Per-week resources, working days, and vacation person-days are edited by clicking a week header or total effort cell.
        </p>
      </div>
    </Sidebar>
  );
}

function DeferredSettingInput({ value, onCommit, ...props }) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commit() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft(String(value));
      return;
    }

    const nextValue = Number(trimmed);
    if (!Number.isFinite(nextValue)) {
      setDraft(String(value));
      return;
    }

    onCommit(nextValue);
  }

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        }
        if (event.key === 'Escape') {
          setDraft(String(value));
          event.currentTarget.blur();
        }
      }}
    />
  );
}
