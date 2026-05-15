import { useTimelineStore } from '../../store/index.js';
import { CATEGORY_COLUMN_WIDTH, TASK_COLUMN_WIDTH } from './layout.js';

const NOTE_BOX_WIDTH = 224;

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
                className={`app-tooltip absolute whitespace-pre-line break-words rounded border px-2 py-1.5 text-[11px] shadow-panel transition hover:brightness-95 ${
                  box.className
                } ${box.side === 'left' ? 'right-2 text-right' : 'left-2 text-left'}`}
                data-tooltip="Open external dependency"
                style={{ top: `${12 + box.stack * 46}px`, width: box.width }}
                onClick={() => selectExternalDependency(box.id)}
              >
                {box.side === 'left' ? `${box.text} ->` : `<- ${box.text}`}
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
          const side = chooseBoxSide({
            index,
            lineIndex,
            weekCount,
            weekColumnWidth,
          });
          const width = getBoxWidth({ side, lineIndex, weekCount, weekColumnWidth });
          const style = getExternalDependencyStyle(dependency.status);
          return {
            id: dependency.id,
            key: dependency.id,
            side,
            width,
            stack: Math.floor(index / 2),
            text: dependency.notes || dependency.name,
            className: style.boxClass,
          };
        }),
      };
    })
    .filter(Boolean);
}

function chooseBoxSide({ index, lineIndex, weekCount, weekColumnWidth }) {
  const weeksNeeded = Math.ceil(NOTE_BOX_WIDTH / weekColumnWidth);
  const hasRoomOnLeft = lineIndex >= weeksNeeded;
  const hasRoomOnRight = weekCount - lineIndex >= weeksNeeded;

  if (!hasRoomOnLeft && hasRoomOnRight) {
    return 'right';
  }

  if (hasRoomOnLeft && !hasRoomOnRight) {
    return 'left';
  }

  if (!hasRoomOnLeft && !hasRoomOnRight) {
    return lineIndex >= weekCount - lineIndex ? 'left' : 'right';
  }

  return index % 2 === 0 ? 'left' : 'right';
}

function getBoxWidth({ side, lineIndex, weekCount, weekColumnWidth }) {
  const availableWidth =
    side === 'left'
      ? lineIndex * weekColumnWidth - 16
      : (weekCount - lineIndex) * weekColumnWidth - 16;

  return Math.max(32, Math.min(NOTE_BOX_WIDTH, availableWidth));
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
