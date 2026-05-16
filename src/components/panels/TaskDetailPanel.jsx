import { useEffect, useMemo, useRef } from 'react';
import { GitBranch, Trash2 } from 'lucide-react';
import { useTimelineStore } from '../../store/index.js';
import Sidebar from '../layout/Sidebar.jsx';
import Button from '../ui/Button.jsx';
import ColorPicker from '../ui/ColorPicker.jsx';
import Input from '../ui/Input.jsx';
import Select from '../ui/Select.jsx';
import { getDependenciesForEntity, getDependencyEndpoint, getDependencyEntityName } from '../../utils/dependencies.js';
import { isTaskCompletionAvailable } from '../../engine/taskCompletion.js';

export default function TaskDetailPanel({ document }) {
  const selectedTaskId = useTimelineStore((state) => state.selectedTaskId);
  const updateTask = useTimelineStore((state) => state.updateTask);
  const closeSidebar = useTimelineStore((state) => state.closeSidebar);
  const deleteTaskWithGuard = useTimelineStore((state) => state.deleteTaskWithGuard);
  const setTaskCompleted = useTimelineStore((state) => state.setTaskCompleted);
  const selectDependency = useTimelineStore((state) => state.selectDependency);
  const task = useMemo(
    () => document.tasks.find((item) => item.id === selectedTaskId) ?? document.tasks[0],
    [document.tasks, selectedTaskId],
  );
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (/^Task \d+$/.test(task?.name ?? '')) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [task?.id, task?.name]);

  if (!task) {
    return (
      <Sidebar title="Task" onClose={closeSidebar}>
        <p className="text-sm text-slate-500">Select a task to edit details.</p>
      </Sidebar>
    );
  }

  const internalDependencies = getDependenciesForEntity(document, 'task', task.id);
  const canCompleteTask = isTaskCompletionAvailable(document, task.id);

  return (
    <Sidebar title="Task" onClose={closeSidebar}>
      <div className="space-y-4">
        <label className="block text-sm font-medium">
          Name
          <Input
            ref={nameInputRef}
            className="mt-1 w-full"
            value={task.name}
            onChange={(event) => updateTask(task.id, { name: event.target.value })}
          />
        </label>

        <label className="block text-sm font-medium">
          Category
          <Select
            className="mt-1 w-full"
            value={task.categoryId ?? ''}
            onChange={(event) => updateTask(task.id, { categoryId: event.target.value || null })}
          >
            <option value="">Uncategorized</option>
            {document.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            Priority
            <Input
              className="mt-1 w-full"
              type="text"
              inputMode="numeric"
              value={task.priority}
              onChange={(event) => updateTask(task.id, { priority: Number(event.target.value) })}
            />
          </label>
          <label className="block text-sm font-medium">
            Estimate
            <Input
              className="mt-1 w-full"
              type="text"
              inputMode="decimal"
              value={task.estimateWeeks}
              onChange={(event) => updateTask(task.id, { estimateWeeks: Number(event.target.value) })}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">
            Earliest week
            <Input
              className="mt-1 w-full"
              type="text"
              inputMode="numeric"
              value={task.earliestStartWeek ?? ''}
              placeholder="Any"
              onChange={(event) =>
                updateTask(task.id, {
                  earliestStartWeek: event.target.value === '' ? null : Number(event.target.value),
                })
              }
            />
          </label>
          <label className="block text-sm font-medium">
            Max resources
            <Input
              className="mt-1 w-full"
              type="text"
              inputMode="decimal"
              value={task.maxResources ?? ''}
              placeholder="No cap"
              onChange={(event) =>
                updateTask(task.id, {
                  maxResources: event.target.value === '' ? null : Number(event.target.value),
                })
              }
            />
          </label>
        </div>

        <label className="block text-sm font-medium">
          Row color
          <div className="mt-2">
            <ColorPicker value={task.highlightColor} onChange={(color) => updateTask(task.id, { highlightColor: color })} />
          </div>
        </label>

        <label className="block text-sm font-medium">
          Notes
          <textarea
            className="mt-1 min-h-24 w-full rounded border border-line bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-focus/20"
            value={task.notes ?? ''}
            onChange={(event) => updateTask(task.id, { notes: event.target.value })}
          />
        </label>

        {canCompleteTask || task.completed ? (
          <label className="flex items-start gap-2 rounded border border-line p-3 text-sm">
            <input
              className="mt-0.5"
              type="checkbox"
              checked={Boolean(task.completed)}
              onChange={(event) => setTaskCompleted(task.id, event.target.checked)}
            />
            <span>
              <span className="block font-medium">Completed</span>
              <span className="block text-xs text-slate-500">
                Freeze this task&apos;s actual resource history once it is in its final week or already in the past.
              </span>
            </span>
          </label>
        ) : null}

        {task.completed ? (
          <p className="text-xs text-slate-500">
            Completed task history is frozen; resource cells for this task are locked.
          </p>
        ) : null}

        <InternalDependencySummary
          dependencies={internalDependencies}
          document={document}
          entityId={task.id}
          entityType="task"
          onSelect={selectDependency}
        />

        <Button variant="ghost" className="w-full justify-center text-red-700 hover:text-red-800" onClick={() => deleteTaskWithGuard(task.id)}>
          <Trash2 size={16} />
          Delete task
        </Button>
      </div>
    </Sidebar>
  );
}

function InternalDependencySummary({ dependencies, document, entityId, entityType, onSelect }) {
  if (dependencies.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2 rounded border border-line p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <GitBranch size={15} />
        Internal dependencies
      </div>
      <div className="space-y-2">
        {dependencies.map((dependency) => {
          const predecessor = getDependencyEndpoint(document, dependency, 'predecessor');
          const successor = getDependencyEndpoint(document, dependency, 'successor');
          const isIncoming = successor.type === entityType && successor.id === entityId;
          const other = isIncoming ? predecessor : successor;

          return (
            <button
              key={dependency.id}
              type="button"
              className="app-tooltip w-full rounded border border-line px-3 py-2 text-left text-xs hover:bg-panel"
              data-tooltip="Open internal dependency"
              onClick={() => onSelect(dependency.id)}
            >
              <span className="font-medium">{isIncoming ? 'Depends on' : 'Blocks'}</span>{' '}
              <span>{other.type === 'category' ? 'category ' : 'task '}</span>
              <span className="font-medium">{getDependencyEntityName(document, other.type, other.id)}</span>
              {dependency.lagWeeks ? <span className="text-slate-500"> · lag {dependency.lagWeeks}</span> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
