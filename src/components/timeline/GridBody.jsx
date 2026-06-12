import CategoryTaskGroup from './CategoryTaskGroup.jsx';
import EffortSummaryRow from './EffortSummaryRow.jsx';
import { useTimelineStore } from '../../store/index.js';
import { getExternalDependencyHighlightTaskIds } from '../../utils/externalDependencyHighlights.js';

export default function GridBody({ document, allocationView, rowHeight, weekColumnWidth }) {
  const hoveredExternalDependencyId = useTimelineStore((state) => state.hoveredExternalDependencyId);
  const uncategorizedTasks = document.tasks.filter((task) => !task.categoryId);
  const categories = [...document.categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const highlightedTaskIds = getExternalDependencyHighlightTaskIds(document, hoveredExternalDependencyId);

  return (
    <div>
      {categories.map((category) => {
        const tasks = document.tasks.filter((task) => task.categoryId === category.id);
        return (
          <CategoryTaskGroup
            key={category.id}
            category={category}
            document={document}
            rowHeight={rowHeight}
            allocationView={allocationView}
            schedule={document.schedule}
            tasks={tasks}
            weeks={document.weeks}
            weekColumnWidth={weekColumnWidth}
            highlightedTaskIds={highlightedTaskIds}
          />
        );
      })}
      {uncategorizedTasks.length > 0 ? (
        <CategoryTaskGroup
          category={{ id: 'uncategorized', name: 'Uncategorized' }}
          document={document}
          isSynthetic
          rowHeight={rowHeight}
          allocationView={allocationView}
          schedule={document.schedule}
          tasks={uncategorizedTasks}
          weeks={document.weeks}
          weekColumnWidth={weekColumnWidth}
          highlightedTaskIds={highlightedTaskIds}
        />
      ) : null}
      {document.tasks.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-slate-500">No tasks yet.</div>
      ) : null}
      <EffortSummaryRow
        document={document}
        allocationView={allocationView}
        rowHeight={rowHeight}
        weekColumnWidth={weekColumnWidth}
      />
    </div>
  );
}
