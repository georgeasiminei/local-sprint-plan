import { useEffect, useMemo, useRef } from 'react';
import { useTimelineStore } from '../store/index.js';
import { createPlanDocument } from '../persistence/schema.js';
import {
  compactPlanDocument,
  decodePlanFromHashPayload,
  encodePlanToHashPayload,
} from '../persistence/shareUrl.js';
import { validatePlanDocument } from '../utils/validators.js';

export function useUrlPlan() {
  const activeDocument = useTimelineStore((state) => state.getActiveDocument());
  const hasHydrated = useTimelineStore((state) => state.hasHydrated);
  const hydratePlan = useTimelineStore((state) => state.hydratePlan);
  const setImportError = useTimelineStore((state) => state.setImportError);
  const setSaveStatus = useTimelineStore((state) => state.setSaveStatus);
  const lastPayloadRef = useRef('');
  const writeVersionRef = useRef(0);
  const debouncedUrlWrite = useMemo(
    () =>
      debounce(async (document, writeVersion) => {
        try {
          const payload = await encodePlanToHashPayload(document);

          if (writeVersion !== writeVersionRef.current) {
            return;
          }

          if (payload === lastPayloadRef.current) {
            setSaveStatus('url updated');
            return;
          }

          lastPayloadRef.current = payload;
          replaceHashPayload(payload);
          setSaveStatus('url updated');
        } catch (error) {
          setSaveStatus('url error');
          setImportError(error.message);
        }
      }, 250),
    [setImportError, setSaveStatus],
  );

  useEffect(() => {
    if (hasHydrated) {
      return undefined;
    }

    let isMounted = true;

    hydrateFromHashPayload(readHashPayload(), {
      hydratePlan,
      setImportError,
      isStale: () => !isMounted,
    }).then((committedPayload) => {
      if (committedPayload !== null) {
        lastPayloadRef.current = committedPayload;
      }
    });

    return () => {
      isMounted = false;
    };
  }, [hasHydrated, hydratePlan, setImportError]);

  useEffect(() => {
    if (!hasHydrated) {
      return undefined;
    }

    // history.replaceState (this hook's own writes below) does not fire hashchange, so
    // this only ever runs for navigation the hook did not itself cause: the address
    // bar, a bookmark, or an in-page link to a different plan pasted into the same tab.
    // Without it, that navigation was silently ignored and then overwritten by the next
    // edit's debounced write of the *old* plan.
    function handleHashChange() {
      const payload = readHashPayload();
      if (payload === lastPayloadRef.current) {
        return;
      }

      hydrateFromHashPayload(payload, { hydratePlan, setImportError }).then((committedPayload) => {
        if (committedPayload !== null) {
          lastPayloadRef.current = committedPayload;
        }
      });
    }

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [hasHydrated, hydratePlan, setImportError]);

  useEffect(() => {
    if (!hasHydrated || !activeDocument) {
      return;
    }

    if (!lastPayloadRef.current && isPristineCompactDocument(compactPlanDocument(activeDocument))) {
      setSaveStatus('url ready');
      return;
    }

    setSaveStatus('updating url');
    const writeVersion = ++writeVersionRef.current;
    debouncedUrlWrite(activeDocument, writeVersion);

    return () => {
      debouncedUrlWrite.cancel();
    };
  }, [activeDocument, debouncedUrlWrite, hasHydrated, setSaveStatus]);
}

// Decodes `payload` and commits the result to the store, in the one order that keeps
// a decode failure visible: hydratePlan() itself always resets importError to null (a
// fresh hydration should normally start error-free), so the fallback plan must be
// hydrated *before* setImportError runs, never after - otherwise the error is erased
// the instant it is set and a broken link silently looks like an empty, healthy plan.
// Returns the payload that should become `lastPayloadRef.current` ('' on failure), or
// null if `isStale()` says this result should be discarded (a newer call has already
// committed something more recent).
async function hydrateFromHashPayload(payload, { hydratePlan, setImportError, isStale = () => false }) {
  try {
    const document = payload ? await decodePlanFromHashPayload(payload) : createPlanDocument();
    // A shared link is untrusted input: decode can succeed structurally (right shape of
    // array) while still producing a document with dangling references or out-of-range
    // week indexes (a corrupted link, or one from an incompatible future version).
    // Validate before handing it to the store rather than hydrating broken data.
    if (payload) {
      const result = validatePlanDocument(document);
      if (!result.valid) {
        throw new Error(result.errors[0] ?? 'Shared link contains an invalid plan.');
      }
    }

    if (isStale()) {
      return null;
    }

    hydratePlan(document);
    return payload;
  } catch (error) {
    if (isStale()) {
      return null;
    }

    hydratePlan(createPlanDocument());
    setImportError(error.message);
    return '';
  }
}

function readHashPayload() {
  return window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
}

function replaceHashPayload(payload) {
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${payload}`);
}

function isPristineCompactDocument(compactDocument) {
  return compactDocument.length === 1 && Array.isArray(compactDocument[0]) && compactDocument[0].length === 0;
}

function debounce(callback, delay) {
  let timeoutId;
  const debounced = (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => callback(...args), delay);
  };

  debounced.cancel = () => {
    window.clearTimeout(timeoutId);
  };

  return debounced;
}
