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
        expect(window.location.hash).toMatch(/^#(j|b|d)\./);
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

    await user.click(screen.getByRole('button', { name: 'Category' }));
    await user.click(screen.getByRole('button', { name: 'Task' }));

    await waitFor(() => expect(window.location.hash).toMatch(/^#(j|b|d)\./));
    const writtenHash = window.location.hash;

    cleanup();
    resetStore();
    render(<App />);

    expect(await screen.findByText('Task 1')).toBeInTheDocument();
    expect(window.location.hash).toBe(writtenHash);
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

    await user.click(screen.getByRole('button', { name: 'Dependency' }));

    expect(await screen.findByText('Add dependency')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'External' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Internal' })).toBeInTheDocument();
    expect(useTimelineStore.getState().getActiveDocument().externalDependencies).toHaveLength(0);
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
    await user.selectOptions(await screen.findByLabelText(`Vacation scope for ${firstWeek.label}`), category.id);
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

    await user.click(screen.getByRole('button', { name: 'Task' }));

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

    act(() => {
      useTimelineStore.getState().addTask({ name: 'Locally saved task' });
    });

    await user.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.change(await screen.findByLabelText('Saved plan name'), { target: { value: 'Milestone A' } });
    const saveButtons = screen.getAllByRole('button', { name: 'Save' });
    await user.click(saveButtons[saveButtons.length - 1]);

    act(() => {
      useTimelineStore.getState().createPlan('Blank replacement');
    });

    expect(screen.queryByText('Locally saved task')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load' }));
    await user.click(await screen.findByText('Milestone A'));

    expect(await screen.findByText('Locally saved task')).toBeInTheDocument();
  });

  it('selects starter names when creating tasks and categories', async () => {
    const user = userEvent.setup();

    render(<App />);
    await screen.findByText('Nothing is sent to a server, all data stays in this computer');

    await user.click(screen.getByRole('button', { name: 'Category' }));
    const categoryName = await screen.findByDisplayValue('New category');
    expect(categoryName).toHaveFocus();
    expect(categoryName.selectionStart).toBe(0);
    expect(categoryName.selectionEnd).toBe('New category'.length);

    await user.click(screen.getByRole('button', { name: 'Task' }));
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
    selectedTaskId: null,
    selectedCategoryId: null,
    selectedDependencyId: null,
    selectedTaskIds: [],
    isBulkShiftOpen: false,
    isSettingsOpen: false,
    isSidebarOpen: false,
    activePanel: 'task',
    selectedExternalDependencyId: null,
    selectedWeekIndex: null,
    pendingPastWeekEdit: null,
    undoStack: [],
    redoStack: [],
  });
}
