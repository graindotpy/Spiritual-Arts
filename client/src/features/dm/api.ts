import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requestJson } from "@/lib/api";
import { dmKeys } from "@/lib/query-keys";
import type { DmGlossaryTerm, DmScratchpad, DmStack } from "@shared/schema";

export type DmStackDraft = Pick<DmStack, "name" | "target" | "effect">;
export type DmStackUpdate = DmStackDraft & { id: string };
export type DmGlossaryDraft = Pick<DmGlossaryTerm, "keyword" | "definition">;
export type DmGlossaryUpdate = DmGlossaryDraft & { id: string };
export type DmScratchpadDraft = { title?: string; content: string };
export type DmScratchpadUpdate = {
  id: string;
  title?: string;
  content?: string;
};

const dmQueryKeys = dmKeys;

export function useDmStacks(userId: string) {
  return useQuery<DmStack[]>({
    queryKey: dmQueryKeys.stacks(userId),
    queryFn: () => requestJson<DmStack[]>("GET", `/api/dm/${userId}/stacks`),
    enabled: Boolean(userId),
  });
}

export function useDmGlossary(userId: string) {
  return useQuery<DmGlossaryTerm[]>({
    queryKey: dmQueryKeys.glossary(userId),
    queryFn: () =>
      requestJson<DmGlossaryTerm[]>("GET", `/api/dm/${userId}/glossary`),
    enabled: Boolean(userId),
  });
}

export function useDmScratchpads(userId: string) {
  return useQuery<DmScratchpad[]>({
    queryKey: dmQueryKeys.scratchpads(userId),
    queryFn: () =>
      requestJson<DmScratchpad[]>("GET", `/api/dm/${userId}/scratchpads`),
    enabled: Boolean(userId),
  });
}

export function useDmStackMutations(userId: string) {
  const queryClient = useQueryClient();
  const invalidateStacks = () =>
    queryClient.invalidateQueries({ queryKey: dmQueryKeys.stacks(userId) });

  const createStack = useMutation({
    mutationFn: (draft: DmStackDraft) =>
      requestJson<DmStack>("POST", `/api/dm/${userId}/stacks`, draft),
    onSuccess: invalidateStacks,
  });

  const updateStack = useMutation({
    mutationFn: ({ id, ...draft }: DmStackUpdate) =>
      requestJson<DmStack>("PUT", `/api/dm/stacks/${id}`, draft),
    onSuccess: invalidateStacks,
  });

  const deleteStack = useMutation({
    mutationFn: async (id: string) => {
      await requestJson<{ success: boolean }>("DELETE", `/api/dm/stacks/${id}`);
    },
    onSuccess: invalidateStacks,
  });

  return { createStack, updateStack, deleteStack };
}

export function useDmGlossaryMutations(userId: string) {
  const queryClient = useQueryClient();
  const invalidateGlossary = () =>
    queryClient.invalidateQueries({ queryKey: dmQueryKeys.glossary(userId) });

  const createGlossaryTerm = useMutation({
    mutationFn: (draft: DmGlossaryDraft) =>
      requestJson<DmGlossaryTerm>("POST", `/api/dm/${userId}/glossary`, draft),
    onSuccess: invalidateGlossary,
  });

  const updateGlossaryTerm = useMutation({
    mutationFn: ({ id, ...draft }: DmGlossaryUpdate) =>
      requestJson<DmGlossaryTerm>("PUT", `/api/dm/glossary/${id}`, draft),
    onSuccess: invalidateGlossary,
  });

  const deleteGlossaryTerm = useMutation({
    mutationFn: async (id: string) => {
      await requestJson<{ success: boolean }>("DELETE", `/api/dm/glossary/${id}`);
    },
    onSuccess: invalidateGlossary,
  });

  return { createGlossaryTerm, updateGlossaryTerm, deleteGlossaryTerm };
}

export function useDmScratchpadMutations(userId: string) {
  const queryClient = useQueryClient();
  const scratchpadKey = dmQueryKeys.scratchpads(userId);
  const invalidateScratchpads = () =>
    queryClient.invalidateQueries({ queryKey: scratchpadKey });

  const createScratchpad = useMutation({
    mutationFn: (draft: DmScratchpadDraft) =>
      requestJson<DmScratchpad>("POST", `/api/dm/${userId}/scratchpads`, draft),
    onSuccess: invalidateScratchpads,
  });

  const updateScratchpad = useMutation({
    mutationFn: ({ id, ...draft }: DmScratchpadUpdate) =>
      requestJson<DmScratchpad>("PUT", `/api/dm/scratchpads/${id}`, draft),
    onSuccess: (updatedScratchpad, update) => {
      queryClient.setQueryData<DmScratchpad[]>(scratchpadKey, (scratchpads) =>
        scratchpads?.map((scratchpad) =>
          scratchpad.id === updatedScratchpad.id
            ? {
                ...scratchpad,
                ...(update.title !== undefined
                  ? { title: updatedScratchpad.title }
                  : {}),
                ...(update.content !== undefined
                  ? { content: updatedScratchpad.content }
                  : {}),
              }
            : scratchpad,
        ),
      );
    },
  });

  const deleteScratchpad = useMutation({
    mutationFn: async (id: string) => {
      await requestJson<{ success: boolean }>("DELETE", `/api/dm/scratchpads/${id}`);
    },
    onSuccess: invalidateScratchpads,
  });

  return { createScratchpad, updateScratchpad, deleteScratchpad };
}
