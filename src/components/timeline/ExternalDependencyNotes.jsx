import { useTimelineStore } from '../../store/index.js';
import { CATEGORY_COLUMN_WIDTH, TASK_COLUMN_WIDTH } from './layout.js';

const NOTE_BOX_WIDTH = 224;
const MIN_CENTERED_BOX_WIDTH = 120;

export default function ExternalDependencyNotes({ document, weekColumnWidth }) {
  const selectExternalDependency = useTimelineStore((state) => state.selectExternalDependency);
  const markers = createExternalDependencyNoteMarkers(document, weekColumnWidth);

  if (markers.length === 0) {
    return null;
  }

  const rowCount = Math.max(1, ...markers.flatMap((marker) => marker.boxes.map((box) => box.stack + 1)));
  const laneHeight = Math.max(84, rowCount * 48 + 24);

  return (
    <div
      className="relative z-10 grid border-b border-line"
      style={{ gridTemplateColumns: `${CATEGORY_COLUMN_WIDTH}px ${TASK_COLUMN_WIDTH}px 1fr`, minHeight: laneHeight }}
    >
      <div className="sticky left-0 top-0 z-[6] border-r border-line bg-slate-50" />
      <div
        className="sticky top-0 z-[5] flex items-start border-r border-line bg-slate-50 px-2 py-2 text-[10px] font-semibold uppercase text-slate-500"
        style={{ left: CATEGORY_COLUMN_WIDTH }}
      >
        Dependencies
      </div>
      <div className="relative col-start-3">
        {markers.map((marker) => (
          <div key={marker.key} className="absolute top-0 h-full" style={{ left: marker.left }}>
            {marker.boxes.map((box) => (
              <button
                key={box.key}
                type="button"
                className={`app-tooltip !absolute truncate rounded border px-2 py-1.5 text-[11px] shadow-panel transition hover:brightness-95 ${
                  box.className
                } ${getBoxTextAlignmentClass(box.side)}`}
                data-tooltip={box.text}
                title={box.text}
                style={{ top: `${12 + box.stack * 34}px`, width: box.width, ...getBoxPositionStyle(box) }}
                onClick={() => selectExternalDependency(box.id)}
              >
                {getBoxLabel(box)}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function createExternalDependencyNoteMarkers(document, weekColumnWidth) {
  const groups = new Map();
  const weekCount = document.weeks?.length ?? 0;

  for (const dependency of document.externalDependencies ?? []) {
    const dueWeek = dependency.dueWeek ?? dependency.endWeek ?? dependency.startWeek;
    if (!dueWeek) {
      continue;
    }

    const items = groups.get(dueWeek) ?? [];
    items.push(dependency);
    groups.set(dueWeek, items);
  }

  return [...groups.entries()]
    .map(([dueWeek, dependencies]) => {
      const weekIndex = document.weeks.findIndex((week) => week.weekIndex === dueWeek);
      if (weekIndex === -1) {
        return null;
      }

      const lineIndex = weekIndex + 1;
      return {
        key: `external-notes-${dueWeek}`,
        left: `${lineIndex * weekColumnWidth}px`,
        boxes: dependencies.map((dependency, index) => {
          const placement = getBoxPlacement({
            lineIndex,
            weekCount,
            weekColumnWidth,
          });
          const style = getExternalDependencyStyle(dependency.status);
          return {
            id: dependency.id,
            key: dependency.id,
            side: placement.side,
            width: placement.width,
            stack: index,
            text: dependency.notes || dependency.name,
            className: style.boxClass,
          };
        }),
      };
    })
    .filter(Boolean);
}

function getBoxPlacement({ lineIndex, weekCount, weekColumnWidth }) {
  const leftSpace = lineIndex * weekColumnWidth;
  const rightSpace = (weekCount - lineIndex) * weekColumnWidth;
  const centeredWidth = Math.min(NOTE_BOX_WIDTH, Math.max(0, 2 * Math.min(leftSpace, rightSpace) - 16));

  if (centeredWidth >= MIN_CENTERED_BOX_WIDTH) {
    return { side: 'center', width: centeredWidth };
  }

  if (leftSpace >= rightSpace) {
    return { side: 'left', width: Math.max(32, Math.min(NOTE_BOX_WIDTH, leftSpace - 16)) };
  }

  return { side: 'right', width: Math.max(32, Math.min(NOTE_BOX_WIDTH, rightSpace - 16)) };
}

function getBoxTextAlignmentClass(side) {
  if (side === 'center') {
    return 'text-center';
  }

  return side === 'left' ? 'text-right' : 'text-left';
}

function getBoxPositionStyle(box) {
  if (box.side === 'center') {
    return { left: `${-box.width / 2}px` };
  }

  return box.side === 'left' ? { right: '8px' } : { left: '8px' };
}

function getBoxLabel(box) {
  if (box.side === 'center') {
    return box.text;
  }

  return box.side === 'left' ? `${box.text} ->` : `<- ${box.text}`;
}

function getExternalDependencyStyle(status) {
  if (status === 'yes') {
    return {
      boxClass: 'border-emerald-300 bg-emerald-50 text-emerald-950',
    };
  }

  if (status === 'partial') {
    return {
      boxClass: 'border-slate-300 bg-white text-slate-700',
    };
  }

  return {
    boxClass: 'border-red-300 bg-red-100 text-red-950',
  };
}
