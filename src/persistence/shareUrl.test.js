import { describe, expect, it } from 'vitest';
import { recalculateSchedule } from '../engine/scheduler.js';
import { createPlanFixture } from '../test/fixtures/planDocument.js';
import { validatePlanDocument } from '../utils/validators.js';
import {
  compactPlanDocument,
  decodeBase91,
  decodePlanFromHashPayload,
  encodeBase91,
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
    expect(compact[0]).toEqual(['Plan1', null, 2027, null, 10, 2, 1, null, [[4, 10]], 36]);
    expect(compact[1][0]).toEqual(['OBI', null, 0, null, [[3, 5]]]);
    expect(compact[2][0]).toEqual([0, null, null, 45, null, null, null, null, [[3, 2]]]);
    expect(compact[4][0]).toEqual(['Client input', 7, 1, 'Client input\nTest env']);
    expect(JSON.stringify(document).length).toBeGreaterThan(7000);
    expect(encoded.length).toBeLessThan(700);
  });

  it('expands compact state into a valid runtime document and regenerates derived schedule data', () => {
    const compact = [
      ['URL plan', null, 2027, null, 10, 2, 1, null, [[3, 6]], 36],
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
    expect(document.plan).toMatchObject({ startYear: 2027, sprintStartNumber: 10, sprintStartOrder: 2, weekColumnWidth: 36 });
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

  it('chooses the shortest available URL-safe encoding', async () => {
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
    expect(smallPayload.length).toBeLessThan(30);
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

  it('rejects invalid Base91 data', async () => {
    await expect(decodePlanFromHashPayload('d. ')).rejects.toThrow('invalid Base91 data');
  });

  it('rejects invalid compressed bytes', async () => {
    const payload = `d.${encodeBase91(new Uint8Array([1, 2, 3, 4]))}`;

    await expect(decodePlanFromHashPayload(payload)).rejects.toThrow('could not be decompressed');
  });

  it('rejects decompressed payloads that are not JSON', async () => {
    const payload = `d.${encodeBase91(await compressText('not json'))}`;

    await expect(decodePlanFromHashPayload(payload)).rejects.toThrow('not valid JSON');
  });
});

describe('Base91 byte encoding', () => {
  it('round trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 13, 90, 127, 128, 200, 255]);

    expect(decodeBase91(encodeBase91(bytes))).toEqual(bytes);
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
