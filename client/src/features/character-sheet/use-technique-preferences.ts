import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requestJson } from "@/lib/api";
import { preferenceKeys } from "@/lib/query-keys";
import { getOrCreateUserId } from "@/lib/user-id";
import type { TechniquePreference } from "@shared/schema";

interface PreferenceChange {
  techniqueId: string;
  isMinimized: boolean;
}

export function useTechniquePreferences() {
  const [userId] = useState(getOrCreateUserId);
  const queryClient = useQueryClient();
  const key = preferenceKeys.techniques(userId);
  const query = useQuery<TechniquePreference[]>({ queryKey: key });
  const minimizedByTechnique = useMemo(
    () => new Map((query.data ?? []).map((item) => [item.techniqueId, item.isMinimized])),
    [query.data],
  );

  const update = useMutation({
    mutationFn: ({ techniqueId, isMinimized }: PreferenceChange) =>
      requestJson<TechniquePreference>("POST", "/api/technique-preferences", {
        userId,
        techniqueId,
        isMinimized,
      }),
    onMutate: async (change) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<TechniquePreference[]>(key) ?? [];
      queryClient.setQueryData<TechniquePreference[]>(key, (current = []) => {
        const existing = current.find((item) => item.techniqueId === change.techniqueId);
        if (existing) {
          return current.map((item) =>
            item.techniqueId === change.techniqueId
              ? { ...item, isMinimized: change.isMinimized }
              : item,
          );
        }
        return [
          ...current,
          {
            id: `optimistic:${change.techniqueId}`,
            userId,
            techniqueId: change.techniqueId,
            isMinimized: change.isMinimized,
            createdAt: null,
            updatedAt: null,
          },
        ];
      });
      return { previous };
    },
    onError: (_error, _change, context) => {
      if (context) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<TechniquePreference[]>(key, (current = []) => [
        ...current.filter((item) => item.techniqueId !== saved.techniqueId),
        saved,
      ]);
    },
  });

  return {
    isMinimized: (techniqueId: string) => minimizedByTechnique.get(techniqueId) ?? false,
    setMinimized: (techniqueId: string, isMinimized: boolean) =>
      update.mutate({ techniqueId, isMinimized }),
  };
}
