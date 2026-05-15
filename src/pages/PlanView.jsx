import { FileSpreadsheet, FolderOpen, FolderPlus, GitBranchPlus, MoveHorizontal, Plus, Save, Settings } from 'lucide-react';
import { useState } from 'react';
import { useSchedule } from '../hooks/useSchedule.js';
import { useTimelineStore } from '../store/index.js';
import { downloadCsv, exportScheduleCsv } from '../persistence/exportPlan.js';
import Button from '../components/ui/Button.jsx';
import TimelineGrid from '../components/timeline/TimelineGrid.jsx';
import BulkShiftModal from '../components/panels/BulkShiftModal.jsx';
import CategoryDetailPanel from '../components/panels/CategoryDetailPanel.jsx';
import DependencyDetailPanel from '../components/panels/DependencyDetailPanel.jsx';
import TaskDetailPanel from '../components/panels/TaskDetailPanel.jsx';
import PlanSettingsPanel from '../components/panels/PlanSettingsPanel.jsx';
import WeekDetailPanel from '../components/panels/WeekDetailPanel.jsx';
import PastWeekEditModal from '../components/panels/PastWeekEditModal.jsx';
import SavePlanModal from '../components/panels/SavePlanModal.jsx';
import LoadPlanModal from '../components/panels/LoadPlanModal.jsx';
import { listSavedPlans, loadSavedPlan, savePlanSnapshot } from '../persistence/savedPlans.js';

export default function PlanView() {
  useSchedule();
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isSaveAsModalOpen, setIsSaveAsModalOpen] = useState(false);
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [savedPlans, setSavedPlans] = useState(() => listSavedPlans());
  const document = useTimelineStore((state) => state.getActiveDocument());
  const addCategory = useTimelineStore((state) => state.addCategory);
  const addTask = useTimelineStore((state) => state.addTask);
  const activePanel = useTimelineStore((state) => state.activePanel);
  const closeBulkShift = useTimelineStore((state) => state.closeBulkShift);
  const importError = useTimelineStore((state) => state.importError);
  const isBulkShiftOpen = useTimelineStore((state) => state.isBulkShiftOpen);
  const isSidebarOpen = useTimelineStore((state) => state.isSidebarOpen);
  const openBulkShift = useTimelineStore((state) => state.openBulkShift);
  const saveStatus = useTimelineStore((state) => state.saveStatus);
  const savedPlanId = useTimelineStore((state) => state.savedPlanId);
  const savedPlanName = useTimelineStore((state) => state.savedPlanName);
  const selectedCategoryId = useTimelineStore((state) => state.selectedCategoryId);
  const selectedTaskId = useTimelineStore((state) => state.selectedTaskId);
  const selectedTaskIds = useTimelineStore((state) => state.selectedTaskIds);
  const showDependencyPanel = useTimelineStore((state) => state.showDependencyPanel);
  const showSettingsPanel = useTimelineStore((state) => state.showSettingsPanel);
  const hydratePlan = useTimelineStore((state) => state.hydratePlan);
  const setImportError = useTimelineStore((state) => state.setImportError);
  const setSavedPlan = useTimelineStore((state) => state.setSavedPlan);

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

  function saveNamedPlan(name, existingId = null) {
    try {
      const savedPlan = savePlanSnapshot(name, document, existingId);
      setSavedPlan({ id: savedPlan.id, name: savedPlan.name });
      setSavedPlans(listSavedPlans());
      setIsSaveModalOpen(false);
      setIsSaveAsModalOpen(false);
    } catch (error) {
      setImportError(error.message);
    }
  }

  function saveCurrentPlan() {
    if (savedPlanId && savedPlanName) {
      saveNamedPlan(savedPlanName, savedPlanId);
      return;
    }

    setIsSaveModalOpen(true);
  }

  function openLoadModal() {
    setSavedPlans(listSavedPlans());
    setIsLoadModalOpen(true);
  }

  function loadNamedPlan(savedPlanIdToLoad) {
    try {
      const { document: savedDocument, savedPlan } = loadSavedPlan(savedPlanIdToLoad);
      hydratePlan(savedDocument, { savedPlanId: savedPlan.id, savedPlanName: savedPlan.name });
      setIsLoadModalOpen(false);
    } catch (error) {
      setImportError(error.message);
    }
  }

  return (
    <div className={isSidebarOpen ? 'grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]' : 'grid gap-4'}>
      <section className="min-w-0 rounded border border-line bg-white shadow-panel">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-3 py-2">
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-slate-500">
              Nothing is sent to a server, all data stays in this computer
            </div>
            <div className="truncate text-[11px] text-slate-500">
              {document.tasks.length} tasks · {document.categories.length} categories ·{' '}
              {importError ? `URL state error: ${importError}` : saveStatus}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" className="text-xs" onClick={() => addCategory()}>
              <FolderPlus size={16} />
              Category
            </Button>
            <Button variant="secondary" className="text-xs" onClick={showDependencyPanel}>
              <GitBranchPlus size={16} />
              Dependency
            </Button>
            <Button className="text-xs" onClick={addStarterRows}>
              <Plus size={16} />
              Task
            </Button>
            <Button
              variant="secondary"
              className="text-xs"
              onClick={openBulkShift}
              disabled={selectedTaskIds.length === 0}
              aria-label="Bulk shift selected tasks by weeks"
              title="Bulk shift checked tasks by weeks"
            >
              <MoveHorizontal size={16} />
              Shift
            </Button>
            <Button variant="ghost" className="text-xs" onClick={exportActivePlanCsv} aria-label="Export CSV">
              <FileSpreadsheet size={16} />
            </Button>
            <Button
              variant="ghost"
              className="text-xs"
              onClick={saveCurrentPlan}
              title="Save to local storage"
            >
              <Save size={16} />
              Save
            </Button>
            <Button
              variant="ghost"
              className="text-xs"
              onClick={() => setIsSaveAsModalOpen(true)}
              title="Save as a new local-storage snapshot"
            >
              <Save size={16} />
              Save as
            </Button>
            <Button variant="ghost" className="text-xs" onClick={openLoadModal} title="Load from local storage">
              <FolderOpen size={16} />
              Load
            </Button>
            <Button variant="ghost" className="text-xs" onClick={showSettingsPanel} aria-label="Settings">
              <Settings size={16} />
              Settings
            </Button>
          </div>
        </header>
        <TimelineGrid document={document} />
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
      <BulkShiftModal document={document} open={isBulkShiftOpen} onClose={closeBulkShift} />
      <PastWeekEditModal />
      <SavePlanModal
        initialName={savedPlanName ?? document.plan.name}
        open={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={(name) => saveNamedPlan(name, savedPlanId)}
      />
      <SavePlanModal
        initialName={document.plan.name}
        open={isSaveAsModalOpen}
        title="Save plan as"
        onClose={() => setIsSaveAsModalOpen(false)}
        onSave={(name) => saveNamedPlan(name)}
      />
      <LoadPlanModal
        open={isLoadModalOpen}
        onClose={() => setIsLoadModalOpen(false)}
        onLoad={loadNamedPlan}
        savedPlans={savedPlans}
      />
    </div>
  );
}
