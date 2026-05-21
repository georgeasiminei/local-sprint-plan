import { useTimelineStore } from './store/index.js';
import { useUrlPlan } from './hooks/useUrlPlan.js';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';
import PlanView from './pages/PlanView.jsx';

export default function App() {
  const hasHydrated = useTimelineStore((state) => state.hasHydrated);

  useUrlPlan();
  useKeyboardShortcuts();

  return (
    <div className="min-h-screen bg-slate-100 text-ink">
      <main className="w-full px-3 py-3">
        {hasHydrated ? <PlanView /> : null}
      </main>
    </div>
  );
}
