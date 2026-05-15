import { useTimelineStore } from '../store/index.js';

export function useUndoRedo() {
  const undoStack = useTimelineStore((state) => state.undoStack);
  const redoStack = useTimelineStore((state) => state.redoStack);

  return {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}
