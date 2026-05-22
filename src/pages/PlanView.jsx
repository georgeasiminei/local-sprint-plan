import {
  Braces,
  DatabaseBackup,
  FileSpreadsheet,
  FolderOpen,
  FolderPlus,
  GitBranchPlus,
  MoveHorizontal,
  Plus,
  Redo2,
  Save,
  Scissors,
  Settings,
  Undo2,
} from 'lucide-react';
import { useState } from 'react';
import { useSchedule } from '../hooks/useSchedule.js';
import { useUndoRedo } from '../hooks/useUndoRedo.js';
import { useTimelineStore } from '../store/index.js';
import { downloadCsv, downloadJson, exportScheduleCsv } from '../persistence/exportPlan.js';
import { compactPlanDocument, expandCompactPlanDocument } from '../persistence/shareUrl.js';
import Button from '../components/ui/Button.jsx';
import TimelineGrid from '../components/timeline/TimelineGrid.jsx';
import ShiftTaskModal from '../components/panels/ShiftTaskModal.jsx';
import CategoryDetailPanel from '../components/panels/CategoryDetailPanel.jsx';
import DependencyDetailPanel from '../components/panels/DependencyDetailPanel.jsx';
import TaskDetailPanel from '../components/panels/TaskDetailPanel.jsx';
import PlanSettingsPanel from '../components/panels/PlanSettingsPanel.jsx';
import WeekDetailPanel from '../components/panels/WeekDetailPanel.jsx';
import PastWeekEditModal from '../components/panels/PastWeekEditModal.jsx';
import SavePlanModal from '../components/panels/SavePlanModal.jsx';
import LoadPlanModal from '../components/panels/LoadPlanModal.jsx';
import BackupRestoreModal from '../components/panels/BackupRestoreModal.jsx';
import {
  createSavedPlansBackup,
  deleteSavedPlan,
  getSavedPlan,
  listSavedPlans,
  loadSavedPlan,
  restoreSavedPlansBackup,
  savePlanSnapshot,
} from '../persistence/savedPlans.js';

