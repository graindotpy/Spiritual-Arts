import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { GlossaryTerm, DmGlossaryTerm } from "@shared/schema";

export interface GlossaryScope {
  queryKeyBase: string;
  listPath: (entityId: string) => string;
  updatePath: (termId: string) => string;
}

// Character glossary scope
export const characterGlossaryScope: GlossaryScope = {
  queryKeyBase: "/api/character",
  listPath: (characterId: string) => `/api/character/${characterId}/glossary`,
  updatePath: (termId: string) => `/api/glossary/${termId}`,
};

// DM glossary scope
export const dmGlossaryScope: GlossaryScope = {
  queryKeyBase: "/api/dm",
  listPath: (userId: string) => `/api/dm/${userId}/glossary`,
  updatePath: (termId: string) => `/api/dm/glossary/${termId}`,
};

// Generic hook to fetch glossary terms
export function useGlossaryTerms<T = GlossaryTerm | DmGlossaryTerm>(
  scope: GlossaryScope,
  entityId: string
) {
  return useQuery<T[]>({
    queryKey: [scope.queryKeyBase, entityId, "glossary"],
    queryFn: async () => {
      const response = await apiRequest('GET', scope.listPath(entityId));
      return response.json();
    },
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
      const response = await apiRequest("PUT", scope.updatePath(data.termId), data.update);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [scope.queryKeyBase, entityId, "glossary"] });
      onSuccess?.();
    },
    onError: () => {
      onError?.();
    },
  });

  return { updateTerm };
}
