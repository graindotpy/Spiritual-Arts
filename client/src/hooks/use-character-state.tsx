import { useMutation, useQueryClient } from "@tanstack/react-query";
import { requestJson } from "@/lib/api";
import { characterKeys } from "@/lib/query-keys";
import { useToast } from "@/hooks/use-toast";
import type {
  ActiveEffect,
  Character,
  InsertActiveEffect,
  InsertSpiritDiePool,
  InsertTechnique,
  RollResult,
  SpiritDiePool,
  Technique,
} from "@shared/schema";

function requireCharacterId(characterId: string | undefined): string {
  if (!characterId) {
    throw new Error("No character is selected");
  }
  return characterId;
}

export function useCharacterState(characterId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidateCharacter = async () => {
    if (!characterId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: characterKeys.all }),
      queryClient.invalidateQueries({ queryKey: characterKeys.detail(characterId) }),
    ]);
  };

  const updateCharacter = useMutation({
    mutationFn: (
      data: Pick<Partial<Character>, "name" | "path" | "level" | "highestAbilityScore">,
    ) => {
      const id = requireCharacterId(characterId);
      return requestJson<Character>("PUT", `/api/character/${id}`, data);
    },
    onSuccess: async () => {
      await invalidateCharacter();
      if (characterId) {
        await queryClient.invalidateQueries({ queryKey: characterKeys.spiritDice(characterId) });
      }
      toast({ title: "Character updated" });
    },
    onError: () => {
      toast({
        title: "Character update failed",
        description: "Your changes could not be saved.",
        variant: "destructive",
      });
    },
  });

  const updateSpiritDiePool = useMutation({
    mutationFn: (data: Partial<Omit<InsertSpiritDiePool, "characterId">>) => {
      const id = requireCharacterId(characterId);
      return requestJson<SpiritDiePool>("PUT", `/api/character/${id}/spirit-die-pool`, data);
    },
    onSuccess: (pool) => {
      if (!characterId) return;
      queryClient.setQueryData(characterKeys.spiritDice(characterId), pool);
    },
    onError: () => {
      toast({
        title: "Spirit dice update failed",
        description: "The die pool could not be saved.",
        variant: "destructive",
      });
    },
  });

  const rollSpiritedie = useMutation({
    mutationFn: (data: {
      spInvestment: number;
      dieIndex?: number;
      techniqueId?: string | null;
    }) => {
      const id = requireCharacterId(characterId);
      return requestJson<RollResult>("POST", `/api/character/${id}/roll`, data);
    },
    onError: () => {
      toast({
        title: "Roll failed",
        description: "The selected die could not be rolled.",
        variant: "destructive",
      });
    },
  });

  const createTechnique = useMutation({
    mutationFn: (data: Omit<InsertTechnique, "characterId">) => {
      const id = requireCharacterId(characterId);
      return requestJson<Technique>("POST", `/api/character/${id}/techniques`, data);
    },
    onSuccess: async () => {
      if (!characterId) return;
      await queryClient.invalidateQueries({ queryKey: characterKeys.techniques(characterId) });
      toast({ title: "Technique created" });
    },
    onError: () => {
      toast({ title: "Technique creation failed", variant: "destructive" });
    },
  });

  const updateTechnique = useMutation({
    mutationFn: ({ id, ...update }: { id: string } & Partial<InsertTechnique>) =>
      requestJson<Technique>("PUT", `/api/techniques/${id}`, update),
    onSuccess: async () => {
      if (!characterId) return;
      await queryClient.invalidateQueries({ queryKey: characterKeys.techniques(characterId) });
      toast({ title: "Technique updated" });
    },
    onError: () => {
      toast({ title: "Technique update failed", variant: "destructive" });
    },
  });

  const deleteTechnique = useMutation({
    mutationFn: (techniqueId: string) =>
      requestJson<{ success: boolean }>("DELETE", `/api/techniques/${techniqueId}`),
    onSuccess: async () => {
      if (!characterId) return;
      await queryClient.invalidateQueries({ queryKey: characterKeys.techniques(characterId) });
      toast({ title: "Technique deleted" });
    },
    onError: () => {
      toast({ title: "Technique deletion failed", variant: "destructive" });
    },
  });

  const createActiveEffect = useMutation({
    mutationFn: (data: Omit<InsertActiveEffect, "characterId">) => {
      const id = requireCharacterId(characterId);
      return requestJson<ActiveEffect>("POST", `/api/character/${id}/active-effects`, data);
    },
    onSuccess: async () => {
      if (!characterId) return;
      await queryClient.invalidateQueries({ queryKey: characterKeys.activeEffects(characterId) });
    },
  });

  const deleteActiveEffect = useMutation({
    mutationFn: (effectId: string) =>
      requestJson<{ success: boolean }>("DELETE", `/api/active-effects/${effectId}`),
    onSuccess: async () => {
      if (!characterId) return;
      await queryClient.invalidateQueries({ queryKey: characterKeys.activeEffects(characterId) });
    },
  });

  return {
    updateCharacter,
    updateCharacterLevel: updateCharacter,
    updateSpiritDiePool,
    rollSpiritedie,
    createTechnique,
    updateTechnique,
    deleteTechnique,
    createActiveEffect,
    deleteActiveEffect,
  };
}
