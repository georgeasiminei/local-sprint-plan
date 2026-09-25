import { useEffect, useRef, useState } from 'react';

// Shared by every "commit on blur/Enter, discard on Escape" input (plan settings,
// task/week/dependency fields). It exists because the same bug was independently
// duplicated in four separate components: on Escape, each called
// setDraft(originalValue) and then synchronously input.blur() in the same handler.
// blur() fires onBlur's commit() *before* React flushes the queued setDraft update, so
// commit() still read the edited (uncancelled) draft and committed it anyway -
// pressing Escape to discard an edit silently kept it instead.
//
// consumeCancelled() must be the first thing a caller's commit()/onBlur handler
// checks, before comparing or parsing `draft`.
export function useDeferredDraft(value, formatValue = (raw) => String(raw ?? '')) {
  const [draft, setDraft] = useState(() => formatValue(value));
  const isCancellingRef = useRef(false);

  useEffect(() => {
    setDraft(formatValue(value));
    // formatValue is expected to be stable (module-level or caller-memoized); it is
    // intentionally not in this dependency list so an inline arrow doesn't re-run this
    // on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function cancel() {
    isCancellingRef.current = true;
    setDraft(formatValue(value));
  }

  function consumeCancelled() {
    if (!isCancellingRef.current) {
      return false;
    }

    isCancellingRef.current = false;
    return true;
  }

  return { draft, setDraft, cancel, consumeCancelled };
}
