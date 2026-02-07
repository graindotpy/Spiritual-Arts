import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InsertTechnique, InsertSpiritDiePool, InsertActiveEffect, Character } from "@shared/schema";

export function useCharacterState(characterId: string | undefined) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateCharacter = useMutation({
    mutationFn: async (data: Partial<Character>) => {
      if (!characterId) throw new Error("No character ID");
      const response = await apiRequest("PUT", `/api/character/${characterId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/character"] });
      queryClient.invalidateQueries({ queryKey: ["/api/character", characterId, "spirit-die-pool"] });
      toast({
        title: "Success",
        description: "Character updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update character",
        variant: "destructive",
      });
    },
  });

  const updateSpiritDiePool = useMutation({
    mutationFn: async (data: Partial<InsertSpiritDiePool>) => {
      if (!characterId) throw new Error("No character ID");
      const response = await apiRequest("PUT", `/api/character/${characterId}/spirit-die-pool`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/character", characterId, "spirit-die-pool"] });
      toast({
        title: "Success",
        description: "Spirit die pool updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update spirit die pool",
        variant: "destructive",
      });
    },
  });

  const rollSpiritedie = useMutation({
    mutationFn: async (data: { spInvestment: number; dieIndex?: number; techniqueId?: string | null }) => {
      if (!characterId) throw new Error("No character ID");
      const response = await apiRequest("POST", `/api/character/${characterId}/roll`, data);
      return response.json();
    },
    onSuccess: (result) => {
      const rollAnimationMs = 1100;
      const rollPostDelayMs = 1400;

      // Delay the pool refresh to allow animation and notification to complete
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/character", characterId, "spirit-die-pool"] });
      }, rollPostDelayMs);
      
      // Delay toast to match roll animation completion
      setTimeout(() => {
        toast({
          title: result.success ? "Success!" : "Failed",
          description: result.success 
            ? `Rolled ${result.value} - Success!` 
            : `Rolled ${result.value} - Die reduced`,
          variant: result.success ? "default" : "destructive",
        });
      }, rollAnimationMs);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to roll die",
        variant: "destructive",
      });
    },
  });



  const createTechnique = useMutation({
    mutationFn: async (data: Omit<InsertTechnique, 'characterId'>) => {
      if (!characterId) throw new Error("No character ID");
      const response = await apiRequest("POST", `/api/character/${characterId}/techniques`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/character", characterId, "techniques"] });
      toast({
        title: "Success",
        description: "Technique created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create technique",
        variant: "destructive",
      });
    },
  });

  const updateTechnique = useMutation({
    mutationFn: async (data: { id: string } & Partial<InsertTechnique>) => {
      const { id, ...updateData } = data;
      const response = await apiRequest("PUT", `/api/techniques/${id}`, updateData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/character", characterId, "techniques"] });
      toast({
        title: "Success",
        description: "Technique updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update technique",
        variant: "destructive",
      });
    },
  });

  const deleteTechnique = useMutation({
    mutationFn: async (techniqueId: string) => {
      const response = await apiRequest("DELETE", `/api/techniques/${techniqueId}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/character", characterId, "techniques"] });
      toast({
        title: "Success",
        description: "Technique deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete technique",
        variant: "destructive",
      });
    },
  });

  const createActiveEffect = useMutation({
    mutationFn: async (data: Omit<InsertActiveEffect, 'characterId'>) => {
      if (!characterId) throw new Error("No character ID");
      const response = await apiRequest("POST", `/api/character/${characterId}/active-effects`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/character", characterId, "active-effects"] });
      toast({
        title: "Success",
        description: "Active effect added",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add active effect",
        variant: "destructive",
      });
    },
  });

  const deleteActiveEffect = useMutation({
    mutationFn: async (effectId: string) => {
      const response = await apiRequest("DELETE", `/api/active-effects/${effectId}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/character", characterId, "active-effects"] });
      toast({
        title: "Success",
        description: "Active effect removed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove active effect",
        variant: "destructive",
      });
    },
  });

  const updateCharacterLevel = useMutation({
    mutationFn: async (data: { level: number }) => {
      if (!characterId) throw new Error("No character ID");
      const response = await apiRequest("PUT", `/api/character/${characterId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/character"] });
      queryClient.invalidateQueries({ queryKey: ["/api/character", characterId, "spirit-die-pool"] });
      toast({
        title: "Success",
        description: "Character level updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update character level",
        variant: "destructive",
      });
    },
  });

  return {
    updateCharacter,
    updateSpiritDiePool,
    updateCharacterLevel,
    rollSpiritedie,
    createTechnique,
    updateTechnique,
    deleteTechnique,
    createActiveEffect,
    deleteActiveEffect,
  };
}
