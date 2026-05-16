import {
  DEFAULT_CATEGORY_COLORS,
  DEFAULT_PLAN_NAME,
  DEFAULT_RESOURCE_COUNT,
  DEFAULT_ROW_HEIGHT,
  DEFAULT_START_WEEK,
  DEFAULT_START_YEAR,
  DEFAULT_WEEK_COLUMN_WIDTH,
  MIN_VISIBLE_WEEKS,
} from '../constants/defaults.js';
import { SCHEMA_VERSION } from '../constants/schemaVersion.js';
import { buildCalculatedWeeks, buildFixedSprints } from '../engine/timeline.js';

export const SHARE_URL_MAX_PAYLOAD_LENGTH = 100_000;

const DEFAULT_FREE_DAY_REASON = 'Week capacity adjustment';
const COLOR_PALETTE = DEFAULT_CATEGORY_COLORS;
const STATUS_TO_CODE = { partial: 1, yes: 2 };
const CODE_TO_STATUS = ['no', 'partial', 'yes'];
// Keep `%` out of the alphabet so browser percent-escaping in URL hashes can be safely decoded.
const BASE91_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$-&()*+,./:;<=>?@[]^_`{|}~"';
const BASE91_LOOKUP = new Map([...BASE91_ALPHABET].map((character, index) => [character, index]));

export async function encodePlanToHashPayload(planDocument, options = {}) {
  const maxPayloadLength = options.maxPayloadLength ?? SHARE_URL_MAX_PAYLOAD_LENGTH;
  const compactDocument = compactPlanDocument(planDocument);
  const json = JSON.stringify(compactDocument);
  const jsonPayload = `j.${encodeURIComponent(json)}`;
  const base91Payload = `b.${encodeURIComponent(encodeBase91(new TextEncoder().encode(json)))}`;
  const compressedPayload = `d.${encodeURIComponent(encodeBase91(await compressBytes(new TextEncoder().encode(json))))}`;
  const payload = [jsonPayload, base91Payload, compressedPayload].sort((a, b) => a.length - b.length)[0];

  if (payload.length > maxPayloadLength) {
    throw new Error(
      `URL state is too large (${payload.length.toLocaleString()} characters). Reduce plan size before sharing.`,
    );
  }

  return payload;
}

export function encodePlanToJsonHashPayload(planDocument, options = {}) {
  const maxPayloadLength = options.maxPayloadLength ?? SHARE_URL_MAX_PAYLOAD_LENGTH;
  const payload = `j.${encodeURIComponent(JSON.stringify(compactPlanDocument(planDocument)))}`;

  if (payload.length > maxPayloadLength) {
    throw new Error(
      `URL state is too large (${payload.length.toLocaleString()} characters). Reduce plan size before sharing.`,
    );
  }

  return payload;
}

export async function decodePlanFromHashPayload(payload) {
  return expandCompactPlanDocument(await decodeCompactPayload(payload));
}

// [plan, categories, tasks, dependencies, externalDeps, teams, workingDayAdjustments, weekResources, manual]
export function compactPlanDocument(document) {
  const firstWeekIndex = document.plan?.startWeek ?? document.weeks?.[0]?.weekIndex ?? DEFAULT_START_WEEK;
  const startYear = document.plan?.startYear ?? document.weeks?.[0]?.weekYear ?? DEFAULT_START_YEAR;
  const sprintStartNumber = document.plan?.sprintStartNumber ?? document.sprints?.[0]?.number ?? 1;
  const sprintStartOrder = document.plan?.sprintStartOrder ?? 1;
  const categoryIndex = new Map((document.categories ?? []).map((category, index) => [category.id, index]));
  const taskIndex = new Map((document.tasks ?? []).map((task, index) => [task.id, index]));
  const teamIndex = new Map((document.teams ?? []).map((team, index) => [team.id, index]));
  const firstResourceByTeam = new Map(
    (document.weekResources ?? [])
      .filter((resource) => resource.weekIndex === firstWeekIndex)
      .map((resource) => [resource.teamId, resource.resourceCount]),
  );

  return trimArray([
    compactPlan(document.plan, {
      firstWeekIndex,
      sprintStartNumber,
      sprintStartOrder,
      startYear,
    }),
    compactRows(document.categories, (category, index) =>
      trimArray([
        category.name !== `Category ${index + 1}` ? category.name : null,
        category.order !== index + 1 ? category.order : null,
        encodeColor(category.color),
        category.collapsed ? 1 : null,
        compactRows(category.vacations, (vacation) => [vacation.weekIndex, vacation.dayCount]),
      ]),
    ),
    compactRows(document.tasks, (task, index) =>
      trimArray([
        task.categoryId ? categoryIndex.get(task.categoryId) : null,
        task.name !== `Task ${index + 1}` ? task.name : null,
        task.priority !== index + 1 ? task.priority : null,
        task.estimateWeeks !== 1 ? task.estimateWeeks : null,
        encodeColor(task.highlightColor),
        task.notes || null,
        task.earliestStartWeek ?? null,
        task.maxResources ?? null,
        compactRows(task.resourceOverrides, (override) => [override.weekIndex, override.allocatedUnits]),
      ]),
    ),
    compactRows(document.dependencies, (dependency) =>
      trimArray([
        taskIndex.get(dependency.predecessorId),
        taskIndex.get(dependency.successorId),
        dependency.lagWeeks || null,
      ]),
    ),
    compactRows(document.externalDependencies, (dependency, index) =>
      trimArray([
        dependency.name !== `External dependency ${index + 1}` ? dependency.name : null,
        dependency.dueWeek ?? dependency.endWeek ?? dependency.startWeek,
        STATUS_TO_CODE[dependency.status] ?? null,
        dependency.notes || null,
      ]),
    ),
    compactTeams(document.teams, firstResourceByTeam),
    compactRows(document.freedays, (freeday) =>
      trimArray([
        teamIndex.get(freeday.teamId),
        freeday.weekIndex ?? null,
        freeday.date || null,
        freeday.reason && freeday.reason !== DEFAULT_FREE_DAY_REASON ? freeday.reason : null,
      ]),
    ),
    compactRows(
      (document.weekResources ?? []).filter((resource) => resource.weekIndex !== firstWeekIndex),
      (resource) => [teamIndex.get(resource.teamId), resource.weekIndex, resource.resourceCount],
    ),
    compactRows(
      document.schedule?.filter((entry) => entry.isManual),
      (entry) => [taskIndex.get(entry.taskId), entry.weekIndex, entry.allocatedUnits],
    ),
  ]);
}

export function expandCompactPlanDocument(compactDocument) {
  if (!Array.isArray(compactDocument)) {
    throw new Error('Shared link payload uses an unsupported URL state format.');
  }

  const now = new Date().toISOString();
  const planRow = compactDocument[0] ?? [];
  const startYear = planRow[2] ?? DEFAULT_START_YEAR;
  const startWeek = planRow[3] ?? DEFAULT_START_WEEK;
  const sprintStartNumber = planRow[4] ?? 1;
  const sprintStartOrder = planRow[5] ?? 1;
  const teams = expandTeams(compactDocument[5]);
  const weeks = buildCalculatedWeeks(startWeek, MIN_VISIBLE_WEEKS, startYear);
  const firstWeekIndex = weeks[0]?.weekIndex ?? startWeek;
  const categories = (compactDocument[1] ?? []).map((category = [], index) => ({
    id: `c${index + 1}`,
    name: category[0] ?? `Category ${index + 1}`,
    order: category[1] ?? index + 1,
    color: decodeColor(category[2]),
    collapsed: Boolean(category[3]),
    vacations: expandWeekValuePairs(category[4]).map(({ weekIndex, value }) => ({ weekIndex, dayCount: value })),
  }));
  const tasks = (compactDocument[2] ?? []).map((task = [], index) => ({
    id: `t${index + 1}`,
    categoryId: task[0] === null || task[0] === undefined ? null : `c${task[0] + 1}`,
    name: task[1] ?? `Task ${index + 1}`,
    priority: task[2] ?? index + 1,
    estimateWeeks: task[3] ?? 1,
    calcWeeks: 0,
    highlightColor: decodeColor(task[4]),
    notes: task[5] ?? '',
    earliestStartWeek: task[6] ?? null,
    maxResources: task[7] ?? null,
    resourceOverrides: expandWeekValuePairs(task[8]).map(({ weekIndex, value }) => ({
      weekIndex,
      allocatedUnits: value,
    })),
  }));
  const dependencies = (compactDocument[3] ?? []).map((dependency = [], index) => ({
    id: `d${index + 1}`,
    predecessorId: `t${dependency[0] + 1}`,
    successorId: `t${dependency[1] + 1}`,
    lagWeeks: dependency[2] ?? 0,
  }));
  const externalDependencies = (compactDocument[4] ?? []).map((dependency = [], index) => ({
    id: `x${index + 1}`,
    name: dependency[0] ?? `External dependency ${index + 1}`,
    dueWeek: dependency[1] ?? startWeek,
    status: CODE_TO_STATUS[dependency[2] ?? 0] ?? 'no',
    notes: dependency[3] ?? '',
  }));
  const freedays = (compactDocument[6] ?? []).map((freeday = [], index) => ({
    id: `f${index + 1}`,
    teamId: `team${(freeday[0] ?? 0) + 1}`,
    weekIndex: freeday[1] ?? null,
    date: freeday[2] ?? null,
    reason: freeday[3] ?? DEFAULT_FREE_DAY_REASON,
  }));
  const firstTeamResourceEntries = teams.map((team) => ({
    id: `wr-${team.id}-${firstWeekIndex}`,
    teamId: team.id,
    weekIndex: firstWeekIndex,
    resourceCount: team.resourceCount ?? planRow[6] ?? DEFAULT_RESOURCE_COUNT,
  }));
  const weekResources = [
    ...firstTeamResourceEntries,
    ...(compactDocument[7] ?? []).map((resource = []) => ({
      id: `wr-team${(resource[0] ?? 0) + 1}-${resource[1]}`,
      teamId: `team${(resource[0] ?? 0) + 1}`,
      weekIndex: resource[1],
      resourceCount: resource[2] ?? DEFAULT_RESOURCE_COUNT,
    })),
  ];

  return {
    version: SCHEMA_VERSION,
    plan: {
      id: 'p1',
      name: planRow[0] ?? DEFAULT_PLAN_NAME,
      description: planRow[1] ?? '',
      startYear,
      startWeek,
      sprintStartNumber,
      sprintStartOrder,
      startingResourceCount: planRow[6] ?? teams[0]?.resourceCount ?? DEFAULT_RESOURCE_COUNT,
      rowHeight: planRow[7] ?? DEFAULT_ROW_HEIGHT,
      vacations: expandWeekValuePairs(planRow[8]).map(({ weekIndex, value }) => ({ weekIndex, dayCount: value })),
      weekColumnWidth: planRow[9] ?? DEFAULT_WEEK_COLUMN_WIDTH,
      createdAt: now,
      updatedAt: now,
    },
    categories,
    tasks,
    dependencies,
    externalDependencies,
    sprints: buildFixedSprints(weeks, sprintStartNumber, sprintStartOrder),
    weeks,
    teams: teams.map(({ resourceCount, ...team }) => team),
    freedays,
    weekResources,
    schedule: (compactDocument[8] ?? []).map((entry = []) => ({
      taskId: `t${entry[0] + 1}`,
      weekIndex: entry[1],
      allocatedUnits: entry[2],
      isManual: true,
    })),
  };
}

export async function decodeCompactPayload(payload) {
  if (!payload) {
    throw new Error('Shared link payload is empty.');
  }

  if (payload.startsWith('j.')) {
    try {
      return JSON.parse(decodeURIComponent(payload.slice(2)));
    } catch (error) {
      throw new Error(`URL state is not valid JSON. ${error.message}`);
    }
  }

  if (payload.startsWith('d.')) {
    return decodeCompressedPayload(decodeHashEscapes(payload.slice(2)));
  }

  if (payload.startsWith('b.')) {
    try {
      return JSON.parse(new TextDecoder().decode(decodeBase91(decodeHashEscapes(payload.slice(2)))));
    } catch (error) {
      throw new Error(`URL state is not valid JSON. ${error.message}`);
    }
  }

  throw new Error('Shared link payload uses an unsupported URL state format.');
}

export function encodeBase91(bytes) {
  let accumulator = 0;
  let bitCount = 0;
  let output = '';

  for (const byte of bytes) {
    accumulator |= byte << bitCount;
    bitCount += 8;

    if (bitCount > 13) {
      let value = accumulator & 8191;

      if (value > 88) {
        accumulator >>= 13;
        bitCount -= 13;
      } else {
        value = accumulator & 16383;
        accumulator >>= 14;
        bitCount -= 14;
      }

      output += BASE91_ALPHABET[value % 91] + BASE91_ALPHABET[Math.floor(value / 91)];
    }
  }

  if (bitCount > 0) {
    output += BASE91_ALPHABET[accumulator % 91];

    if (bitCount > 7 || accumulator > 90) {
      output += BASE91_ALPHABET[Math.floor(accumulator / 91)];
    }
  }

  return output;
}

export function decodeBase91(payload) {
  let pendingValue = -1;
  let accumulator = 0;
  let bitCount = 0;
  const output = [];

  for (const character of payload) {
    const value = BASE91_LOOKUP.get(character);

    if (value === undefined) {
      throw new Error(`Unexpected character "${character}".`);
    }

    if (pendingValue < 0) {
      pendingValue = value;
      continue;
    }

    pendingValue += value * 91;
    accumulator |= pendingValue << bitCount;
    bitCount += (pendingValue & 8191) > 88 ? 13 : 14;

    do {
      output.push(accumulator & 255);
      accumulator >>= 8;
      bitCount -= 8;
    } while (bitCount > 7);

    pendingValue = -1;
  }

  if (pendingValue >= 0) {
    output.push((accumulator | (pendingValue << bitCount)) & 255);
  }

  return new Uint8Array(output);
}

function compactPlan(plan, { firstWeekIndex, sprintStartNumber, sprintStartOrder, startYear }) {
  return trimArray([
    plan?.name && plan.name !== DEFAULT_PLAN_NAME ? plan.name : null,
    plan?.description || null,
    startYear !== DEFAULT_START_YEAR ? startYear : null,
    firstWeekIndex !== DEFAULT_START_WEEK ? firstWeekIndex : null,
    sprintStartNumber !== 1 ? sprintStartNumber : null,
    sprintStartOrder !== 1 ? sprintStartOrder : null,
    plan?.startingResourceCount !== DEFAULT_RESOURCE_COUNT ? plan?.startingResourceCount : null,
    plan?.rowHeight && plan.rowHeight !== DEFAULT_ROW_HEIGHT ? plan.rowHeight : null,
    compactRows(plan?.vacations, (vacation) => [vacation.weekIndex, vacation.dayCount]),
    plan?.weekColumnWidth && plan.weekColumnWidth !== DEFAULT_WEEK_COLUMN_WIDTH ? plan.weekColumnWidth : null,
  ]);
}

function compactTeams(teams = [], firstResourceByTeam) {
  const rows = compactRows(teams, (team, index) =>
    trimArray([
      team.name !== `Team ${index + 1}` ? team.name : null,
      firstResourceByTeam.get(team.id) !== DEFAULT_RESOURCE_COUNT ? firstResourceByTeam.get(team.id) : null,
    ]),
  );

  return rows?.some((row) => row.length > 0) ? rows : undefined;
}

function expandTeams(rows = []) {
  if (rows.length === 0) {
    return [{ id: 'team1', name: 'Team 1', resourceCount: DEFAULT_RESOURCE_COUNT }];
  }

  return rows.map((team = [], index) => ({
    id: `team${index + 1}`,
    name: team[0] ?? `Team ${index + 1}`,
    resourceCount: team[1],
  }));
}

function encodeColor(color) {
  if (!color) {
    return null;
  }

  const index = COLOR_PALETTE.indexOf(color);
  return index === -1 ? color : index;
}

function decodeColor(value) {
  if (typeof value === 'number') {
    return COLOR_PALETTE[value] ?? null;
  }

  return value ?? null;
}

function expandWeekValuePairs(rows = []) {
  return rows.map((row = []) => ({
    weekIndex: row[0],
    value: row[1] ?? 0,
  }));
}

function compactRows(items = [], mapper) {
  const rows = items.map(mapper).filter(Boolean);
  return rows.length > 0 ? rows : undefined;
}

function trimArray(values) {
  const result = [...values];
  while (result.length > 0 && (result[result.length - 1] === null || result[result.length - 1] === undefined)) {
    result.pop();
  }
  return result;
}

async function decodeCompressedPayload(payload) {
  let compressed;

  try {
    compressed = decodeBase91(payload);
  } catch (error) {
    throw new Error(`URL state contains invalid Base91 data. ${error.message}`);
  }

  let bytes;

  try {
    bytes = await decompressBytes(compressed);
  } catch {
    throw new Error('URL state could not be decompressed.');
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    throw new Error(`URL state is not valid JSON. ${error.message}`);
  }
}

function decodeHashEscapes(payload) {
  try {
    return decodeURIComponent(payload);
  } catch {
    return payload;
  }
}

async function compressBytes(bytes) {
  if (typeof CompressionStream !== 'function') {
    throw new Error('URL state compression is not supported in your current browser.');
  }

  const stream = bytesToStream(bytes).pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function decompressBytes(bytes) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('URL state compression is not supported in your current browser.');
  }

  const stream = bytesToStream(bytes).pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function bytesToStream(bytes) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}
