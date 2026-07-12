import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import SpiritDiePoolComponent from "@/components/spirit-die-pool";
import TechniqueEditor from "@/components/technique-editor";
import SpiritDieOverride from "@/components/spirit-die-override";
import LevelEditor from "@/components/level-editor";
import GlossaryDialog from "@/components/glossary-dialog";
import TrackerDialog from "@/components/tracker-dialog";
import SpiritRollNotification from "@/components/spirit-roll-notification";
import RollResultNotification from "@/components/roll-result-notification";
import { useCharacterState } from "@/hooks/use-character-state";
import { useWebSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { requestJson } from "@/lib/api";
import { characterKeys } from "@/lib/query-keys";
import { CharacterSheetHeader } from "@/features/character-sheet/character-sheet-header";
import { CharacterSheetHero } from "@/features/character-sheet/character-sheet-hero";
import { TechniquesPanel } from "@/features/character-sheet/techniques-panel";
import { TrackersPanel } from "@/features/character-sheet/trackers-panel";
import { InstrumentsPanel } from "@/features/character-sheet/instruments-panel";
import { useRollController } from "@/features/character-sheet/use-roll-controller";
import {
  canSpiritDieMeetInvestment,
  getDieMaximum,
  getSpiritDiceForLevel,
  normalizeSpiritDieSlots,
  restoreSpiritDieSlot,
  type DieSize,
  type SpiritDieSlot,
} from "@shared/spirit-dice";
import type { Character, SpiritDiePool, Technique, Tracker } from "@shared/schema";
import { groupTechniqueFamilies } from "@shared/technique-variants";

interface CharacterSheetProps {
  character: Character;
  onReturnToMenu: () => void;
}

export default function CharacterSheet({ character, onReturnToMenu }: CharacterSheetProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedDieIndex, setSelectedDieIndex] = useState<number | null>(null);
  const [editingTechnique, setEditingTechnique] = useState<Technique | null>(null);
  const [isTechniqueEditorOpen, setTechniqueEditorOpen] = useState(false);
  const [isOverrideOpen, setOverrideOpen] = useState(false);
  const [isLevelEditorOpen, setLevelEditorOpen] = useState(false);
  const [isGlossaryOpen, setGlossaryOpen] = useState(false);
  const [isTrackerDialogOpen, setTrackerDialogOpen] = useState(false);
  const [isManualTracking, setManualTracking] = useState(false);
  const { lastRollBroadcast } = useWebSocket();

  const spiritDiceQuery = useQuery<SpiritDiePool>({
    queryKey: characterKeys.spiritDice(character.id),
  });
  const techniquesQuery = useQuery<Technique[]>({
    queryKey: characterKeys.techniques(character.id),
  });
  const trackersQuery = useQuery<Tracker[]>({
    queryKey: characterKeys.trackers(character.id),
  });

  const { updateCharacter, updateSpiritDiePool, deleteTechnique } = useCharacterState(character.id);
  const rollController = useRollController(character.id);
  const spiritDiePool = spiritDiceQuery.data;
  const techniques = techniquesQuery.data ?? [];
  const techniqueCount = useMemo(() => groupTechniqueFamilies(techniques).length, [techniques]);
  const trackers = trackersQuery.data ?? [];
  const selectedTechnique = techniques.find(
    (technique) => technique.id === rollController.selectedTechniqueId,
  );
  const selectedTechniqueEffect =
    selectedTechnique?.spEffects[String(rollController.selectedSp)];
  const selectedTechniqueName =
    selectedTechniqueEffect?.alternateName ?? selectedTechnique?.name ?? "Selected technique";

  const levelDice = useMemo(() => getSpiritDiceForLevel(character.level), [character.level]);
  const originalDice = useMemo(
    () => (spiritDiePool?.overrideDice ? [...spiritDiePool.overrideDice] : levelDice),
    [levelDice, spiritDiePool?.overrideDice],
  );
  const currentDice = useMemo(
    () => normalizeSpiritDieSlots(spiritDiePool?.currentDice ?? originalDice, originalDice.length),
    [originalDice, spiritDiePool?.currentDice],
  );
  const selectedDie =
    selectedDieIndex === null ? null : (currentDice[selectedDieIndex] ?? null);
  const selectedSpIsSupported = canSpiritDieMeetInvestment(
    selectedDie,
    rollController.selectedSp,
  );
  const isUsingOverride = spiritDiePool?.overrideDice != null;

  useEffect(() => {
    setSelectedDieIndex((currentIndex) => {
      if (currentIndex !== null && currentDice[currentIndex] !== null) {
        return currentIndex;
      }
      const firstAvailable = currentDice.findIndex((die) => die !== null);
      return firstAvailable >= 0 ? firstAvailable : null;
    });
  }, [currentDice]);

  const deleteTracker = useMutation({
    mutationFn: (trackerId: string) =>
      requestJson<{ success: boolean }>("DELETE", `/api/trackers/${trackerId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: characterKeys.trackers(character.id) });
      toast({ title: "Tracker deleted" });
    },
    onError: () => toast({ title: "Tracker deletion failed", variant: "destructive" }),
  });

  const saveCurrentDice = async (dice: SpiritDieSlot[]) => {
    await updateSpiritDiePool.mutateAsync({ currentDice: dice });
  };

  const handleDiceOverride = async (dice: DieSize[]) => {
    await updateSpiritDiePool.mutateAsync({ currentDice: dice, overrideDice: dice });
  };

  const handleResetToLevel = async () => {
    await updateSpiritDiePool.mutateAsync({ currentDice: levelDice, overrideDice: null });
  };

  const handleRestoreDie = async (index: number) => {
    await saveCurrentDice(restoreSpiritDieSlot(currentDice, originalDice, index));
  };

  const handleManualDieAdjust = async (index: number, value: DieSize) => {
    const updated = [...currentDice];
    updated[index] = value;
    await saveCurrentDice(updated);
  };

  const openTechniqueEditor = (technique: Technique | null) => {
    setEditingTechnique(technique);
    setTechniqueEditorOpen(true);
  };

  return (
    <div className="wuxia-shell min-h-screen">
      <div className="wuxia-orb wuxia-orb-left" aria-hidden="true" />
      <div className="wuxia-orb wuxia-orb-right" aria-hidden="true" />
      <CharacterSheetHeader
        character={character}
        onReturnToMenu={onReturnToMenu}
        onOpenGlossary={() => setGlossaryOpen(true)}
      />

      <main className="relative z-10 mx-auto w-full max-w-[96rem] px-3 pb-10 pt-4 sm:px-6 sm:pb-14 sm:pt-6 lg:px-8">
        <div className="character-manual">
          <CharacterSheetHero
            character={character}
            techniqueCount={techniqueCount}
            spiritDieCount={originalDice.length}
            onEditLevel={() => setLevelEditorOpen(true)}
            onLongRest={() => saveCurrentDice([...originalDice])}
            onSaveHighestAbilityScore={(score) =>
              updateCharacter.mutateAsync({ highestAbilityScore: score })
            }
          />

          <div className="grid grid-cols-1 items-start lg:grid-cols-[21rem_minmax(0,1fr)] xl:grid-cols-[23rem_minmax(0,1fr)]">
            <aside className="character-manual-rail min-w-0 px-4 py-6 sm:px-6 sm:py-7 xl:px-7 xl:py-8">
              <SpiritDiePoolComponent
                currentDice={currentDice}
                originalDice={originalDice}
                selectedDieIndex={selectedDieIndex}
                onDieSelect={setSelectedDieIndex}
                onDieRestore={handleRestoreDie}
                onRestoreAll={() => saveCurrentDice([...originalDice])}
                isUsingOverride={isUsingOverride}
                onOverride={() => setOverrideOpen(true)}
                onResetToLevel={handleResetToLevel}
                isRolling={rollController.isRolling}
                rollResult={rollController.result?.value ?? null}
                rollSuccess={rollController.result?.success}
                rollingDieIndex={selectedDieIndex}
                isManualTracking={isManualTracking}
                onManualTrackingToggle={() => setManualTracking((active) => !active)}
                onManualDieAdjust={handleManualDieAdjust}
              />

              {rollController.selectedTechniqueId &&
                rollController.selectedSp > 0 &&
                selectedDieIndex !== null && (
                  <div className="character-roll-action mt-6 border-t border-[#cdbfa7]/70 pt-5 dark:border-[#806b48]/55">
                    <div className="mb-4 text-center lg:text-left">
                      <p className="wuxia-kicker mb-1.5">Technique readied</p>
                      <p className="font-display text-xl leading-tight text-[#283f37] dark:text-[#eee3ce]">
                        {selectedTechniqueName}
                      </p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#5f665f] dark:text-[#aa9b80]">
                        {rollController.selectedSp} SP
                        {selectedDie ? ` · ${selectedDie.toUpperCase()} selected` : ""}
                      </p>
                    </div>
                    <Button
                      onClick={() => rollController.roll(selectedDieIndex, selectedDie)}
                      disabled={rollController.isRolling || !selectedSpIsSupported}
                      size="lg"
                      className="wuxia-primary-action h-12 w-full rounded-sm px-8 text-base font-bold uppercase tracking-[0.12em] disabled:opacity-50"
                    >
                      {rollController.isRolling ? "ROLLING…" : "ROLL"}
                    </Button>
                    {!selectedSpIsSupported && selectedDie && (
                      <p
                        className="text-center text-sm text-amber-700 dark:text-amber-300"
                        role="status"
                      >
                        {selectedDie.toUpperCase()} supports up to {getDieMaximum(selectedDie)} SP.
                        Select a larger Spirit Die for this technique.
                      </p>
                    )}
                  </div>
                )}

              <TrackersPanel
                trackers={trackers}
                onAdd={() => setTrackerDialogOpen(true)}
                onDelete={(trackerId) => deleteTracker.mutate(trackerId)}
              />
              <InstrumentsPanel character={character} />
            </aside>

            <TechniquesPanel
              techniques={techniques}
              isLoading={techniquesQuery.isLoading}
              selectedTechniqueId={rollController.selectedTechniqueId}
              selectedSp={rollController.selectedSp}
              selectedDie={selectedDie}
              onSelect={rollController.selectTechnique}
              onAdd={() => openTechniqueEditor(null)}
              onEdit={openTechniqueEditor}
              onDelete={(techniqueId) => deleteTechnique.mutate(techniqueId)}
            />
          </div>
        </div>

        <TechniqueEditor
          isOpen={isTechniqueEditorOpen}
          onClose={() => setTechniqueEditorOpen(false)}
          technique={editingTechnique}
          techniques={techniques}
          characterId={character.id}
        />
        <SpiritDieOverride
          isOpen={isOverrideOpen}
          onClose={() => setOverrideOpen(false)}
          currentDice={originalDice}
          onSave={handleDiceOverride}
        />
        <LevelEditor
          character={character}
          isOpen={isLevelEditorOpen}
          onClose={() => setLevelEditorOpen(false)}
        />
        <GlossaryDialog
          open={isGlossaryOpen}
          characterId={character.id}
          onClose={() => setGlossaryOpen(false)}
        />
        <TrackerDialog
          isOpen={isTrackerDialogOpen}
          onClose={() => setTrackerDialogOpen(false)}
          characterId={character.id}
        />
      </main>

      <SpiritRollNotification rollData={lastRollBroadcast} currentCharacterId={character.id} />
      <RollResultNotification
        result={rollController.result?.value ?? null}
        success={rollController.result?.success ?? false}
        isVisible={rollController.showResult}
      />
    </div>
  );
}
