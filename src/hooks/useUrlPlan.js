import { useEffect, useMemo, useRef } from 'react';
import { useTimelineStore } from '../store/index.js';
import { createPlanDocument } from '../persistence/schema.js';
import { compactPlanDocument, decodePlanFromHashPayload, encodePlanToHashPayload } from '../persistence/shareUrl.js';

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
          window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${payload}`);
          setSaveStatus('url updated');
        } catch (error) {
          setSaveStatus('url error');
          setImportError(error.message);
        }
      }, 250),
    [setImportError, setSaveStatus],
  );

  useEffect(() => {
    let isMounted = true;

    async function hydrateFromUrl() {
      const payload = readHashPayload();

      try {
        const document = payload ? await decodePlanFromHashPayload(payload) : createPlanDocument();

        if (!isMounted) {
          return;
        }

        lastPayloadRef.current = payload;
        hydratePlan(document);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setImportError(error.message);
        hydratePlan(createPlanDocument());
      }
    }

    if (!hasHydrated) {
      hydrateFromUrl();
    }

    return () => {
      isMounted = false;
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

function readHashPayload() {
  return window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
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
