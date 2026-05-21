import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';
import { resolveWeekResourceCount } from './engine/resourceResolver.js';
import { getCurrentIsoWeekInfo } from './engine/timeline.js';
import { useTimelineStore } from './store/index.js';
import { createPlanFixture } from './test/fixtures/planDocument.js';
import { decodePlanFromHashPayload, encodePlanToHashPayload } from './persistence/shareUrl.js';

describe('URL-owned app state', () => {
  beforeEach(() => {
    resetStore();
    window.localStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState(null, '', '/');
    window.localStorage.clear();
  });

  it('loads a plan directly from the hash without an import prompt', async () => {
    const payload = await encodePlanToHashPayload(
      createPlanFixture({
        plan: { name: 'Hash plan' },
        tasks: [{ id: 'task-1', name: 'Loaded from URL', priority: 1, estimateWeeks: 1 }],
      }),
    );
    window.history.replaceState(null, '', `/#${payload}`);

    render(<App />);

    expect(await screen.findByText('Loaded from URL')).toBeInTheDocument();
    expect(screen.queryByText('Import shared plan')).not.toBeInTheDocument();
    expect(useTimelineStore.getState().getActiveDocument().tasks[0].name).toBe('Loaded from URL');
  });

  it('updates the hash after plan edits without writing localStorage', async () => {
    render(<App />);
    await screen.findByText('Nothing is sent to a server, all data stays in this computer');

    act(() => {
      const store = useTimelineStore.getState();
      store.addTask({ name: 'URL task' });
    });

    await waitFor(
      async () => {
        expect(window.location.hash).toMatch(/^#d\./);
        expect(window.localStorage.length).toBe(0);
        const decoded = await decodePlanFromHashPayload(window.location.hash.slice(1));
        expect(decoded.tasks.some((task) => task.name === 'URL task')).toBe(true);
      },
      { timeout: 3000 },
    );
  });

  it('keeps the root URL clean until the first meaningful edit and reloads from its own hash', async () => {
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText('Nothing is sent to a server, all data stays in this computer');

    expect(window.location.hash).toBe('');

    await user.click(screen.getByRole('button', { name: 'New category' }));

    await waitFor(() => expect(window.location.hash).toMatch(/^#d\./));
    const writtenHash = window.location.hash;

    cleanup();
    resetStore();
    render(<App />);

    await waitFor(() => {
      expect(useTimelineStore.getState().getActiveDocument().categories).toEqual([
        expect.objectContaining({ name: 'New category' }),
      ]);
    });
    expect(window.location.hash).toBe(writtenHash);
  });

  it('adds fast tooltip labels to visible buttons', async () => {
    render(<App />);
    await screen.findByText('Nothing is sent to a server, all data stays in this computer');

    for (const button of screen.getAllByRole('button')) {
      expect(button, button.outerHTML).toHaveAttribute('data-tooltip');
    }
  });

  it('shows the original repository note in the toolbar', async () => {
    render(<App />);
    await screen.findByText('Nothing is sent to a server, all data stays in this computer');

    const link = screen.getByRole('link', { name: 'georgeasiminei/local-sprint-plan' });
    expect(link).toHaveAttribute('href', 'https://github.com/georgeasiminei/local-sprint-plan');
  });

  it('undoes and redoes changes through session-only toolbar history', async () => {
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText('Nothing is sent to a server, all data stays in this computer');

    const undoButton = screen.getByRole('button', { name: 'Undo' });
    const redoButton = screen.getByRole('button', { name: 'Redo' });
    expect(undoButton).toBeDisabled();
    expect(redoButton).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'New task' }));
    expect(await screen.findByText('Task 1')).toBeInTheDocument();
    expect(undoButton).toBeEnabled();

    await user.click(undoButton);
    expect(screen.queryByText('Task 1')).not.toBeInTheDocument();
    expect(redoButton).toBeEnabled();

    await user.click(redoButton);
    expect(await screen.findByText('Task 1')).toBeInTheDocument();

    await waitFor(async () => {
      const decoded = await decodePlanFromHashPayload(window.location.hash.slice(1));
      expect(decoded.tasks).toHaveLength(1);
      expect(decoded).not.toHaveProperty('undoStack');
      expect(decoded).not.toHaveProperty('redoStack');
    });
  });

  it('uses clicked task selection for shift without row checkboxes', async () => {
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText('Nothing is sent to a server, all data stays in this computer');

    const shiftButton = screen.getByRole('button', { name: 'Shift selected task by weeks' });
    expect(shiftButton).toBeDisabled();

    act(() => {
      useTimelineStore.getState().addTask({ name: 'Shift me' });
    });

    expect(screen.queryByRole('checkbox', { name: 'Select Shift me' })).not.toBeInTheDocument();
    await user.click(await screen.findByText('Shift me'));
    expect(shiftButton).toBeEnabled();

    await user.click(shiftButton);
    expect(await screen.findByText('Shift task')).toBeInTheDocument();
    expect(screen.getAllByText('Shift me')).toHaveLength(2);
    expect(screen.queryByText(/Select a task in the timeline first\./i)).not.toBeInTheDocument();
  });

  it('lets settings dimensions be cleared and typed before committing', async () => {
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText('Nothing is sent to a server, all data stays in this computer');

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const rowHeightInput = await screen.findByLabelText('Timeline row height in pixels');
    const weekWidthInput = screen.getByLabelText('Timeline week column width in pixels');

    await user.clear(rowHeightInput);
    expect(rowHeightInput).toHaveValue('');
    await user.type(rowHeightInput, '24');
    expect(rowHeightInput).toHaveValue('24');
    await user.tab();

    await user.clear(weekWidthInput);
    expect(weekWidthInput).toHaveValue('');
    await user.type(weekWidthInput, '72');
    expect(weekWidthInput).toHaveValue('72');
    await user.tab();

    const document = useTimelineStore.getState().getActiveDocument();
    expect(document.plan.rowHeight).toBe(24);
    expect(document.plan.weekColumnWidth).toBe(72);
  });

  it('shows concise internal dependency labels and lets settings hide them', async () => {
    const user = userEvent.setup();
    const { weekYear, weekNumber } = getCurrentIsoWeekInfo(new Date());
    const payload = await encodePlanToHashPayload(
      createPlanFixture({
        plan: { startYear: weekYear, startWeek: weekNumber, startingResourceCount: 1 },
        tasks: [
          { id: 'task-1', name: 'API', priority: 1, estimateWeeks: 1 },
          { id: 'task-2', name: 'UI', priority: 2, estimateWeeks: 1 },
        ],
        dependencies: [
          {
            id: 'dep-1',
            predecessorType: 'task',
            predecessorId: 'task-1',
            successorType: 'task',
            successorId: 'task-2',
            lagWeeks: 0,
          },
        ],
      }),
    );
    window.history.replaceState(null, '', `/#${payload}`);

    render(<App />);

    expect(await screen.findByText('API → UI')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const toggle = await screen.findByLabelText('Show internal dependency lines');
    expect(toggle).toBeChecked();
    await user.click(toggle);

    expect(screen.queryByText('API → UI')).not.toBeInTheDocument();
    expect(useTimelineStore.getState().getActiveDocument().plan.showInternalDependencyLines).toBe(false);
  });

  it('opens an item panel from the grid and closes it with the panel x', async () => {
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText('Nothing is sent to a server, all data stays in this computer');

    act(() => {
      useTimelineStore.getState().addTask({ name: 'Panel task' });
    });

    expect(await screen.findByText('Panel task')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close panel' }));

    expect(screen.queryByText('Name')).not.toBeInTheDocument();
  });

  it('renders external dependency weeks and persists them in the URL', async () => {
    render(<App />);
    await screen.findByText('Nothing is sent to a server, all data stays in this computer');

    act(() => {
      useTimelineStore.getState().addExternalDependency({
        name: 'Client environment',
        dueWeek: 8,
        status: 'no',
      });
    });

    expect(await screen.findByText(/\d{2}\.08/)).toBeInTheDocument();
    expect(screen.getAllByText(/Client environment/).length).toBeGreaterThan(0);

    await waitFor(
      async () => {
        const decoded = await decodePlanFromHashPayload(window.location.hash.slice(1));
        expect(decoded.externalDependencies).toEqual([
          expect.objectContaining({
            name: 'Client environment',
            dueWeek: 8,
            status: 'no',
          }),
        ]);
      },
      { timeout: 3000 },
    );
  });

  it('opens dependency panel with external and internal choices', async () => {
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText('Nothing is sent to a server, all data stays in this computer');

    await user.click(screen.getByRole('button', { name: 'New dependency' }));

    expect(await screen.findByText('Add dependency')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'External' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Internal' })).toBeInTheDocument();
    expect(useTimelineStore.getState().getActiveDocument().externalDependencies).toHaveLength(0);
  });

  it('opens the task panel when a task cell is clicked', async () => {
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText('Nothing is sent to a server, all data stays in this computer');

    act(() => {
      useTimelineStore.getState().addTask({ name: 'Cell task' });
    });

    const document = useTimelineStore.getState().getActiveDocument();
    const weekLabel = document.weeks[0]?.label;

    await user.click(screen.getByRole('button', { name: `Set Cell task resources in ${weekLabel}` }));

    expect(await screen.findByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Cell task')).toBeInTheDocument();
  });

  it('defaults external dependency due week to the selected week', async () => {
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText('Nothing is sent to a server, all data stays in this computer');

    const document = useTimelineStore.getState().getActiveDocument();
    const selectedWeekIndex = document.weeks[2]?.weekIndex ?? document.plan.startWeek;
    const selectedWeekLabel = document.weeks.find((week) => week.weekIndex === selectedWeekIndex)?.label;

    act(() => {
      useTimelineStore.getState().selectWeek(selectedWeekIndex);
    });

    await user.click(screen.getByRole('button', { name: 'New dependency' }));

    expect(await screen.findByText('Add dependency')).toBeInTheDocument();
    expect(screen.getByLabelText('Due week')).toHaveValue(selectedWeekLabel);
  });

  it('creates and reopens internal dependencies for tasks and categories', async () => {
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText('Nothing is sent to a server, all data stays in this computer');

    act(() => {
      const store = useTimelineStore.getState();
      store.addCategory('Foundation');
      store.addCategory('Delivery');
      store.addTask({ name: 'Implementation' });
    });

    await user.click(screen.getByRole('button', { name: 'New dependency' }));
    await user.click(await screen.findByRole('button', { name: 'Internal' }));
    await user.click(screen.getAllByRole('button', { name: 'Category' })[0]);
    await user.selectOptions(screen.getAllByRole('combobox')[0], 'Foundation');
    await user.click(screen.getAllByRole('button', { name: 'Category' })[1]);
    await user.selectOptions(screen.getAllByRole('combobox')[1], 'Delivery');
    await user.click(screen.getByRole('button', { name: 'Add internal dependency' }));

    expect((await screen.findAllByText('Delivery')).length).toBeGreaterThan(0);
    expect(screen.getByText(/depends on Foundation/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close panel' }));
    await user.click(screen.getByRole('button', { name: 'Show internal dependencies for Delivery' }));

    expect(await screen.findByText('Internal dependencies')).toBeInTheDocument();
    expect(screen.getByText('Depends on')).toBeInTheDocument();
    expect(screen.getAllByText('Foundation').length).toBeGreaterThan(0);
  });

  it('lets a task in its last execution week be marked completed and freezes intervals', async () => {
    const user = userEvent.setup();
    const { weekYear, weekNumber } = getCurrentIsoWeekInfo(new Date());
    const payload = await encodePlanToHashPayload(
      createPlanFixture({
        plan: { startYear: weekYear, startWeek: weekNumber, startingResourceCount: 1 },
        tasks: [{ id: 'task-1', name: 'Finishing task', priority: 1, estimateWeeks: 1 }],
      }),
    );
    window.history.replaceState(null, '', `/#${payload}`);

    render(<App />);
    await user.click(await screen.findByText('Finishing task'));
    const checkbox = await screen.findByRole('checkbox', { name: /Completed/i });
    await user.click(checkbox);

    await waitFor(() => {
      const task = useTimelineStore.getState().getActiveDocument().tasks[0];
      expect(task.completed).toBe(true);
      expect(task.completedIntervals).toEqual([
        expect.objectContaining({ startWeek: weekNumber, endWeek: weekNumber, allocatedUnits: 1 }),
      ]);
    });
  });

  it('marks completed tasks visibly in the timeline', async () => {
    const { weekYear, weekNumber } = getCurrentIsoWeekInfo(new Date());
    const payload = await encodePlanToHashPayload(
      createPlanFixture({
        plan: { startYear: weekYear, startWeek: weekNumber, startingResourceCount: 1 },
        tasks: [
          {
            id: 'task-1',
            name: 'Frozen task',
            priority: 1,
            estimateWeeks: 1,
            completed: true,
            completedIntervals: [{ startWeek: weekNumber, endWeek: weekNumber, allocatedUnits: 1 }],
          },
        ],
      }),
    );
    window.history.replaceState(null, '', `/#${payload}`);

    render(<App />);

    const taskLabel = await screen.findByText('Frozen task');
    expect(taskLabel).toHaveClass('italic');
    expect(screen.getByRole('img', { name: 'Frozen task completed' })).toBeInTheDocument();
  });

  it('auto-completes tasks older than three weeks on load', async () => {
    const payload = await encodePlanToHashPayload(
      createPlanFixture({
        plan: { startYear: 2020, startWeek: 1, startingResourceCount: 1 },
        tasks: [{ id: 'task-1', name: 'Old task', priority: 1, estimateWeeks: 1 }],
      }),
    );
    window.history.replaceState(null, '', `/#${payload}`);

    render(<App />);

    await waitFor(() => {
      const task = useTimelineStore.getState().getActiveDocument().tasks[0];
      expect(task.completed).toBe(true);
      expect(task.completedIntervals).toEqual([
        expect.objectContaining({ startWeek: 1, endWeek: 1, allocatedUnits: 1 }),
      ]);
    });
  });

  it('removes frozen completion data if a timeframe change makes the task future work', async () => {
    const payload = await encodePlanToHashPayload(
      createPlanFixture({
        plan: { startYear: 2020, startWeek: 1, startingResourceCount: 1 },
        tasks: [
          {
            id: 'task-1',
            name: 'Formerly historical task',
            priority: 1,
            estimateWeeks: 1,
            completed: true,
            completedIntervals: [{ startWeek: 1, endWeek: 1, allocatedUnits: 1 }],
          },
        ],
      }),
    );
    window.history.replaceState(null, '', `/#${payload}`);

    render(<App />);
    await screen.findByText('Formerly historical task');

    act(() => {
      useTimelineStore.getState().updatePlanSettings({ startYear: 2030 });
    });

    await waitFor(() => {
      const task = useTimelineStore.getState().getActiveDocument().tasks[0];
      expect(task.completed).toBeUndefined();
      expect(task.completedIntervals).toBeUndefined();
    });
  });

  it('prevents circular dependencies even for empty categories', async () => {
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText('Nothing is sent to a server, all data stays in this computer');

    act(() => {
      const store = useTimelineStore.getState();
      store.addCategory('Foundation');
      store.addCategory('Delivery');
      const document = store.getActiveDocument();
      store.addDependency(document.categories[0].id, document.categories[1].id, 0, 'category', 'category');
    });

    const store = useTimelineStore.getState();
    const document = store.getActiveDocument();
    const blockedId = store.addDependency(
      document.categories[1].id,
      document.categories[0].id,
      0,
      'category',
      'category',
    );
    expect(blockedId).toBeNull();
    expect(useTimelineStore.getState().getActiveDocument().dependencies).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'New dependency' }));
    await user.click(await screen.findByRole('button', { name: 'Internal' }));
    await user.click(screen.getAllByRole('button', { name: 'Category' })[0]);
    await user.selectOptions(screen.getAllByRole('combobox')[0], 'Delivery');
    await user.click(screen.getAllByRole('button', { name: 'Category' })[1]);

    const waitingOptions = [...screen.getAllByRole('combobox')[1].options];
    expect(waitingOptions.find((option) => option.text === 'Foundation')).toBeDisabled();
    expect(screen.getByText(/circular dependency are disabled/i)).toBeInTheDocument();
  });

  it('reschedules category tasks when vacation days change', async () => {
    render(<App />);
    await screen.findByText('Nothing is sent to a server, all data stays in this computer');

    act(() => {
      const store = useTimelineStore.getState();
      store.updatePlanSettings({ startingResourceCount: 4 });
      store.addCategory('Delivery');
      const document = store.getActiveDocument();
      store.addTask({
        name: 'Vacation sensitive task',
        categoryId: document.categories[0].id,
        estimateWeeks: 4,
      });
    });

    await waitFor(() => {
      const document = useTimelineStore.getState().getActiveDocument();
      const taskId = document.tasks[0].id;
      expect(document.schedule).toEqual([
        expect.objectContaining({ taskId, weekIndex: 1, allocatedUnits: 4 }),
      ]);
    });

    act(() => {
      const store = useTimelineStore.getState();
      const document = store.getActiveDocument();
      store.updateCategory(document.categories[0].id, {
        vacations: [{ weekIndex: 1, dayCount: 5 }],
      });
    });

    await waitFor(() => {
      const document = useTimelineStore.getState().getActiveDocument();
      const taskId = document.tasks[0].id;
      expect(document.schedule).toEqual([
        expect.objectContaining({ taskId, weekIndex: 1, allocatedUnits: 3 }),
        expect.objectContaining({ taskId, weekIndex: 2, allocatedUnits: 1 }),
      ]);
    });
  });

  it('cascades total effort capacity edits to following weeks', async () => {
    render(<App />);
    await screen.findByText('Nothing is sent to a server, all data stays in this computer');

    act(() => {
      const store = useTimelineStore.getState();
      const document = store.getActiveDocument();
      const teamId = document.teams[0].id;

      store.setWeekResource({ teamId, weekIndex: 3, resourceCount: 9 });
      store.setWeekResource({ teamId, weekIndex: 2, resourceCount: 4 });
    });

    await waitFor(() => {
      const document = useTimelineStore.getState().getActiveDocument();
      const teamId = document.teams[0].id;

      expect(resolveWeekResourceCount(2, teamId, document.weekResources, 5)).toBe(4);
      expect(resolveWeekResourceCount(3, teamId, document.weekResources, 5)).toBe(4);
      expect(document.weekResources.some((resource) => resource.teamId === teamId && resource.weekIndex === 3)).toBe(false);
    });
  });

  it('edits week resources from the week panel and can limit the change to one week', async () => {
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText('Nothing is sent to a server, all data stays in this computer');

    act(() => {
      const { weekYear, weekNumber } = getCurrentIsoWeekInfo(new Date());
      useTimelineStore.getState().updatePlanSettings({ startYear: weekYear, startWeek: weekNumber });
    });

    const document = useTimelineStore.getState().getActiveDocument();
    const firstWeek = document.weeks[0];
    const teamId = document.teams[0].id;

    await user.click(screen.getByRole('button', { name: firstWeek.label }));

    const resourceInput = await screen.findByLabelText(`Resources for ${firstWeek.label}`);
    fireEvent.change(resourceInput, { target: { value: '7' } });
    fireEvent.blur(resourceInput);

    await waitFor(() => {
      const nextDocument = useTimelineStore.getState().getActiveDocument();
      expect(resolveWeekResourceCount(firstWeek.weekIndex, teamId, nextDocument.weekResources, 5)).toBe(7);
      expect(resolveWeekResourceCount(firstWeek.weekIndex + 1, teamId, nextDocument.weekResources, 5)).toBe(7);
    });

    await user.click(screen.getByLabelText('Apply only to this week'));
    fireEvent.change(resourceInput, { target: { value: '3' } });
    fireEvent.blur(resourceInput);

    await waitFor(() => {
      const nextDocument = useTimelineStore.getState().getActiveDocument();
      expect(resolveWeekResourceCount(firstWeek.weekIndex, teamId, nextDocument.weekResources, 5)).toBe(3);
      expect(resolveWeekResourceCount(firstWeek.weekIndex + 1, teamId, nextDocument.weekResources, 5)).toBe(7);
    });
  });

  it('edits category vacation days from the week panel', async () => {
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText('Nothing is sent to a server, all data stays in this computer');

    act(() => {
      const store = useTimelineStore.getState();
      const { weekYear, weekNumber } = getCurrentIsoWeekInfo(new Date());
      store.updatePlanSettings({ startYear: weekYear, startWeek: weekNumber, startingResourceCount: 4 });
      store.addCategory('Delivery');
      const document = store.getActiveDocument();
      store.addTask({
        name: 'Week panel vacation task',
        categoryId: document.categories[0].id,
        estimateWeeks: 4,
      });
    });

    await waitFor(() => {
      const document = useTimelineStore.getState().getActiveDocument();
      const firstWeek = document.weeks[0];
      expect(document.schedule).toEqual([
        expect.objectContaining({ taskId: document.tasks[0].id, weekIndex: firstWeek.weekIndex, allocatedUnits: 4 }),
      ]);
    });

    const document = useTimelineStore.getState().getActiveDocument();
    const firstWeek = document.weeks[0];
    const category = document.categories[0];

    await user.click(screen.getByRole('button', { name: firstWeek.label }));
    await user.selectOptions(await screen.findByLabelText(`Vacation scope for ${firstWeek.label}`), `category:${category.id}`);
    const vacationInput = screen.getByLabelText(`Vacation days for ${firstWeek.label}`);
    fireEvent.change(vacationInput, { target: { value: '5' } });
    fireEvent.blur(vacationInput);

    await waitFor(() => {
      const nextDocument = useTimelineStore.getState().getActiveDocument();
      const taskId = nextDocument.tasks[0].id;
      const weekIndex = nextDocument.weeks[0].weekIndex;
      expect(nextDocument.schedule).toEqual([
        expect.objectContaining({ taskId, weekIndex, allocatedUnits: 3 }),
        expect.objectContaining({ taskId, weekIndex: weekIndex + 1, allocatedUnits: 1 }),
      ]);
    });
  });

  it('edits task-specific vacation days from the week panel', async () => {
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText('Nothing is sent to a server, all data stays in this computer');

    act(() => {
      const store = useTimelineStore.getState();
      const { weekYear, weekNumber } = getCurrentIsoWeekInfo(new Date());
      store.updatePlanSettings({ startYear: weekYear, startWeek: weekNumber, startingResourceCount: 5 });
      store.addTask({
        name: 'Vacation-scoped task',
        estimateWeeks: 10,
        maxResources: 2,
      });
      store.addTask({
        name: 'Unaffected task',
        estimateWeeks: 10,
        maxResources: 3,
      });
    });

    const document = useTimelineStore.getState().getActiveDocument();
    const firstWeek = document.weeks[0];
    const task = document.tasks[0];

    await user.click(screen.getByRole('button', { name: firstWeek.label }));
    await user.selectOptions(await screen.findByLabelText(`Vacation scope for ${firstWeek.label}`), `task:${task.id}`);
    const vacationInput = screen.getByLabelText(`Vacation days for ${firstWeek.label}`);
    fireEvent.change(vacationInput, { target: { value: '5' } });
    fireEvent.blur(vacationInput);

    await waitFor(() => {
      const nextDocument = useTimelineStore.getState().getActiveDocument();
      expect(nextDocument.tasks[0].vacations).toEqual([{ weekIndex: firstWeek.weekIndex, dayCount: 5 }]);
      expect(nextDocument.schedule.filter((entry) => entry.weekIndex === firstWeek.weekIndex)).toEqual([
        expect.objectContaining({ taskId: nextDocument.tasks[0].id, allocatedUnits: 1.6 }),
        expect.objectContaining({ taskId: nextDocument.tasks[1].id, allocatedUnits: 3 }),
      ]);
    });
  });

  it('edits working days and plan vacation person-days from the week panel', async () => {
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText('Nothing is sent to a server, all data stays in this computer');

    act(() => {
      const store = useTimelineStore.getState();
      const { weekYear, weekNumber } = getCurrentIsoWeekInfo(new Date());
      store.updatePlanSettings({ startYear: weekYear, startWeek: weekNumber, startingResourceCount: 4 });
      store.addTask({
        name: 'Plan availability task',
        estimateWeeks: 4,
      });
    });

    const document = useTimelineStore.getState().getActiveDocument();
    const firstWeek = document.weeks[0];

    await user.click(screen.getByRole('button', { name: firstWeek.label }));
    const workingDaysInput = await screen.findByLabelText(`Working days for ${firstWeek.label}`);
    fireEvent.change(workingDaysInput, { target: { value: '4' } });
    fireEvent.blur(workingDaysInput);

    await waitFor(() => {
      const nextDocument = useTimelineStore.getState().getActiveDocument();
      const taskId = nextDocument.tasks[0].id;
      expect(nextDocument.freedays.filter((day) => day.weekIndex === firstWeek.weekIndex)).toHaveLength(1);
      expect(nextDocument.schedule).toEqual([
        expect.objectContaining({ taskId, weekIndex: firstWeek.weekIndex, allocatedUnits: 3.2 }),
        expect.objectContaining({ taskId, weekIndex: firstWeek.weekIndex + 1, allocatedUnits: 0.8 }),
      ]);
    });

    const planVacationInput = screen.getByLabelText(`Vacation days for ${firstWeek.label}`);
    fireEvent.change(planVacationInput, { target: { value: '10' } });
    fireEvent.blur(planVacationInput);

    await waitFor(() => {
      const nextDocument = useTimelineStore.getState().getActiveDocument();
      expect(nextDocument.plan.vacations).toEqual([{ weekIndex: firstWeek.weekIndex, dayCount: 10 }]);
      expect(nextDocument.schedule[0]).toEqual(
        expect.objectContaining({ weekIndex: firstWeek.weekIndex, allocatedUnits: 1.2 }),
      );
    });
  });

  it('creates tasks with the selected category and category color', async () => {
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText('Nothing is sent to a server, all data stays in this computer');

    act(() => {
      const store = useTimelineStore.getState();
      store.addCategory('Delivery');
      const document = store.getActiveDocument();
      store.selectCategory(document.categories[0].id);
    });

    await user.click(screen.getByRole('button', { name: 'New task' }));

    const document = useTimelineStore.getState().getActiveDocument();
    expect(document.tasks[0]).toMatchObject({
      categoryId: document.categories[0].id,
      highlightColor: document.categories[0].color,
    });
  });

  it('saves named local snapshots and loads them back into the active URL-owned plan', async () => {
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText('Nothing is sent to a server, all data stays in this computer');
    expect(screen.getByText('New project plan')).toBeInTheDocument();

    act(() => {
      useTimelineStore.getState().addTask({ name: 'Locally saved task' });
    });

    await user.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.change(await screen.findByLabelText('Saved plan name'), { target: { value: 'Milestone A' } });
    const saveButtons = screen.getAllByRole('button', { name: 'Save' });
    await user.click(saveButtons[saveButtons.length - 1]);

    expect(useTimelineStore.getState().getActiveDocument().plan.name).toBe('Milestone A');

    act(() => {
      useTimelineStore.getState().createPlan('Blank replacement');
    });

    expect(screen.queryByText('Locally saved task')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load' }));
    await user.click(await screen.findByText('Milestone A'));

    expect(await screen.findByText('Locally saved task')).toBeInTheDocument();
  });

  it('deletes named local snapshots from the load dialog', async () => {
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText('Nothing is sent to a server, all data stays in this computer');

    act(() => {
      useTimelineStore.getState().addTask({ name: 'Disposable save' });
    });

    await user.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.change(await screen.findByLabelText('Saved plan name'), { target: { value: 'Disposable' } });
    const saveButtons = screen.getAllByRole('button', { name: 'Save' });
    await user.click(saveButtons[saveButtons.length - 1]);

    await user.click(screen.getByRole('button', { name: 'Load' }));
    expect(await screen.findByRole('button', { name: 'Delete Disposable' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete Disposable' }));

    expect(screen.queryByRole('button', { name: 'Delete Disposable' })).not.toBeInTheDocument();
  });

  it('restores all saved plans from a backup so they appear under load', async () => {
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText('Nothing is sent to a server, all data stays in this computer');

    await user.click(screen.getByRole('button', { name: 'Backup/restore' }));
    expect(await screen.findByText('Backup all saved plans')).toBeInTheDocument();
    expect(screen.getByText(/overwrites every locally saved plan/i)).toBeInTheDocument();

    const backupFile = new File(
      [
        JSON.stringify({
          version: 1,
          exportedAt: '2026-05-16T00:00:00.000Z',
          savedPlans: [
            {
              id: 'sp1',
              name: 'Recovered A',
              savedAt: '2026-05-16T00:00:00.000Z',
              document: [[], [], [[null, 'Recovered task']]],
            },
            {
              id: 'sp2',
              name: 'Recovered B',
              savedAt: '2026-05-16T01:00:00.000Z',
              document: [[], [], [[null, 'Another recovered task']]],
            },
          ],
        }),
      ],
      'backup.json',
      { type: 'application/json' },
    );

    const input = document.querySelector('input[type="file"]');
    await user.upload(input, backupFile);
    await user.click(screen.getByRole('button', { name: 'Restore backup and overwrite all plans' }));

    await user.click(screen.getByRole('button', { name: 'Load' }));
    expect(await screen.findByText('Recovered A')).toBeInTheDocument();
    expect(screen.getByText('Recovered B')).toBeInTheDocument();
  });

  it('loads compact JSON files from the load dialog', async () => {
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText('Nothing is sent to a server, all data stays in this computer');

    await user.click(screen.getByRole('button', { name: 'Load' }));
    const file = new File(['[[],[],[[null,\"Imported JSON\"]]]'], 'plan.json', { type: 'application/json' });
    const input = document.querySelector('input[type="file"]');
    await user.upload(input, file);

    expect(await screen.findByText('Imported JSON')).toBeInTheDocument();
  });

  it('selects starter names when creating tasks and categories', async () => {
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText('Nothing is sent to a server, all data stays in this computer');

    await user.click(screen.getByRole('button', { name: 'New category' }));
    const categoryName = await screen.findByDisplayValue('New category');
    expect(categoryName).toHaveFocus();
    expect(categoryName.selectionStart).toBe(0);
    expect(categoryName.selectionEnd).toBe('New category'.length);

    await user.click(screen.getByRole('button', { name: 'New task' }));
    const taskName = await screen.findByDisplayValue('Task 1');
    expect(taskName).toHaveFocus();
    expect(taskName.selectionStart).toBe(0);
    expect(taskName.selectionEnd).toBe('Task 1'.length);
  });

  it('confirms before applying a past-week edit', async () => {
    const user = userEvent.setup();
    const payload = await encodePlanToHashPayload(
      createPlanFixture({
        plan: { name: 'Past plan', startYear: 2020, startWeek: 1 },
      }),
    );
    window.history.replaceState(null, '', `/#${payload}`);

    render(<App />);
    await screen.findByText('Nothing is sent to a server, all data stays in this computer');

    act(() => {
      const store = useTimelineStore.getState();
      const week = store.getActiveDocument().weeks[0];
      store.requestWeekEdit(week, () => store.addTask({ name: 'Past edit applied' }));
    });

    expect(await screen.findByText('Edit past week?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(useTimelineStore.getState().getActiveDocument().tasks).toHaveLength(0);

    act(() => {
      const store = useTimelineStore.getState();
      const week = store.getActiveDocument().weeks[0];
      store.requestWeekEdit(week, () => store.addTask({ name: 'Past edit applied' }));
    });
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(useTimelineStore.getState().getActiveDocument().tasks[0].name).toBe('Past edit applied');
  });

  it('prompts before deleting a selected task with past schedule data', async () => {
    const user = userEvent.setup();
    const payload = await encodePlanToHashPayload(
      createPlanFixture({
        plan: { name: 'Past delete plan', startYear: 2020, startWeek: 1 },
        tasks: [{ id: 'task-1', name: 'Historical task', priority: 1, estimateWeeks: 1 }],
      }),
    );
    window.history.replaceState(null, '', `/#${payload}`);

    render(<App />);

    await user.click(await screen.findByText('Historical task'));
    await user.keyboard('{Delete}');

    expect(await screen.findByText('Edit past week?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(useTimelineStore.getState().getActiveDocument().tasks).toHaveLength(1);
  });

  it('deletes a task without a past warning when it has no past allocation', async () => {
    const user = userEvent.setup();
    const payload = await encodePlanToHashPayload(
      createPlanFixture({
        plan: { name: 'No past impact plan', startYear: 2020, startWeek: 1 },
        tasks: [{ id: 'task-1', name: 'Future-only task', priority: 1, estimateWeeks: 0 }],
      }),
    );
    window.history.replaceState(null, '', `/#${payload}`);

    render(<App />);

    await user.click(await screen.findByText('Future-only task'));
    await user.keyboard('{Delete}');

    expect(screen.queryByText('Edit past week?')).not.toBeInTheDocument();
    expect(useTimelineStore.getState().getActiveDocument().tasks).toHaveLength(0);
  });

  it('shows the today marker for the current ISO week', async () => {
    const { weekYear, weekNumber } = getCurrentIsoWeekInfo(new Date());
    const payload = await encodePlanToHashPayload(
      createPlanFixture({
        plan: { name: 'Today plan', startYear: weekYear, startWeek: weekNumber },
      }),
    );
    window.history.replaceState(null, '', `/#${payload}`);

    render(<App />);

    expect(await screen.findByText('Today')).toBeInTheDocument();
  });
});

function resetStore() {
  useTimelineStore.setState({
    activePlanId: null,
    plans: [],
    saveStatus: 'saved',
    importError: null,
    hasHydrated: false,
    savedPlanId: null,
    savedPlanName: null,
    scheduleWarnings: [],
    hasAppliedAutoCompletion: false,
    selectedTaskId: null,
    selectedCategoryId: null,
    selectedDependencyId: null,
    isShiftTaskOpen: false,
    isSidebarOpen: false,
    activePanel: 'task',
    selectedExternalDependencyId: null,
    selectedWeekIndex: null,
    pendingPastWeekEdit: null,
    undoStack: [],
    redoStack: [],
  });
}
