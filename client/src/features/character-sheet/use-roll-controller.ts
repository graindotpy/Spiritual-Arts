import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCharacterState } from "@/hooks/use-character-state";
import { characterKeys } from "@/lib/query-keys";
import type { RollResult, SpiritDiePool } from "@shared/schema";
import {
  canSpiritDieMeetInvestment,
  type SpiritDieSlot,
} from "@shared/spirit-dice";

const ROLL_ANIMATION_MS = 1_500;
const RESULT_VISIBILITY_MS = 1_000;

export function useRollController(characterId: string) {
  const queryClient = useQueryClient();
  const { rollSpiritedie } = useCharacterState(characterId);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedTechniqueId, setSelectedTechniqueId] = useState<string | null>(null);
  const [selectedSp, setSelectedSp] = useState(0);
  const [isRolling, setIsRolling] = useState(false);
  const [result, setResult] = useState<RollResult | null>(null);
  const [showResult, setShowResult] = useState(false);

  const clearTimers = () => {
    if (finishTimer.current) clearTimeout(finishTimer.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    finishTimer.current = null;
    hideTimer.current = null;
  };

  useEffect(() => clearTimers, []);

  const selectTechnique = (techniqueId: string, sp: number) => {
    setSelectedTechniqueId(techniqueId);
    setSelectedSp(sp);
  };

  const roll = async (dieIndex: number | null, die: SpiritDieSlot) => {
    if (
      !selectedTechniqueId ||
      dieIndex === null ||
      !canSpiritDieMeetInvestment(die, selectedSp) ||
      isRolling
    ) {
      return;
    }

    clearTimers();
    setShowResult(false);
    setIsRolling(true);

    try {
      const rollResult = await rollSpiritedie.mutateAsync({
        spInvestment: selectedSp,
        dieIndex,
        techniqueId: selectedTechniqueId,
      });
      setResult(rollResult);
      await queryClient.invalidateQueries({
        queryKey: characterKeys.spiritDice(characterId),
        refetchType: "none",
      });

      finishTimer.current = setTimeout(() => {
        queryClient.setQueryData<SpiritDiePool>(
          characterKeys.spiritDice(characterId),
          (pool) => (pool ? { ...pool, currentDice: rollResult.newDicePool } : pool),
        );
        setIsRolling(false);
        setShowResult(true);
        hideTimer.current = setTimeout(() => {
          setShowResult(false);
          setResult(null);
        }, RESULT_VISIBILITY_MS);
      }, ROLL_ANIMATION_MS);
    } catch {
      setIsRolling(false);
      setResult(null);
      setShowResult(false);
    }
  };

  return {
    selectedTechniqueId,
    selectedSp,
    selectTechnique,
    isRolling,
    result,
    showResult,
    roll,
  };
}
