import CategoryTaskGroup from './CategoryTaskGroup.jsx';
import EffortSummaryRow from './EffortSummaryRow.jsx';

export default function GridBody({ document, rowHeight, weekColumnWidth }) {
  const uncategorizedTasks = document.tasks.filter((task) => !task.categoryId);

  return (
    <div>
      {document.categories.map((category) => {
        const tasks = document.tasks.filter((task) => task.categoryId === category.id);
        return (
          <CategoryTaskGroup
            key={category.id}
            category={category}
            document={document}
            rowHeight={rowHeight}
            schedule={document.schedule}
            tasks={tasks}
            weeks={document.weeks}
            weekColumnWidth={weekColumnWidth}
          />
        );
      })}
      {uncategorizedTasks.length > 0 ? (
        <CategoryTaskGroup
          category={{ id: 'uncategorized', name: 'Uncategorized' }}
          document={document}
          isSynthetic
          rowHeight={rowHeight}
          schedule={document.schedule}
          tasks={uncategorizedTasks}
          weeks={document.weeks}
          weekColumnWidth={weekColumnWidth}
        />
      ) : null}
      {document.tasks.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-slate-500">No tasks yet.</div>
      ) : null}
      <EffortSummaryRow document={document} rowHeight={rowHeight} weekColumnWidth={weekColumnWidth} />
    </div>
  );
}
