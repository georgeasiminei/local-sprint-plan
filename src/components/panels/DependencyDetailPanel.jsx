import { useEffect, useState } from 'react';
import { CheckSquare, MinusSquare, Square, Trash2 } from 'lucide-react';
import { MAX_CALCULATED_WEEKS } from '../../constants/defaults.js';
import { topologicalSort } from '../../engine/dependencyGraph.js';
import { buildCalculatedWeeks } from '../../engine/timeline.js';
import { useTimelineStore } from '../../store/index.js';
import Sidebar from '../layout/Sidebar.jsx';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';

export default function DependencyDetailPanel({ document }) {
  const [mode, setMode] = useState('external');
  const [externalText, setExternalText] = useState('');
  const [externalDueWeekLabel, setExternalDueWeekLabel] = useState(getDefaultDueWeekLabel(document));
  const [predecessorId, setPredecessorId] = useState('');
  const [successorId, setSuccessorId] = useState('');
  const [lagWeeks, setLagWeeks] = useState(0);
  const [error, setError] = useState('');
  const addDependency = useTimelineStore((state) => state.addDependency);
  const addExternalDependency = useTimelineStore((state) => state.addExternalDependency);
  const closeSidebar = useTimelineStore((state) => state.closeSidebar);
  const deleteDependency = useTimelineStore((state) => state.deleteDependency);
  const deleteExternalDependencyWithGuard = useTimelineStore((state) => state.deleteExternalDependencyWithGuard);
  const requestWeekEdit = useTimelineStore((state) => state.requestWeekEdit);
  const selectedDependencyId = useTimelineStore((state) => state.selectedDependencyId);
  const selectedExternalDependencyId = useTimelineStore((state) => state.selectedExternalDependencyId);
  const updateDependency = useTimelineStore((state) => state.updateDependency);
  const updateExternalDependency = useTimelineStore((state) => state.updateExternalDependency);
  const internalDependency = (document.dependencies ?? []).find((item) => item.id === selectedDependencyId);
  const externalDependency = (document.externalDependencies ?? []).find((item) => item.id === selectedExternalDependencyId);

  useEffect(() => {
    setExternalDueWeekLabel(getDefaultDueWeekLabel(document));
  }, [document.plan?.startWeek, document.plan?.startYear]);

  if (internalDependency) {
    return (
      <Sidebar title="Internal dependency" onClose={closeSidebar}>
        <InternalDependencyEditor
          dependency={internalDependency}
          document={document}
          onDelete={() => deleteDependency(internalDependency.id)}
          onUpdate={updateDependency}
        />
      </Sidebar>
    );
  }

  if (externalDependency) {
    return (
      <Sidebar title="External dependency" onClose={closeSidebar}>
        <ExternalDependencyEditor
          dependency={externalDependency}
          document={document}
          onDelete={() => deleteExternalDependencyWithGuard(externalDependency.id)}
          onRequestWeekEdit={requestWeekEdit}
          onUpdate={updateExternalDependency}
        />
      </Sidebar>
    );
  }

  function createExternalDependency() {
    const text = externalText.trim();
    const dueWeek = parseDueWeekLabel(document, externalDueWeekLabel);
    if (!dueWeek) {
      setError('Use an ISO week such as 26.12.');
      return;
    }

    setError('');
    requestWeekEdit(getWeekByIndex(document.weeks, dueWeek), () => {
      addExternalDependency({
        name: getExternalDependencyTitle(text),
        dueWeek,
        notes: text,
        status: 'no',
      });
      setExternalText('');
      setExternalDueWeekLabel(getDefaultDueWeekLabel(document));
    });
  }

  function createInternalDependency() {
    setError('');

    if (!predecessorId || !successorId) {
      setError('Choose both tasks.');
      return;
    }

    if (predecessorId === successorId) {
      setError('A task cannot depend on itself.');
      return;
    }

    const candidateDependencies = [
      ...(document.dependencies ?? []),
      { id: 'candidate', predecessorId, successorId, lagWeeks: Number(lagWeeks) || 0 },
    ];
    if (topologicalSort(document.tasks, candidateDependencies).hasCycle) {
      setError('That dependency would create a cycle.');
      return;
    }

    addDependency(predecessorId, successorId, Number(lagWeeks) || 0);
    setPredecessorId('');
    setSuccessorId('');
    setLagWeeks(0);
  }

  return (
    <Sidebar title="Add dependency" onClose={closeSidebar}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Button variant={mode === 'external' ? 'primary' : 'secondary'} onClick={() => setMode('external')}>
            External
          </Button>
          <Button variant={mode === 'internal' ? 'primary' : 'secondary'} onClick={() => setMode('internal')}>
            Internal
          </Button>
        </div>

        {mode === 'external' ? (
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              Text
              <textarea
                className="mt-1 min-h-24 w-full rounded border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus/20"
                placeholder="Expected external input"
                value={externalText}
                onChange={(event) => setExternalText(event.target.value)}
              />
            </label>
            <label className="block text-sm font-medium">
              Due week
              <Input
                className="mt-1 w-full"
                type="text"
                inputMode="numeric"
                value={externalDueWeekLabel}
                onChange={(event) => setExternalDueWeekLabel(event.target.value)}
              />
            </label>
            {error ? <p className="text-xs text-red-700">{error}</p> : null}
            <Button className="w-full justify-center" onClick={createExternalDependency}>
              Add external dependency
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm font-medium">
              Depends on
              <TaskSelect
                className="mt-1 w-full"
                document={document}
                placeholder="Predecessor task"
                value={predecessorId}
                onChange={setPredecessorId}
              />
            </label>
            <label className="block text-sm font-medium">
              Task
              <TaskSelect
                className="mt-1 w-full"
                document={document}
                placeholder="Successor task"
                value={successorId}
                onChange={setSuccessorId}
              />
            </label>
            <label className="block text-sm font-medium">
              Lag weeks
              <Input
                className="mt-1 w-full"
                type="text"
                inputMode="numeric"
                value={lagWeeks}
                onChange={(event) => setLagWeeks(Number(event.target.value))}
              />
            </label>
            {error ? <p className="text-xs text-red-700">{error}</p> : null}
            <Button className="w-full justify-center" onClick={createInternalDependency}>
              Add internal dependency
            </Button>
          </div>
        )}

        <DependencyLists document={document} />
      </div>
    </Sidebar>
  );
}

