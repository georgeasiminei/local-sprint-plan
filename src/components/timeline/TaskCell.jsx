import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTimelineStore } from '../../store/index.js';

const EDITOR_WIDTH = 104;
const EDITOR_HEIGHT = 60;
const EDITOR_GAP = 4;
const VIEWPORT_MARGIN = 8;

export default function TaskCell({
  taskId,
  taskName,
  week,
  rowHeight,
  allocation,
  isManual,
  isOverride,
  isLocked,
  isEditable = true,
  isSelected = false,
  cellColor,
}) {
  const [draftValue, setDraftValue] = useState('');
  const [editorPosition, setEditorPosition] = useState(null);
  const cellRef = useRef(null);
  const clickTimerRef = useRef(null);
  const lastClickTimeRef = useRef(0);
  const editorRef = useRef(null);
  const requestWeekEdit = useTimelineStore((state) => state.requestWeekEdit);
  const setTaskResourceFromWeek = useTimelineStore((state) => state.setTaskResourceFromWeek);
  const selectTaskCell = useTimelineStore((state) => state.selectTaskCell);
  const editingResourceCell = useTimelineStore((state) => state.editingResourceCell);
  const openResourceCellEditor = useTimelineStore((state) => state.openResourceCellEditor);
  const closeResourceCellEditor = useTimelineStore((state) => state.closeResourceCellEditor);
  const isEditing = editingResourceCell?.taskId === taskId && editingResourceCell?.weekIndex === week?.weekIndex;

  useEffect(() => () => window.clearTimeout(clickTimerRef.current), []);

  useLayoutEffect(() => {
    if (!isEditing) {
      setEditorPosition(null);
      return undefined;
    }

    function updateEditorPosition() {
      const rect = cellRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - EDITOR_WIDTH - VIEWPORT_MARGIN);
      const opensUp = rect.top + EDITOR_GAP + EDITOR_HEIGHT > window.innerHeight - VIEWPORT_MARGIN;
      const top = opensUp ? rect.bottom - EDITOR_HEIGHT - EDITOR_GAP : rect.top + EDITOR_GAP;

      setEditorPosition({
        left: Math.min(Math.max(VIEWPORT_MARGIN, rect.left + EDITOR_GAP), maxLeft),
        top: Math.max(VIEWPORT_MARGIN, top),
      });
    }

    updateEditorPosition();
    window.addEventListener('resize', updateEditorPosition);
    window.addEventListener('scroll', updateEditorPosition, true);
    return () => {
      window.removeEventListener('resize', updateEditorPosition);
      window.removeEventListener('scroll', updateEditorPosition, true);
    };
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (editorRef.current?.contains(event.target)) {
        return;
      }

      closeResourceCellEditor();
    }

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [closeResourceCellEditor, isEditing]);

  function openEditor() {
    if (!week || !taskId || !isEditable || isLocked) {
      return;
    }

    selectTaskCell(taskId, week.weekIndex);
    setDraftValue(allocation ?? '');
    openResourceCellEditor(taskId, week.weekIndex);
  }

  function selectCell() {
    if (taskId) {
      selectTaskCell(taskId, week?.weekIndex ?? null);
    }
  }

  function commit(value) {
    closeResourceCellEditor();
    if (!week || !taskId || !isEditable || isLocked) {
      return;
    }
    requestWeekEdit(week, () => setTaskResourceFromWeek(taskId, week.weekIndex, Number(value)));
  }

  function unset() {
    closeResourceCellEditor();
    if (!week || !taskId || !isEditable || isLocked) {
      return;
    }

    requestWeekEdit(week, () => setTaskResourceFromWeek(taskId, week.weekIndex, 0));
  }

  return (
    <div
      ref={cellRef}
      role={week && taskId ? 'button' : undefined}
      tabIndex={week && taskId ? 0 : undefined}
      aria-label={week && taskId ? getCellLabel(taskName, week, isEditable && !isLocked) : undefined}
      className={`relative overflow-visible border-b border-r border-slate-200 px-1 text-center text-xs ${
        isSelected ? 'ring-2 ring-inset ring-focus/60' : ''
      }`}
      style={{ height: rowHeight, lineHeight: `${rowHeight}px`, ...(cellColor ? { backgroundColor: cellColor } : {}) }}
      onClick={(event) => {
        event.stopPropagation();
        if (!isEditable || isLocked) {
          selectCell();
          return;
        }

        const now = window.performance.now();
        const isDoubleClick = event.detail >= 2 || now - lastClickTimeRef.current < 500;
        lastClickTimeRef.current = now;

        if (isDoubleClick) {
          window.clearTimeout(clickTimerRef.current);
          openEditor();
          return;
        }

        selectCell();
        window.clearTimeout(clickTimerRef.current);
        clickTimerRef.current = window.setTimeout(() => {
          lastClickTimeRef.current = 0;
        }, 500);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        window.clearTimeout(clickTimerRef.current);
        openEditor();
      }}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && week) {
          event.preventDefault();
          selectCell();
          if (isEditable && !isLocked) {
            openEditor();
          }
        }
      }}
    >
      {isEditing && editorPosition
        ? createPortal(
            <div
              ref={editorRef}
              aria-label="Resource allocation editor"
              className="fixed z-50 grid grid-cols-[48px_48px] gap-1 rounded border border-line bg-white p-1 shadow-panel"
              onClick={(event) => event.stopPropagation()}
              onDoubleClick={(event) => event.stopPropagation()}
              style={{ left: editorPosition.left, lineHeight: 1, top: editorPosition.top }}
            >
              <input
                autoFocus
                aria-label={`Resource value for ${taskName ?? 'task'} in ${week.label}`}
                className="h-6 w-12 rounded border border-line px-1 text-center text-[11px] focus:outline-none focus:ring-2 focus:ring-focus/20"
                value={draftValue}
                inputMode="decimal"
                type="text"
                onChange={(event) => setDraftValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    event.stopPropagation();
                    commit(draftValue);
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    closeResourceCellEditor();
                  }
                }}
              />
              <button
                type="button"
                aria-label="Cancel resource edit"
                className="grid size-6 justify-self-end place-items-center rounded text-[13px] font-semibold text-slate-500 hover:bg-panel hover:text-ink"
                onClick={closeResourceCellEditor}
              >
                x
              </button>
              <button
                type="button"
                className="h-6 rounded bg-focus px-2 text-[11px] font-medium text-white hover:bg-blue-700"
                onClick={() => commit(draftValue)}
              >
                Set
              </button>
              <button
                type="button"
                className="h-6 rounded border border-line px-2 text-[11px] font-medium text-slate-700 hover:bg-panel"
                onClick={unset}
              >
                Unset
              </button>
            </div>,
            document.body,
          )
        : null}
      {!isEditing && (
        allocation ? (
          <span
            className={`inline-flex h-4 min-w-6 items-center justify-center rounded px-1 text-[11px] font-medium leading-4 ${
              isManual || isOverride ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'
            }`}
          >
            {allocation}
          </span>
        ) : (
          <span className="text-xs text-slate-300">{week ? '' : '-'}</span>
        )
      )}
    </div>
  );
}

function getCellLabel(taskName, week, canEdit) {
  if (canEdit) {
    return `Set ${taskName ?? 'task'} resources in ${week.label}`;
  }

  return `View ${taskName ?? 'task'} effective resources in ${week.label}`;
}
