import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { requestJson } from "@/lib/api";
import { characterKeys, dmKeys } from "@/lib/query-keys";
import type { GlossaryTerm, DmGlossaryTerm } from "@shared/schema";

export interface GlossaryScope {
  queryKey: (entityId: string) => readonly string[];
  listPath: (entityId: string) => string;
  updatePath: (termId: string) => string;
}

// Character glossary scope
export const characterGlossaryScope: GlossaryScope = {
  queryKey: characterKeys.glossary,
  listPath: (characterId: string) => `/api/character/${characterId}/glossary`,
  updatePath: (termId: string) => `/api/glossary/${termId}`,
};

// DM glossary scope
export const dmGlossaryScope: GlossaryScope = {
  queryKey: dmKeys.glossary,
  listPath: (userId: string) => `/api/dm/${userId}/glossary`,
  updatePath: (termId: string) => `/api/dm/glossary/${termId}`,
};

// Generic hook to fetch glossary terms
export function useGlossaryTerms<T = GlossaryTerm | DmGlossaryTerm>(
  scope: GlossaryScope,
  entityId: string
) {
  return useQuery<T[]>({
    queryKey: scope.queryKey(entityId),
    queryFn: () => requestJson<T[]>("GET", scope.listPath(entityId)),
    enabled: !!entityId,
  });
}

// Generic hook for glossary mutations
export function useGlossaryMutations(
  scope: GlossaryScope,
  entityId: string,
  onSuccess?: () => void,
  onError?: () => void
) {
  const queryClient = useQueryClient();

  const updateTerm = useMutation({
    mutationFn: async (data: { termId: string; update: Partial<GlossaryTerm | DmGlossaryTerm> }) => {
      return requestJson<GlossaryTerm | DmGlossaryTerm>(
        "PUT",
        scope.updatePath(data.termId),
        data.update,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scope.queryKey(entityId) });
      onSuccess?.();
    },
    onError: () => {
      onError?.();
    },
  });

  return { updateTerm };
}