function InternalDependencyEditor({ dependency, document, onDelete, onUpdate }) {
  const taskById = new Map(document.tasks.map((task) => [task.id, task]));

  return (
    <div className="space-y-4">
      <div className="rounded border border-line p-3 text-sm">
        <div className="font-medium">{taskById.get(dependency.successorId)?.name ?? 'Missing task'}</div>
        <div className="text-slate-500">depends on {taskById.get(dependency.predecessorId)?.name ?? 'Missing task'}</div>
      </div>
      <label className="block text-sm font-medium">
        Lag weeks
        <Input
          className="mt-1 w-full"
          type="text"
          inputMode="numeric"
          value={dependency.lagWeeks ?? 0}
          onChange={(event) => onUpdate(dependency.id, { lagWeeks: Number(event.target.value) })}
        />
      </label>
      <Button variant="ghost" className="w-full justify-center text-red-700 hover:text-red-800" onClick={onDelete}>
        <Trash2 size={16} />
        Delete dependency
      </Button>
    </div>
  );
}

function ExternalDependencyEditor({ dependency, document, onDelete, onRequestWeekEdit, onUpdate }) {
  const dependencyText = dependency.notes || dependency.name;
  const dueWeekLabel = getWeekLabelByIndex(document, dependency.dueWeek ?? dependency.endWeek ?? dependency.startWeek);

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium">
        Text
        <textarea
          className="mt-1 min-h-24 w-full rounded border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus/20"
          value={dependencyText}
          onChange={(event) => {
            const text = event.target.value;
            onUpdate(dependency.id, {
              name: getExternalDependencyTitle(text),
              notes: text,
            });
          }}
        />
      </label>

      <label className="block text-sm font-medium">
        Due week
        <DeferredTextInput
          className="mt-1 w-full"
          value={dueWeekLabel}
          onCommit={(value) => {
            const dueWeek = parseDueWeekLabel(document, value);
            if (!dueWeek) {
              return;
            }
            onRequestWeekEdit(getWeekByIndex(document.weeks, dueWeek), () => onUpdate(dependency.id, { dueWeek }));
          }}
        />
      </label>

      <StatusCycleButton
        status={dependency.status ?? 'no'}
        onCycle={() => onUpdate(dependency.id, { status: getNextStatus(dependency.status) })}
      />

      <Button variant="ghost" className="w-full justify-center text-red-700 hover:text-red-800" onClick={onDelete}>
        <Trash2 size={16} />
        Delete dependency
      </Button>
    </div>
  );
}

