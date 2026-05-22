import { describe, expect, it } from 'vitest';
import { recalculateSchedule } from '../engine/scheduler.js';
import { createPlanFixture } from '../test/fixtures/planDocument.js';
import { validatePlanDocument } from '../utils/validators.js';
import {
  compactPlanDocument,
  decodeBase64Url,
  decodePlanFromHashPayload,
  encodeBase64Url,
  encodePlanToHashPayload,
  expandCompactPlanDocument,
} from './shareUrl.js';

describe('URL plan payloads', () => {
  it('stores only source data needed to reconstruct the runtime document', async () => {
    const document = createPlanFixture({
      plan: {
        id: '48bf67a1-41fe-4f83-9be9-6e531d940cd8',
        name: 'Plan1',
        startYear: 2027,
        startWeek: 1,
        sprintStartNumber: 10,
        sprintStartOrder: 2,
        startingResourceCount: 1,
        weekColumnWidth: 36,
        showInternalDependencyLines: false,
        vacations: [{ weekIndex: 4, dayCount: 10 }],
      },
      categories: [
        {
          id: 'c8c604f0-63cf-480e-8553-a38b502c3438',
          name: 'OBI',
          order: 1,
          color: '#e0f2fe',
          vacations: [{ weekIndex: 3, dayCount: 5 }],
        },
      ],
      tasks: [
        {
          id: 'e7873598-6837-4093-aca3-c66a27799f85',
          categoryId: 'c8c604f0-63cf-480e-8553-a38b502c3438',
          name: 'Task 1',
          priority: 1,
          estimateWeeks: 45,
          calcWeeks: 43,
          resourceOverrides: [{ weekIndex: 3, allocatedUnits: 2 }],
        },
      ],
      externalDependencies: [{ id: 'external-guid-value', name: 'Client input', dueWeek: 7, status: 'partial', notes: 'Client input\nTest env' }],
      weeks: Array.from({ length: 43 }, (_, index) => ({ id: `week-${index + 1}`, weekIndex: index + 1, label: `W${index + 1}` })),
      sprints: Array.from({ length: 22 }, (_, index) => ({
        id: `sprint-${index + 1}`,
        name: `Sprint ${index + 1}`,
        startWeek: index * 2 + 1,
        endWeek: index * 2 + 2,
      })),
      teams: [{ id: '654e30de-5e14-4d9d-8bfe-c513ad88ca72', name: 'Team 1' }],
      weekResources: [
        {
          id: '96c2a177-6782-4130-9725-45831228827f',
          teamId: '654e30de-5e14-4d9d-8bfe-c513ad88ca72',
          weekIndex: 1,
          resourceCount: 1,
        },
      ],
      schedule: Array.from({ length: 43 }, (_, index) => ({
        taskId: 'e7873598-6837-4093-aca3-c66a27799f85',
        weekIndex: index + 1,
        allocatedUnits: 1,
      })),
    });

    const compact = compactPlanDocument(document);
    const encoded = await encodePlanToHashPayload(document);
    const compactJson = JSON.stringify(compact);

    expect(compactJson).not.toContain('weeks');
    expect(compactJson).not.toContain('sprints');
    expect(compactJson).not.toContain('schedule');
    expect(compactJson).not.toContain('48bf67a1');
    expect(compact[0]).toEqual(['Plan1', null, 2027, null, 10, 2, 1, null, [[4, 10]], 36, 0]);
    expect(compact[1][0]).toEqual(['OBI', null, 0, null, [[3, 5]]]);
    expect(compact[2][0]).toEqual([0, null, null, 45, null, null, null, null, [[3, 2]]]);
    expect(compact[4][0]).toEqual(['Client input', 7, 1, 'Client input\nTest env']);
    expect(JSON.stringify(document).length).toBeGreaterThan(7000);
    expect(encoded.length).toBeLessThan(700);
  });

  it('expands compact state into a valid runtime document and regenerates derived schedule data', () => {
    const compact = [
      ['URL plan', null, 2027, null, 10, 2, 1, null, [[3, 6]], 36, 0],
      [['Delivery', null, null, null, [[2, 4]]]],
      [[0, 'Implementation', null, 3, null, null, null, null, [[2, 1]]]],
      undefined,
      [['Client signoff', 8, 2, 'Client signoff\nReady']],
      [[null, 1]],
    ];

    const document = expandCompactPlanDocument(compact);
    const validation = validatePlanDocument(document);
    const scheduled = recalculateSchedule(document);

    expect(validation.valid).toBe(true);
    expect(document.weeks).toHaveLength(4);
    expect(document.sprints).toHaveLength(2);
    expect(document.weeks[0].label).toBe('27.01');
    expect(document.plan).toMatchObject({
      startYear: 2027,
      sprintStartNumber: 10,
      sprintStartOrder: 2,
      weekColumnWidth: 36,
      showInternalDependencyLines: false,
    });
    expect(document.plan.vacations).toEqual([{ weekIndex: 3, dayCount: 6 }]);
    expect(document.categories[0].vacations).toEqual([{ weekIndex: 2, dayCount: 4 }]);
    expect(document.sprints.map((sprint) => sprint.name)).toEqual(['Sprint 1', 'Sprint 10']);
    expect(scheduled.schedule.length).toBeGreaterThan(0);
    expect(scheduled.schedule[0].taskId).toBe('t1');
    expect(document.tasks[0].resourceOverrides).toEqual([{ weekIndex: 2, allocatedUnits: 1 }]);
    expect(document.externalDependencies[0]).toMatchObject({
      id: 'x1',
      name: 'Client signoff',
      dueWeek: 8,
      status: 'yes',
      notes: 'Client signoff\nReady',
    });
  });

  it('always emits compressed URL-safe payloads', async () => {
    const smallDocument = createPlanFixture({
      plan: { name: 'Tiny' },
      teams: [{ id: 'team1', name: 'Team 1' }],
      weekResources: [{ id: 'wr-team1-1', teamId: 'team1', weekIndex: 1, resourceCount: 5 }],
    });
    const largeDocument = createPlanFixture({
      tasks: Array.from({ length: 50 }, (_, index) => ({
        id: `task-${index + 1}`,
        name: `Task ${index + 1} with repeated planning text`,
        priority: index + 1,
        estimateWeeks: 2,
        notes: 'Repeated notes make compression worthwhile. '.repeat(4),
      })),
    });

    const smallPayload = await encodePlanToHashPayload(smallDocument);
    await expect(encodePlanToHashPayload(largeDocument)).resolves.toMatch(/^d\./);
    expect(smallPayload).toMatch(/^d\./);
    expect(smallPayload.length).toBeLessThan(30);
  });

  it('uses a browser-clean compressed payload for larger plans', async () => {
    const document = createPlanFixture({
      tasks: Array.from({ length: 60 }, (_, index) => ({
        id: `task-${index + 1}`,
        name: `Task ${index + 1} with repeated planning text`,
        priority: index + 1,
        estimateWeeks: 2,
        notes: 'Repeated notes make compression worthwhile. '.repeat(4),
      })),
    });

    const payload = await encodePlanToHashPayload(document);

    expect(payload).toMatch(/^d\.[A-Za-z0-9_-]+$/);
    await expect(decodePlanFromHashPayload(payload)).resolves.toMatchObject({
      tasks: expect.arrayContaining([expect.objectContaining({ name: 'Task 1 with repeated planning text' })]),
    });
  });

  it('decodes a payload back into a runtime plan', async () => {
    const document = createPlanFixture({
      categories: [{ id: 'cat-1', name: 'Delivery', order: 1 }],
      tasks: [{ id: 'task-1', categoryId: 'cat-1', name: 'Implementation', priority: 1, estimateWeeks: 3 }],
    });

    const decoded = await decodePlanFromHashPayload(await encodePlanToHashPayload(document));

    expect(decoded.categories[0].id).toBe('c1');
    expect(decoded.tasks[0].id).toBe('t1');
    expect(decoded.tasks[0].categoryId).toBe('c1');
    expect(validatePlanDocument(decoded).valid).toBe(true);
  });

  it('round trips category dependency endpoints in the compact URL format', async () => {
    const document = createPlanFixture({
      categories: [
        { id: 'cat-1', name: 'Foundation', order: 1 },
        { id: 'cat-2', name: 'Delivery', order: 2 },
      ],
      tasks: [{ id: 'task-1', categoryId: 'cat-1', name: 'Implementation', priority: 1, estimateWeeks: 3 }],
      dependencies: [
        {
          id: 'dep-1',
          predecessorType: 'category',
          predecessorId: 'cat-1',
          successorType: 'task',
          successorId: 'task-1',
          lagWeeks: 2,
        },
      ],
    });

    const compact = compactPlanDocument(document);
    const decoded = await decodePlanFromHashPayload(await encodePlanToHashPayload(document));

    expect(compact[3][0]).toEqual([-1, 0, 2]);
    expect(decoded.dependencies[0]).toMatchObject({
      predecessorType: 'category',
      predecessorId: 'c1',
      successorType: 'task',
      successorId: 't1',
      lagWeeks: 2,
    });
  });

  it('stores completed task history as compact resource intervals', async () => {
    const document = createPlanFixture({
      tasks: [
        {
          id: 'task-1',
          name: 'Historical',
          priority: 1,
          estimateWeeks: 4,
          completed: true,
          completedIntervals: [
            { startWeek: 3, endWeek: 5, allocatedUnits: 2 },
            { startWeek: 6, endWeek: 6, allocatedUnits: 1 },
          ],
        },
      ],
    });

    const compact = compactPlanDocument(document);
    const decoded = await decodePlanFromHashPayload(await encodePlanToHashPayload(document));

    expect(compact[2][0][9]).toEqual([
      [3, 5, 2],
      [6, 1],
    ]);
    expect(decoded.tasks[0]).toMatchObject({
      completed: true,
      completedIntervals: [
        { startWeek: 3, endWeek: 5, allocatedUnits: 2 },
        { startWeek: 6, endWeek: 6, allocatedUnits: 1 },
      ],
    });
  });

  it('round trips task vacation days in compact URL state', async () => {
    const document = createPlanFixture({
      tasks: [
        {
          id: 'task-1',
          name: 'Task with vacation',
          priority: 1,
          estimateWeeks: 4,
          vacations: [{ weekIndex: 3, dayCount: 2 }],
        },
      ],
    });

    const compact = compactPlanDocument(document);
    const decoded = await decodePlanFromHashPayload(await encodePlanToHashPayload(document));

    expect(compact[2][0][10]).toEqual([[3, 2]]);
    expect(decoded.tasks[0].vacations).toEqual([{ weekIndex: 3, dayCount: 2 }]);
  });

  it('round trips reversible task shift rules in compact URL state', async () => {
    const document = createPlanFixture({
      tasks: [
        {
          id: 'task-1',
          name: 'Shifted task',
          priority: 1,
          estimateWeeks: 20,
          shiftRules: [
            {
              id: 'shift-3',
              anchorWeekIndex: 3,
              weekDelta: 1.5,
              firstShiftedWeek: 4,
              sourceEntries: [
                { weekIndex: 3, allocatedUnits: 5 },
                { weekIndex: 4, allocatedUnits: 5, rawAllocatedUnits: 6 },
              ],
            },
          ],
        },
      ],
    });

    const compact = compactPlanDocument(document);
    const decoded = await decodePlanFromHashPayload(await encodePlanToHashPayload(document));

    expect(compact[2][0][11]).toEqual([
      ['shift-3', 3, 1.5, 4, [[3, 5], [4, 5, 6]]],
    ]);
    expect(decoded.tasks[0].shiftRules).toEqual([
      {
        id: 'shift-3',
        anchorWeekIndex: 3,
        weekDelta: 1.5,
        firstShiftedWeek: 4,
        sourceEntries: [
          { weekIndex: 3, allocatedUnits: 5 },
          { weekIndex: 4, allocatedUnits: 5, rawAllocatedUnits: 6 },
        ],
      },
    ]);
  });

  it('keeps large encoded plans compact relative to runtime JSON', async () => {
    const document = createPlanFixture({
      categories: Array.from({ length: 6 }, (_, index) => ({
        id: `category-${index + 1}`,
        name: `Category ${index + 1}`,
        order: index + 1,
        color: '#e0f2fe',
      })),
      tasks: Array.from({ length: 60 }, (_, index) => ({
        id: `task-${index + 1}`,
        categoryId: `category-${(index % 6) + 1}`,
        name: `Task ${index + 1}`,
        priority: index + 1,
        estimateWeeks: 2,
        notes: index % 2 === 0 ? 'Repeated note' : '',
      })),
    });

    const encoded = await encodePlanToHashPayload(document);

    expect(encoded.length / JSON.stringify(document).length).toBeLessThan(0.08);
  });

  it('rejects oversized payloads', async () => {
    const document = createPlanFixture();

    await expect(encodePlanToHashPayload(document, { maxPayloadLength: 1 })).rejects.toThrow('URL state is too large');
  });

  it('rejects invalid Base64url data', async () => {
    await expect(decodePlanFromHashPayload('d.*')).rejects.toThrow('invalid Base64url data');
  });

  it('rejects invalid compressed bytes', async () => {
    const payload = `d.${encodeBase64Url(new Uint8Array([1, 2, 3, 4]))}`;

    await expect(decodePlanFromHashPayload(payload)).rejects.toThrow('could not be decompressed');
  });

  it('rejects decompressed payloads that are not JSON', async () => {
    const payload = `d.${encodeBase64Url(await compressText('not json'))}`;

    await expect(decodePlanFromHashPayload(payload)).rejects.toThrow('not valid JSON');
  });
});

describe('Base64url byte encoding', () => {
  it('round trips arbitrary bytes without reserved URL characters', () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 13, 90, 127, 128, 200, 255]);
    const payload = encodeBase64Url(bytes);

    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeBase64Url(payload)).toEqual(bytes);
  });
});

async function compressText(text) {
  const bytes = new TextEncoder().encode(text);
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  }).pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
