import { useCallback, useEffect, useRef } from "react";
import {
  cardGameConflictResponse,
  parsePersistedUpdatedAt,
  saveCardGameState,
} from "./api";
import type { PersistedCardGameState } from "./types";

type AutosaveOptions = {
  state: PersistedCardGameState;
  enabled: boolean;
  onError: (error: unknown) => void;
  rebaseOnConflict?: (
    local: PersistedCardGameState,
    remote: PersistedCardGameState,
  ) => PersistedCardGameState;
  onRebased?: (rebased: PersistedCardGameState) => void;
  onSaved?: (saved: PersistedCardGameState) => void;
  debounceMs?: number;
};

/** Serializes document writes so an older response cannot win over a newer edit. */
export function useCardGameAutosave({
  state,
  enabled,
  onError,
  rebaseOnConflict,
  onRebased,
  onSaved,
  debounceMs = 300,
}: AutosaveOptions): void {
  const latestStateRef = useRef(state);
  const queuedStateRef = useRef<PersistedCardGameState | null>(null);
  const serverUpdatedAtRef = useRef(state.updatedAt);
  const timerRef = useRef<number | null>(null);
  const savingRef = useRef(false);
  const mountedRef = useRef(true);
  const enabledRef = useRef(enabled);
  const wasEnabledRef = useRef(false);
  const onErrorRef = useRef(onError);
  const rebaseOnConflictRef = useRef(rebaseOnConflict);
  const onRebasedRef = useRef(onRebased);
  const onSavedRef = useRef(onSaved);
  const flushRef = useRef<() => void>(() => undefined);

  latestStateRef.current = state;
  enabledRef.current = enabled;
  onErrorRef.current = onError;
  rebaseOnConflictRef.current = rebaseOnConflict;
  onRebasedRef.current = onRebased;
  onSavedRef.current = onSaved;

  const schedule = useCallback((delay: number) => {
    if (!mountedRef.current) return;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      flushRef.current();
    }, delay);
  }, []);

  const flush = useCallback(() => {
    if (!enabledRef.current || savingRef.current) return;
    const queued = queuedStateRef.current;
    if (!queued) return;

    queuedStateRef.current = null;
    savingRef.current = true;
    let retryDelay = 0;
    const stateToSave = {
      ...queued,
      updatedAt: serverUpdatedAtRef.current,
    };

    void saveCardGameState(stateToSave)
      .then((response) => {
        const updatedAt = parsePersistedUpdatedAt(response.updatedAt);
        if (updatedAt !== undefined) serverUpdatedAtRef.current = updatedAt;
        onSavedRef.current?.(stateToSave);
      })
      .catch((error: unknown) => {
        const conflict = cardGameConflictResponse(error);
        const updatedAt = parsePersistedUpdatedAt(conflict?.updatedAt);
        if (updatedAt !== undefined) serverUpdatedAtRef.current = updatedAt;
        const remote = conflict?.state;
        const rebased =
          remote && rebaseOnConflictRef.current
            ? rebaseOnConflictRef.current(latestStateRef.current, remote)
            : latestStateRef.current;
        queuedStateRef.current = rebased;
        if (mountedRef.current && remote && rebaseOnConflictRef.current) {
          onRebasedRef.current?.(rebased);
        }
        retryDelay = conflict ? 0 : 1500;
        if (!conflict) onErrorRef.current(error);
      })
      .finally(() => {
        savingRef.current = false;
        if (mountedRef.current && queuedStateRef.current) schedule(retryDelay);
      });
  }, [schedule]);

  flushRef.current = flush;

  useEffect(() => {
    if (!enabled) {
      wasEnabledRef.current = false;
      return;
    }
    if (!wasEnabledRef.current) {
      serverUpdatedAtRef.current = state.updatedAt;
      wasEnabledRef.current = true;
    }
    queuedStateRef.current = state;
    schedule(debounceMs);
  }, [debounceMs, enabled, schedule, state]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (queuedStateRef.current && !savingRef.current && enabledRef.current) {
        flushRef.current();
      }
    };
  }, []);
}
