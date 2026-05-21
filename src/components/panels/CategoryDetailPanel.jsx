import { useEffect, useRef } from 'react';
import { GitBranch, MoveDown, MoveUp, Trash2 } from 'lucide-react';
import { useTimelineStore } from '../../store/index.js';
import Sidebar from '../layout/Sidebar.jsx';
import Button from '../ui/Button.jsx';
import ColorPicker from '../ui/ColorPicker.jsx';
import Input from '../ui/Input.jsx';
import { getDependenciesForEntity, getDependencyEndpoint, getDependencyEntityName } from '../../utils/dependencies.js';

export default function CategoryDetailPanel({ document }) {
  const selectedCategoryId = useTimelineStore((state) => state.selectedCategoryId);
  const closeSidebar = useTimelineStore((state) => state.closeSidebar);
  const deleteCategoryWithGuard = useTimelineStore((state) => state.deleteCategoryWithGuard);
  const moveCategory = useTimelineStore((state) => state.moveCategory);
  const selectDependency = useTimelineStore((state) => state.selectDependency);
  const updateCategory = useTimelineStore((state) => state.updateCategory);
  const category = document.categories.find((item) => item.id === selectedCategoryId);
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (category?.name === 'New category') {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [category?.id, category?.name]);

  if (!category) {
    return (
      <Sidebar title="Category" onClose={closeSidebar}>
        <p className="text-sm text-slate-500">Select a category to edit it.</p>
      </Sidebar>
    );
  }

  const internalDependencies = getDependenciesForEntity(document, 'category', category.id);
  const orderedCategories = [...document.categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const categoryIndex = orderedCategories.findIndex((item) => item.id === category.id);
  const canMoveUp = categoryIndex > 0;
  const canMoveDown = categoryIndex >= 0 && categoryIndex < orderedCategories.length - 1;

  return (
    <Sidebar
      title="Category"
      onClose={closeSidebar}
      actions={
        <ReorderHeaderActions
          itemName={category.name}
          canMoveDown={canMoveDown}
          canMoveUp={canMoveUp}
          onMoveDown={() => moveCategory(category.id, 'down')}
          onMoveUp={() => moveCategory(category.id, 'up')}
        />
      }
    >
      <div className="space-y-4">
        <label className="block text-sm font-medium">
          Name
          <Input
            ref={nameInputRef}
            className="mt-1 w-full"
            value={category.name}
            onChange={(event) => updateCategory(category.id, { name: event.target.value })}
          />
        </label>

        <label className="block text-sm font-medium">
          Color
          <div className="mt-2">
            <ColorPicker value={category.color} onChange={(color) => updateCategory(category.id, { color })} />
          </div>
        </label>

        <InternalDependencySummary
          dependencies={internalDependencies}
          document={document}
          entityId={category.id}
          entityType="category"
          onSelect={selectDependency}
        />

        <Button
          variant="ghost"
          className="w-full justify-center text-red-700 hover:text-red-800"
          onClick={() => deleteCategoryWithGuard(category.id)}
        >
          <Trash2 size={16} />
          Delete category
        </Button>
      </div>
    </Sidebar>
  );
}

function ReorderHeaderActions({ canMoveDown, canMoveUp, itemName, onMoveDown, onMoveUp }) {
  return (
    <>
      <button
        type="button"
        className="app-tooltip grid size-7 place-items-center rounded text-slate-400 hover:bg-panel hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
        data-tooltip="Move up"
        aria-label={`Move ${itemName} up`}
        disabled={!canMoveUp}
        onClick={onMoveUp}
      >
        <MoveUp size={14} />
      </button>
      <button
        type="button"
        className="app-tooltip grid size-7 place-items-center rounded text-slate-400 hover:bg-panel hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
        data-tooltip="Move down"
        aria-label={`Move ${itemName} down`}
        disabled={!canMoveDown}
        onClick={onMoveDown}
      >
        <MoveDown size={14} />
      </button>
    </>
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
