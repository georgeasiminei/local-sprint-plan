import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDeferredDraft } from './useDeferredDraft.js';

describe('useDeferredDraft', () => {
  it('starts with the formatted value and updates the draft as the user types', () => {
    const { result } = renderHook(() => useDeferredDraft(5));

    expect(result.current.draft).toBe('5');

    act(() => result.current.setDraft('12'));
    expect(result.current.draft).toBe('12');
  });

  it('reports cancelled exactly once after cancel(), and resets the draft', () => {
    const { result } = renderHook(() => useDeferredDraft(5));

    act(() => result.current.setDraft('999'));

    // This is the bug the hook exists to fix: a caller's blur handler can fire
    // synchronously (via event.currentTarget.blur()) before React flushes the state
    // update queued by cancel(), so "was this blur caused by Escape" is tracked via a
    // ref (updated synchronously, unbatched) rather than by comparing draft/value.
    let cancelledDuringSameTick;
    act(() => {
      result.current.cancel();
      cancelledDuringSameTick = result.current.consumeCancelled();
    });

    expect(cancelledDuringSameTick).toBe(true);
    expect(result.current.draft).toBe('5');

    // Consuming the flag clears it, so a later, unrelated blur commits normally.
    expect(result.current.consumeCancelled()).toBe(false);
  });

  it('does not report cancelled for an ordinary blur that was never preceded by cancel()', () => {
    const { result } = renderHook(() => useDeferredDraft(5));

    act(() => result.current.setDraft('12'));

    expect(result.current.consumeCancelled()).toBe(false);
  });

  it('re-syncs the draft when the source value changes externally', () => {
    const { result, rerender } = renderHook(({ value }) => useDeferredDraft(value), {
      initialProps: { value: 5 },
    });

    act(() => result.current.setDraft('999'));
    rerender({ value: 7 });

    expect(result.current.draft).toBe('7');
  });
});
