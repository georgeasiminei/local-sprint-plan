import { useEffect } from 'react';
import { useTimelineStore } from '../store/index.js';

export function useKeyboardShortcuts() {
  useEffect(() => {
    function onKeyDown(event) {
      const target = event.target;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable;

      if ((event.ctrlKey || event.metaKey) && !isTyping && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          useTimelineStore.getState().redo();
        } else {
          useTimelineStore.getState().undo();
        }
      }

      if ((event.ctrlKey || event.metaKey) && !isTyping && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        useTimelineStore.getState().redo();
      }

      if (!isTyping && (event.key === 'Delete' || event.key === 'Backspace')) {
        const state = useTimelineStore.getState();
        if (state.selectedTaskId || state.selectedCategoryId || state.selectedExternalDependencyId) {
          event.preventDefault();
          state.deleteSelectedItem();
        }
      }

      if (event.key === 'Escape') {
        useTimelineStore.setState({
          selectedTaskId: null,
          selectedCategoryId: null,
          selectedExternalDependencyId: null,
          isSettingsOpen: false,
          isSidebarOpen: false,
        });
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
