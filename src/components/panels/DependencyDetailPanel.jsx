import { useEffect, useState } from 'react';
import { CheckSquare, MinusSquare, Square, Trash2 } from 'lucide-react';
import { MAX_CALCULATED_WEEKS } from '../../constants/defaults.js';
import { wouldCreateDependencyCycle } from '../../engine/dependencyGraph.js';
import { buildCalculatedWeeks } from '../../engine/timeline.js';
import { useTimelineStore } from '../../store/index.js';
import {
  getDependencyEndpoint,
  getDependencyEntityName,
  getDependencyEntityOptions,
} from '../../utils/dependencies.js';
import Sidebar from '../layout/Sidebar.jsx';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';

export default function DependencyDetailPanel({ document }) {
  const [mode, setMode] = useState('external');
  const [externalText, setExternalText] = useState('');
  const [externalDueWeekLabel, setExternalDueWeekLabel] = useState(getDefaultDueWeekLabel(document));
  const [predecessorType, setPredecessorType] = useState('task');
  const [predecessorId, setPredecessorId] = useState('');
  const [successorType, setSuccessorType] = useState('task');
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
  const selectedWeekIndex = useTimelineStore((state) => state.selectedWeekIndex);
  const updateDependency = useTimelineStore((state) => state.updateDependency);
  const updateExternalDependency = useTimelineStore((state) => state.updateExternalDependency);
  const internalDependency = (document.dependencies ?? []).find((item) => item.id === selectedDependencyId);
  const externalDependency = (document.externalDependencies ?? []).find((item) => item.id === selectedExternalDependencyId);

  useEffect(() => {
    setExternalDueWeekLabel(getDefaultDueWeekLabel(document, selectedWeekIndex));
  }, [document.plan?.startWeek, document.plan?.startYear, selectedWeekIndex]);

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
      setExternalDueWeekLabel(getDefaultDueWeekLabel(document, selectedWeekIndex));
    });
  }

  function createInternalDependency() {
    setError('');

    if (!predecessorId || !successorId) {
      setError('Choose both items.');
      return;
    }

    if (predecessorType === successorType && predecessorId === successorId) {
      setError('An item cannot depend on itself.');
      return;
    }

    const candidate = {
      id: 'candidate',
      predecessorId,
      predecessorType,
      successorId,
      successorType,
      lagWeeks: Number(lagWeeks) || 0,
    };
    if (wouldCreateDependencyCycle(document, candidate)) {
      setError('That dependency would create a cycle.');
      return;
    }

    addDependency(predecessorId, successorId, Number(lagWeeks) || 0, predecessorType, successorType);
    setPredecessorType('task');
    setPredecessorId('');
    setSuccessorType('task');
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
              <DependencyEntitySelect
                className="mt-1 w-full"
                document={document}
                type={predecessorType}
                disabledOptionIds={getBlockedEndpointIds(document, {
                  side: 'predecessor',
                  type: predecessorType,
                  oppositeType: successorType,
                  oppositeId: successorId,
                })}
                onTypeChange={(type) => {
                  setPredecessorType(type);
                  setPredecessorId('');
                }}
                placeholder={`Predecessor ${predecessorType}`}
                value={predecessorId}
                onChange={setPredecessorId}
              />
            </label>
            <label className="block text-sm font-medium">
              Waiting item
              <DependencyEntitySelect
                className="mt-1 w-full"
                document={document}
                type={successorType}
                disabledOptionIds={getBlockedEndpointIds(document, {
                  side: 'successor',
                  type: successorType,
                  oppositeType: predecessorType,
                  oppositeId: predecessorId,
                })}
                onTypeChange={(type) => {
                  setSuccessorType(type);
                  setSuccessorId('');
                }}
                placeholder={`Waiting ${successorType}`}
                value={successorId}
                onChange={setSuccessorId}
              />
            </label>
            {predecessorId || successorId ? (
              <p className="text-xs text-slate-500">Choices that would create a circular dependency are disabled.</p>
            ) : null}
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
  const [error, setError] = useState('');
  const predecessor = getDependencyEndpoint(document, dependency, 'predecessor');
  const successor = getDependencyEndpoint(document, dependency, 'successor');
  const [draftPredecessorType, setDraftPredecessorType] = useState(predecessor.type ?? 'task');
  const [draftPredecessorId, setDraftPredecessorId] = useState(predecessor.id ?? '');
  const [draftSuccessorType, setDraftSuccessorType] = useState(successor.type ?? 'task');
  const [draftSuccessorId, setDraftSuccessorId] = useState(successor.id ?? '');

  useEffect(() => {
    setDraftPredecessorType(predecessor.type ?? 'task');
    setDraftPredecessorId(predecessor.id ?? '');
    setDraftSuccessorType(successor.type ?? 'task');
    setDraftSuccessorId(successor.id ?? '');
  }, [predecessor.id, predecessor.type, successor.id, successor.type]);

  function commitEndpointPatch(patch) {
    const candidate = { ...dependency, ...patch };
    const nextPredecessor = getDependencyEndpoint(document, candidate, 'predecessor');
    const nextSuccessor = getDependencyEndpoint(document, candidate, 'successor');

    if (
      nextPredecessor.type === nextSuccessor.type &&
      nextPredecessor.id &&
      nextPredecessor.id === nextSuccessor.id
    ) {
      setError('An item cannot depend on itself.');
      return;
    }

    if (wouldCreateDependencyCycle(document, candidate, dependency.id)) {
      setError('That change would create a cycle.');
      return;
    }

    setError('');
    onUpdate(dependency.id, patch);
  }

  return (
    <div className="space-y-4">
      <div className="rounded border border-line p-3 text-sm">
        <div className="font-medium">
          {getDependencyEntityName(document, successor.type, successor.id)}
        </div>
        <div className="text-slate-500">
          depends on {getDependencyEntityName(document, predecessor.type, predecessor.id)}
        </div>
      </div>
      <label className="block text-sm font-medium">
        Depends on
        <DependencyEntitySelect
          className="mt-1 w-full"
          document={document}
          type={draftPredecessorType}
          disabledOptionIds={getBlockedEndpointIds(document, {
            side: 'predecessor',
            type: draftPredecessorType,
            oppositeType: draftSuccessorType,
            oppositeId: draftSuccessorId,
            dependencyId: dependency.id,
            currentValue: draftPredecessorId,
          })}
          onTypeChange={(type) => {
            setDraftPredecessorType(type);
            setDraftPredecessorId('');
            setError('');
          }}
          placeholder={`Predecessor ${draftPredecessorType}`}
          value={draftPredecessorId}
          onChange={(value) => {
            setDraftPredecessorId(value);
            commitEndpointPatch({ predecessorType: draftPredecessorType, predecessorId: value });
          }}
        />
      </label>
      <label className="block text-sm font-medium">
        Waiting item
        <DependencyEntitySelect
          className="mt-1 w-full"
          document={document}
          type={draftSuccessorType}
          disabledOptionIds={getBlockedEndpointIds(document, {
            side: 'successor',
            type: draftSuccessorType,
            oppositeType: draftPredecessorType,
            oppositeId: draftPredecessorId,
            dependencyId: dependency.id,
            currentValue: draftSuccessorId,
          })}
          onTypeChange={(type) => {
            setDraftSuccessorType(type);
            setDraftSuccessorId('');
            setError('');
          }}
          placeholder={`Waiting ${draftSuccessorType}`}
          value={draftSuccessorId}
          onChange={(value) => {
            setDraftSuccessorId(value);
            commitEndpointPatch({ successorType: draftSuccessorType, successorId: value });
          }}
        />
      </label>
      <p className="text-xs text-slate-500">Choices that would create a circular dependency are disabled.</p>
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
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
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
  const selectedDependencyId = useTimelineStore((state) => state.selectedDependencyId);
  const selectedExternalDependencyId = useTimelineStore((state) => state.selectedExternalDependencyId);

  if ((document.dependencies ?? []).length === 0 && (document.externalDependencies ?? []).length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 border-t border-line pt-3">
      {(document.dependencies ?? []).map((dependency) => (
        <button
          key={dependency.id}
          type="button"
          className={`app-tooltip w-full rounded border border-line px-3 py-2 text-left text-xs hover:bg-panel ${
            selectedDependencyId === dependency.id ? 'bg-panel font-bold border-focus ring-1 ring-focus/40' : ''
          }`}
          data-tooltip="Open internal dependency"
          onClick={() => selectDependency(dependency.id)}
        >
          <span className="font-medium">{formatDependencyEndpoint(document, dependency, 'successor')}</span>
          <span className="text-slate-500"> depends on {formatDependencyEndpoint(document, dependency, 'predecessor')}</span>
        </button>
      ))}
      {(document.externalDependencies ?? []).map((dependency) => (
        <button
          key={dependency.id}
          type="button"
          className={`app-tooltip w-full rounded border border-line px-3 py-2 text-left text-xs hover:bg-panel ${
            selectedExternalDependencyId === dependency.id ? 'bg-panel font-bold border-focus ring-1 ring-focus/40' : ''
          }`}
          data-tooltip="Open external dependency"
          onClick={() => selectExternalDependency(dependency.id)}
        >
          <span className="font-medium">{dependency.name}</span>
          <span className="text-slate-500"> due {getWeekLabelByIndex(document, dependency.dueWeek)}</span>
        </button>
      ))}
    </div>
  );
}

function DependencyEntitySelect({
  className,
  disabledOptionIds = [],
  document,
  onChange,
  onTypeChange,
  placeholder,
  type,
  value,
}) {
  const options = getDependencyEntityOptions(document, type);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {['task', 'category'].map((candidateType) => (
          <Button
            key={candidateType}
            type="button"
            variant={type === candidateType ? 'primary' : 'secondary'}
            onClick={() => onTypeChange(candidateType)}
          >
            {candidateType === 'task' ? 'Task' : 'Category'}
          </Button>
        ))}
      </div>
      <Select className={className} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id} disabled={disabledOptionIds.includes(option.id)}>
            {option.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

function getBlockedEndpointIds(document, { side, type, oppositeType, oppositeId, dependencyId = null, currentValue = '' }) {
  if (!oppositeId) {
    return [];
  }

  return getDependencyEntityOptions(document, type)
    .filter((option) => option.id !== currentValue)
    .filter((option) => {
      const candidate =
        side === 'predecessor'
          ? {
              id: dependencyId ?? 'candidate',
              predecessorId: option.id,
              predecessorType: type,
              successorId: oppositeId,
              successorType: oppositeType,
            }
          : {
              id: dependencyId ?? 'candidate',
              predecessorId: oppositeId,
              predecessorType: oppositeType,
              successorId: option.id,
              successorType: type,
            };

      const isSelfDependency =
        candidate.predecessorType === candidate.successorType &&
        candidate.predecessorId === candidate.successorId;

      return isSelfDependency || wouldCreateDependencyCycle(document, candidate, dependencyId);
    })
    .map((option) => option.id);
}

function formatDependencyEndpoint(document, dependency, side) {
  const endpoint = getDependencyEndpoint(document, dependency, side);
  const prefix = endpoint.type === 'category' ? 'Category: ' : 'Task: ';
  return `${prefix}${getDependencyEntityName(document, endpoint.type, endpoint.id)}`;
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

function getDefaultDueWeekLabel(document, selectedWeekIndex) {
  if (selectedWeekIndex !== null && selectedWeekIndex !== undefined) {
    return getWeekLabelByIndex(document, selectedWeekIndex);
  }
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
