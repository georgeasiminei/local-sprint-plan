import GridHeader from './GridHeader.jsx';
import GridBody from './GridBody.jsx';
import ExternalDependencyNotes from './ExternalDependencyNotes.jsx';
import OverlayLines from './OverlayLines.jsx';
import { DEFAULT_TIMELINE_ROW_HEIGHT, DEFAULT_WEEK_COLUMN_WIDTH, LEFT_COLUMN_WIDTH } from './layout.js';
import { createVisibleTimelineDocument } from './viewWindow.js';

export default function TimelineGrid({ document, allocationView = 'resource' }) {
  const rowHeight = Math.max(16, Math.min(48, Number(document.plan?.rowHeight) || DEFAULT_TIMELINE_ROW_HEIGHT));
  const weekColumnWidth = Math.max(
    24,
    Math.min(120, Number(document.plan?.weekColumnWidth) || DEFAULT_WEEK_COLUMN_WIDTH),
  );
  const visibleDocument = createVisibleTimelineDocument(document);
  const minWidth = LEFT_COLUMN_WIDTH + Math.max(visibleDocument.weeks.length, 1) * weekColumnWidth;

  return (
    <div className="overflow-x-auto overflow-y-hidden">
      <div className="relative" style={{ minWidth }}>
        <GridHeader weeks={visibleDocument.weeks} sprints={visibleDocument.sprints} weekColumnWidth={weekColumnWidth} />
        <GridBody document={visibleDocument} allocationView={allocationView} rowHeight={rowHeight} weekColumnWidth={weekColumnWidth} />
        <ExternalDependencyNotes document={visibleDocument} weekColumnWidth={weekColumnWidth} />
        <OverlayLines document={visibleDocument} weekColumnWidth={weekColumnWidth} />
      </div>
    </div>
  );
}