export default function PlanView() {
  useSchedule();
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [isBackupRestoreModalOpen, setIsBackupRestoreModalOpen] = useState(false);
  const [savedPlans, setSavedPlans] = useState(() => listSavedPlans());
  const document = useTimelineStore((state) => state.getActiveDocument());
  const addCategory = useTimelineStore((state) => state.addCategory);
  const addTask = useTimelineStore((state) => state.addTask);
  const activePanel = useTimelineStore((state) => state.activePanel);
  const closeShiftTask = useTimelineStore((state) => state.closeShiftTask);
  const importError = useTimelineStore((state) => state.importError);
  const isShiftTaskOpen = useTimelineStore((state) => state.isShiftTaskOpen);
  const isSidebarOpen = useTimelineStore((state) => state.isSidebarOpen);
  const openShiftTask = useTimelineStore((state) => state.openShiftTask);
  const saveStatus = useTimelineStore((state) => state.saveStatus);
  const savedPlanId = useTimelineStore((state) => state.savedPlanId);
  const savedPlanName = useTimelineStore((state) => state.savedPlanName);
  const selectedCategoryId = useTimelineStore((state) => state.selectedCategoryId);
  const selectedTaskId = useTimelineStore((state) => state.selectedTaskId);
  const selectedTaskWeekIndex = useTimelineStore((state) => state.selectedTaskWeekIndex);
  const showDependencyPanel = useTimelineStore((state) => state.showDependencyPanel);
  const showSettingsPanel = useTimelineStore((state) => state.showSettingsPanel);
  const hydratePlan = useTimelineStore((state) => state.hydratePlan);
  const requestWeekEdit = useTimelineStore((state) => state.requestWeekEdit);
  const setImportError = useTimelineStore((state) => state.setImportError);
  const setSavedPlan = useTimelineStore((state) => state.setSavedPlan);
  const splitTaskAtWeek = useTimelineStore((state) => state.splitTaskAtWeek);
  const updateActiveDocument = useTimelineStore((state) => state.updateActiveDocument);
  const undo = useTimelineStore((state) => state.undo);
  const redo = useTimelineStore((state) => state.redo);
  const showEffectiveAllocations = useTimelineStore((state) => state.showEffectiveAllocations);
  const setShowEffectiveAllocations = useTimelineStore((state) => state.setShowEffectiveAllocations);
  const { canUndo, canRedo } = useUndoRedo();

  if (!document) {
    return null;
  }

  function addStarterRows() {
    const selectedTask = document.tasks.find((task) => task.id === selectedTaskId);
    const categoryId = selectedTask?.categoryId ?? selectedCategoryId ?? null;
    const category = document.categories.find((item) => item.id === categoryId);

    addTask({
      name: `Task ${document.tasks.length + 1}`,
      categoryId,
      highlightColor: category?.color ?? null,
    });
  }

  function exportActivePlanCsv() {
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `${document.plan.name.replaceAll(' ', '-').toLowerCase()}-schedule-${today}.csv`,
      exportScheduleCsv(document),
    );
  }

  function exportActivePlanJson() {
    const today = new Date().toISOString().slice(0, 10);
    downloadJson(
      `${document.plan.name.replaceAll(' ', '-').toLowerCase()}-${today}.json`,
      JSON.stringify(compactPlanDocument(document)),
    );
  }

  function saveNamedPlan(name) {
    try {
      const normalizedName = name.trim();
      const documentToSave = {
        ...document,
        plan: {
          ...document.plan,
          name: normalizedName,
        },
      };
      const currentSavedPlanName = savedPlanName ?? (savedPlanId ? getSavedPlan(savedPlanId)?.name : null);
      const shouldUpdateCurrentSave =
        savedPlanId && currentSavedPlanName?.trim().toLocaleLowerCase() === normalizedName.toLocaleLowerCase();
      const savedPlan = savePlanSnapshot(normalizedName, documentToSave, shouldUpdateCurrentSave ? savedPlanId : null);
      updateActiveDocument((current) => ({
        ...current,
        plan: {
          ...current.plan,
          name: savedPlan.name,
        },
      }));
      setSavedPlan({ id: savedPlan.id, name: savedPlan.name });
      setSavedPlans(listSavedPlans());
      setIsSaveModalOpen(false);
    } catch (error) {
      setImportError(error.message);
    }
  }

  function saveCurrentPlan() {
    setIsSaveModalOpen(true);
  }

  function splitSelectedTask() {
    if (!selectedTaskId || !selectedTaskWeekIndex) {
      return;
    }

    const week = document.weeks.find((item) => item.weekIndex === selectedTaskWeekIndex);
    requestWeekEdit(week, () => splitTaskAtWeek(selectedTaskId, selectedTaskWeekIndex));
  }

  function openLoadModal() {
    setSavedPlans(listSavedPlans());
    setIsLoadModalOpen(true);
  }

  function loadNamedPlan(savedPlanIdToLoad) {
    try {
      const { document: savedDocument, savedPlan } = loadSavedPlan(savedPlanIdToLoad);
      hydratePlan(
        {
          ...savedDocument,
          plan: {
            ...savedDocument.plan,
            name: savedPlan.name,
          },
        },
        { savedPlanId: savedPlan.id, savedPlanName: savedPlan.name },
      );
      setIsLoadModalOpen(false);
    } catch (error) {
      setImportError(error.message);
    }
  }

  function deleteNamedPlan(savedPlanIdToDelete) {
    try {
      deleteSavedPlan(savedPlanIdToDelete);
      setSavedPlans(listSavedPlans());
      if (savedPlanId === savedPlanIdToDelete) {
        setSavedPlan({ id: null, name: null });
      }
    } catch (error) {
      setImportError(error.message);
    }
  }

  async function loadJsonFile(file) {
    try {
      const compactDocument = JSON.parse(await readFileText(file));
      hydratePlan(expandCompactPlanDocument(compactDocument));
      setIsLoadModalOpen(false);
    } catch (error) {
      setImportError(`Could not load JSON file. ${error.message}`);
    }
  }

  function downloadSavedPlansBackup() {
    const today = new Date().toISOString().slice(0, 10);
    downloadJson(`local-sprint-plan-backup-${today}.json`, JSON.stringify(createSavedPlansBackup()));
  }

  async function restoreSavedPlansFromFile(file) {
    try {
      const backup = JSON.parse(await readFileText(file));
      restoreSavedPlansBackup(backup);
      setSavedPlans(listSavedPlans());
      setSavedPlan({ id: null, name: null });
      setIsBackupRestoreModalOpen(false);
    } catch (error) {
      setImportError(`Could not restore backup. ${error.message}`);
    }
  }

  return (
    <div className={isSidebarOpen ? 'grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]' : 'grid gap-4'}>
      <section className="min-w-0 rounded border border-line bg-white shadow-panel">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-ink">
              {document.plan.name}
              <span className="px-1 text-[11px] font-medium text-slate-500" aria-hidden="true">
                ·
              </span>
              <span className="text-[11px] font-medium text-slate-500">
                Nothing is sent to a server, all data stays in this computer
              </span>
            </div>
            {importError ? <div className="truncate text-[11px] text-red-700">URL state error: {importError}</div> : null}
            <div className="truncate text-[11px] text-slate-500">
              Original code:{' '}
              <a
                className="underline decoration-slate-300 underline-offset-2 hover:text-slate-700"
                href="https://github.com/georgeasiminei/local-sprint-plan"
                target="_blank"
                rel="noreferrer"
              >
                georgeasiminei/local-sprint-plan
              </a>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label
              className="app-tooltip app-tooltip-right flex h-9 items-center gap-2 rounded border border-line bg-white px-2 text-xs font-medium text-slate-700"
              data-tooltip="Show day-off and vacation adjusted resources. Uncheck to edit planned allocation."
            >
              <input
                type="checkbox"
                className="size-3.5 rounded border-line text-focus focus:ring-focus/20"
                checked={showEffectiveAllocations}
                onChange={(event) => setShowEffectiveAllocations(event.target.checked)}
              />
              Effective resources
            </label>
            <Button
              variant="ghost"
              className="size-11 p-0"
              onClick={saveCurrentPlan}
              aria-label="Save"
              tooltip="Save to local storage"
            >
              <Save size={28} />
            </Button>
            <Button
              variant="ghost"
              className="size-11 p-0"
              onClick={openLoadModal}
              aria-label="Load"
              tooltip="Load from local storage or JSON file"
            >
              <FolderOpen size={28} />
            </Button>
            <Button
              variant="ghost"
              className="size-11 p-0"
              onClick={() => setIsBackupRestoreModalOpen(true)}
              aria-label="Backup/restore"
              tooltip="Backup or restore all saved plans"
            >
              <DatabaseBackup size={28} />
            </Button>
            <Button
              variant="ghost"
              className="size-11 p-0"
              onClick={undo}
              disabled={!canUndo}
              aria-label="Undo"
            >
              <Undo2 size={28} />
            </Button>
            <Button
              variant="ghost"
              className="size-11 p-0"
              onClick={redo}
              disabled={!canRedo}
              aria-label="Redo"
            >
              <Redo2 size={28} />
            </Button>
            <Button variant="ghost" className="size-11 p-0" onClick={showSettingsPanel} aria-label="Settings">
              <Settings size={28} />
            </Button>
            <Button variant="ghost" className="size-11 p-0" onClick={exportActivePlanCsv} aria-label="Export CSV">
              <FileSpreadsheet size={28} />
            </Button>
            <Button variant="ghost" className="size-11 p-0" onClick={exportActivePlanJson} aria-label="Export JSON">
              <Braces size={28} />
            </Button>
            <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />
            <Button className="text-xs" onClick={addStarterRows} aria-label="New task" tooltip="New Task">
              <Plus size={20} />
              Task
            </Button>
            <Button
              variant="secondary"
              className="text-xs"
              onClick={showDependencyPanel}
              aria-label="New dependency"
              tooltip="New Dependency"
            >
              <GitBranchPlus size={20} />
              Dependency
            </Button>
            <Button
              variant="secondary"
              className="text-xs"
              onClick={() => addCategory()}
              aria-label="New category"
              tooltip="New Category"
            >
              <FolderPlus size={20} />
              Category
            </Button>
            <Button
              variant="secondary"
              className="text-xs"
              onClick={openShiftTask}
              disabled={!selectedTaskId || !selectedTaskWeekIndex}
              aria-label="Shift selected task by weeks"
              tooltip="Shift remaining work from the selected cell by whole or fractional weeks"
            >
              <MoveHorizontal size={20} />
              Shift
            </Button>
            <Button
              variant="secondary"
              className="text-xs"
              onClick={splitSelectedTask}
              disabled={!selectedTaskId || !selectedTaskWeekIndex}
              aria-label="Split selected task at selected week"
              tooltip="Split the selected task at the selected cell"
            >
              <Scissors size={20} />
              Split
            </Button>
          </div>
        </header>
        <TimelineGrid document={document} allocationView={showEffectiveAllocations ? 'effective' : 'resource'} />
      </section>
      {isSidebarOpen ? (
        <div className="space-y-4">
          {activePanel === 'settings' ? <PlanSettingsPanel document={document} /> : null}
          {activePanel === 'category' ? <CategoryDetailPanel document={document} /> : null}
          {activePanel === 'dependency' ? <DependencyDetailPanel document={document} /> : null}
          {activePanel === 'task' ? <TaskDetailPanel document={document} /> : null}
          {activePanel === 'week' ? <WeekDetailPanel document={document} /> : null}
        </div>
      ) : null}
      <ShiftTaskModal document={document} open={isShiftTaskOpen} onClose={closeShiftTask} />
      <PastWeekEditModal />
      <SavePlanModal
        initialName={document.plan.name}
        open={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={saveNamedPlan}
      />
      <LoadPlanModal
        open={isLoadModalOpen}
        onClose={() => setIsLoadModalOpen(false)}
        onDeleteSavedPlan={deleteNamedPlan}
        onLoad={loadNamedPlan}
        onLoadJsonFile={loadJsonFile}
        savedPlans={savedPlans}
      />
      <BackupRestoreModal
        open={isBackupRestoreModalOpen}
        onClose={() => setIsBackupRestoreModalOpen(false)}
        onDownload={downloadSavedPlansBackup}
        onRestore={restoreSavedPlansFromFile}
        savedPlanCount={savedPlans.length}
      />
    </div>
  );
}

function readFileText(file) {
  if (typeof file.text === 'function') {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('Could not read file.')));
    reader.readAsText(file);
  });
}