function DependencyLists({ document }) {
  const selectDependency = useTimelineStore((state) => state.selectDependency);
  const selectExternalDependency = useTimelineStore((state) => state.selectExternalDependency);
  const taskById = new Map(document.tasks.map((task) => [task.id, task]));

  if ((document.dependencies ?? []).length === 0 && (document.externalDependencies ?? []).length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 border-t border-line pt-3">
      {(document.dependencies ?? []).map((dependency) => (
        <button
          key={dependency.id}
          type="button"
          className="w-full rounded border border-line px-3 py-2 text-left text-xs hover:bg-panel"
          onClick={() => selectDependency(dependency.id)}
        >
          <span className="font-medium">{taskById.get(dependency.successorId)?.name ?? 'Missing task'}</span>
          <span className="text-slate-500"> depends on {taskById.get(dependency.predecessorId)?.name ?? 'Missing task'}</span>
        </button>
      ))}
      {(document.externalDependencies ?? []).map((dependency) => (
        <button
          key={dependency.id}
          type="button"
          className="w-full rounded border border-line px-3 py-2 text-left text-xs hover:bg-panel"
          onClick={() => selectExternalDependency(dependency.id)}
        >
          <span className="font-medium">{dependency.name}</span>
          <span className="text-slate-500"> due {getWeekLabelByIndex(document, dependency.dueWeek)}</span>
        </button>
      ))}
    </div>
  );
}

function TaskSelect({ className, document, onChange, placeholder, value }) {
  return (
    <Select className={className} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{placeholder}</option>
      {document.tasks.map((task) => (
        <option key={task.id} value={task.id}>
          {task.name}
        </option>
      ))}
    </Select>
  );
}

function StatusCycleButton({ status, onCycle }) {
  const normalizedStatus = ['yes', 'partial', 'no'].includes(status) ? status : 'no';
  const labels = {
    no: 'Completed: No',
    partial: 'Completed: Partially',
    yes: 'Completed: Yes',
  };
  const icons = {
    no: <Square size={15} />,
    partial: <MinusSquare size={15} />,
    yes: <CheckSquare size={15} />,
  };
  const ariaChecked = normalizedStatus === 'partial' ? 'mixed' : normalizedStatus === 'yes';

  return (
    <Button
      variant="secondary"
      className="w-full justify-center"
      role="checkbox"
      aria-checked={ariaChecked}
      onClick={onCycle}
    >
      {icons[normalizedStatus]}
      {labels[normalizedStatus]}
    </Button>
  );
}

function getNextStatus(status) {
  if (status === 'no') {
    return 'partial';
  }

  if (status === 'partial') {
    return 'yes';
  }

  return 'no';
}

function getExternalDependencyTitle(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean) || 'External dependency';
}

function getWeekByIndex(weeks, weekIndex) {
  return weeks.find((week) => week.weekIndex === weekIndex);
}

function getDefaultDueWeekLabel(document) {
  return document.weeks[0]?.label ?? getWeekLabelByIndex(document, document.plan?.startWeek ?? 1);
}

function getWeekLabelByIndex(document, weekIndex) {
  const week = document.weeks.find((item) => item.weekIndex === weekIndex);
  if (week) {
    return week.label;
  }

  return buildCalculatedWeeks(
    document.plan?.startWeek,
    Math.max(1, (weekIndex ?? document.plan?.startWeek ?? 1) - (document.plan?.startWeek ?? 1) + 1),
    document.plan?.startYear,
  ).find((item) => item.weekIndex === weekIndex)?.label ?? '';
}

function parseDueWeekLabel(document, value) {
  const normalized = String(value ?? '').trim();
  const candidateWeeks = buildCalculatedWeeks(
    document.plan?.startWeek,
    MAX_CALCULATED_WEEKS,
    document.plan?.startYear,
  );
  const byLabel = candidateWeeks.find((week) => week.label === normalized);
  if (byLabel) {
    return byLabel.weekIndex;
  }

  const directWeek = Number(normalized);
  return Number.isInteger(directWeek) && directWeek > 0 ? directWeek : null;
}

function DeferredTextInput({ value, onCommit, ...props }) {
  const [draft, setDraft] = useState(value ?? '');

  useEffect(() => {
    setDraft(value ?? '');
  }, [value]);

  function commit() {
    if (draft !== value) {
      onCommit(draft);
    }
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
          setDraft(value ?? '');
          event.currentTarget.blur();
        }
      }}
    />
  );
}
