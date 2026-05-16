import { LEFT_COLUMN_WIDTH } from './layout.js';
import { getDependencyEndpoint, getDependencyEntityName, getEntityTasks } from '../../utils/dependencies.js';

export default function OverlayLines({ document, weekColumnWidth }) {
  const weeks = document.weeks ?? [];
  if (weeks.length === 0) {
    return null;
  }

  const todayPosition = findTodayPosition(weeks);
  const dependencyMarkers =
    document.plan?.showInternalDependencyLines === false ? [] : createDependencyMarkers(document);
  const externalDependencyMarkers = createExternalDependencyMarkers(document);

  return (
    <div className="pointer-events-none absolute inset-0">
      {todayPosition !== null ? (
        <Marker
          index={todayPosition}
          weekColumnWidth={weekColumnWidth}
          color="bg-blue-500"
          label="Today"
          solid
          widthClass="w-px"
        />
      ) : null}
      {dependencyMarkers.map((marker) => (
        <Marker
          key={marker.key}
          index={marker.index}
          weekColumnWidth={weekColumnWidth}
          color="bg-slate-500"
          label={marker.label}
        />
      ))}
      {externalDependencyMarkers.map((marker) => (
        <Marker
          key={marker.key}
          index={marker.index}
          weekColumnWidth={weekColumnWidth}
          color={marker.lineClass}
          label=""
          solid
          widthClass="w-1"
        />
      ))}
    </div>
  );
}

function Marker({ index, weekColumnWidth, color, label, solid = false, widthClass = 'w-0.5' }) {
  const left = `${LEFT_COLUMN_WIDTH + weekColumnWidth * index}px`;

  return (
    <div className="absolute top-0 h-full" style={{ left }}>
      <div className={`h-full ${widthClass} ${color} ${solid ? '' : 'opacity-70'}`} />
      {label ? (
        <div className="absolute left-1 top-2 whitespace-nowrap rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 shadow-panel">
          {label}
        </div>
      ) : null}
    </div>
  );
}

function findTodayPosition(weeks) {
  const today = new Date();
  const index = weeks.findIndex((week) => {
    if (!week.startDate) {
      return false;
    }

    const start = new Date(week.startDate);
    const end = week.endDate ? new Date(week.endDate) : new Date(start);
    if (!week.endDate) {
      end.setDate(start.getDate() + 6);
    }

    return today >= start && today <= end;
  });

  if (index === -1) {
    return null;
  }

  const week = weeks[index];
  const start = new Date(`${week.startDate}T00:00:00`);
  const end = week.endDate ? new Date(`${week.endDate}T23:59:59`) : new Date(start);
  if (!week.endDate) {
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  }
  const duration = Math.max(1, end.getTime() - start.getTime());
  const fraction = Math.min(1, Math.max(0, (today.getTime() - start.getTime()) / duration));

  return index + fraction;
}

function createDependencyMarkers(document) {
  const firstScheduleWeekByTask = new Map();

  for (const entry of document.schedule ?? []) {
    const current = firstScheduleWeekByTask.get(entry.taskId);
    if (current === undefined || entry.weekIndex < current) {
      firstScheduleWeekByTask.set(entry.taskId, entry.weekIndex);
    }
  }

  return (document.dependencies ?? [])
    .map((dependency) => {
      const successor = getDependencyEndpoint(document, dependency, 'successor');
      const successorTasks = getEntityTasks(document.tasks ?? [], document.categories ?? [], successor.type, successor.id);
      const handoffWeek = successorTasks
        .map((task) => firstScheduleWeekByTask.get(task.id))
        .filter((weekIndex) => weekIndex !== undefined)
        .sort((a, b) => a - b)[0];
      const index = document.weeks.findIndex((week) => week.weekIndex === handoffWeek);
      if (index === -1) {
        return null;
      }

      const predecessor = getDependencyEndpoint(document, dependency, 'predecessor');

      return {
        key: dependency.id,
        index,
        label: `${formatEndpointLabel(document, predecessor)} → ${formatEndpointLabel(document, successor)}${
          dependency.lagWeeks ? ` +${dependency.lagWeeks}` : ''
        }`,
      };
    })
    .filter(Boolean);
}

function formatEndpointLabel(document, endpoint) {
  return getDependencyEntityName(document, endpoint.type, endpoint.id);
}

function createExternalDependencyMarkers(document) {
  const groups = new Map();

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

      const mostUrgentStatus = getMostUrgentStatus(dependencies.map((dependency) => dependency.status));
      return {
        key: `external-${dueWeek}`,
        index: weekIndex + 1,
        lineClass: getExternalDependencyStyle(mostUrgentStatus).lineClass,
      };
    })
    .filter(Boolean);
}

function getMostUrgentStatus(statuses) {
  if (statuses.some((status) => status === 'no' || !status)) {
    return 'no';
  }

  if (statuses.some((status) => status === 'partial')) {
    return 'partial';
  }

  return 'yes';
}

function getExternalDependencyStyle(status) {
  if (status === 'yes') {
    return {
      lineClass: 'bg-emerald-500',
      boxClass: 'border-emerald-300 bg-emerald-50 text-emerald-950',
    };
  }

  if (status === 'partial') {
    return {
      lineClass: 'bg-slate-300',
      boxClass: 'border-slate-300 bg-white text-slate-700',
    };
  }

  return {
    lineClass: 'bg-red-600',
    boxClass: 'border-red-300 bg-red-100 text-red-950',
  };
}
