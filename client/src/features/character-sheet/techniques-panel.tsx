import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { InstrumentActionCard } from "@/components/instrument-action-card";
import TechniqueCard from "@/components/technique-card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTechniquePreferences } from "./use-technique-preferences";
import type { SpiritualInstrumentWithAssignments, Technique } from "@shared/schema";
import type { SpiritDieSlot } from "@shared/spirit-dice";
import { groupTechniqueFamilies } from "@shared/technique-variants";

export type ActionListView = "techniques" | "instrument-actions";

interface TechniquesPanelProps {
  view: ActionListView;
  onViewChange: (view: ActionListView) => void;
  characterId: string;
  techniques: Technique[];
  isLoading: boolean;
  instruments: SpiritualInstrumentWithAssignments[];
  instrumentsLoading: boolean;
  instrumentsError: boolean;
  onRetryInstruments: () => void;
  onUseInstrumentAction: (instrumentId: string, actionId: string) => void;
  usingInstrumentAction: { instrumentId: string; actionId: string } | null;
  selectedTechniqueId: string | null;
  selectedSp: number;
  selectedDie: SpiritDieSlot;
  onSelect: (techniqueId: string, sp: number) => void;
  onAdd: () => void;
  onEdit: (technique: Technique) => void;
  onDelete: (techniqueId: string) => void;
}

export function TechniquesPanel({
  view,
  onViewChange,
  characterId,
  techniques,
  isLoading,
  instruments,
  instrumentsLoading,
  instrumentsError,
  onRetryInstruments,
  onUseInstrumentAction,
  usingInstrumentAction,
  selectedTechniqueId,
  selectedSp,
  selectedDie,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
}: TechniquesPanelProps) {
  const preferences = useTechniquePreferences();
  const families = useMemo(() => groupTechniqueFamilies(techniques), [techniques]);
  const [activeByFamily, setActiveByFamily] = useState<Record<string, string>>({});
  const instrumentGroups = useMemo(
    () => instruments.filter((instrument) => instrument.actions.length > 0),
    [instruments],
  );
  const instrumentActionCount = useMemo(
    () =>
      instrumentGroups.reduce(
        (count, instrument) => count + instrument.actions.length,
        0,
      ),
    [instrumentGroups],
  );
  const activeCount = view === "techniques" ? families.length : instrumentActionCount;
  const activeLoading = view === "techniques" ? isLoading : instrumentsLoading;
  const activeError = view === "instrument-actions" && instrumentsError;

  useEffect(() => {
    setActiveByFamily((current) => {
      const next: Record<string, string> = {};
      for (const family of families) {
        const selected = family.techniques.find(({ id }) => id === selectedTechniqueId);
        const remembered = family.techniques.find(({ id }) => id === current[family.key]);
        next[family.key] = (selected ?? remembered ?? family.techniques[0]).id;
      }
      const keys = Object.keys(next);
      if (
        keys.length === Object.keys(current).length &&
        keys.every((key) => current[key] === next[key])
      ) {
        return current;
      }
      return next;
    });
  }, [families, selectedTechniqueId]);

  return (
    <section
      className="character-techniques min-w-0 px-4 py-6 sm:px-6 sm:py-7 xl:px-8 xl:py-8"
      aria-labelledby="character-actions-heading"
    >
      <div className="mb-5 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="wuxia-kicker mb-1.5">
            {view === "techniques" ? "Path Manual" : "Spiritual Instruments"}
          </p>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id="character-actions-heading" className="sr-only">
              {view === "techniques" ? "Techniques" : "Instrument Actions"}
            </h2>
            <Select
              value={view}
              onValueChange={(value: ActionListView) => onViewChange(value)}
            >
              <SelectTrigger
                className="font-display h-auto w-auto min-w-[13rem] border-0 bg-transparent p-0 text-left text-3xl leading-none text-[#20352e] shadow-none focus:ring-1 focus:ring-[#8d6b40] sm:text-4xl dark:text-[#f1eadc] [&>svg]:ml-2 [&>svg]:h-5 [&>svg]:w-5 [&>svg]:text-[#8e7958] [&>span]:line-clamp-none"
                aria-label="Choose the character action list"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="wuxia-select-content">
                <SelectItem value="techniques">Techniques</SelectItem>
                <SelectItem value="instrument-actions">Instrument Actions</SelectItem>
              </SelectContent>
            </Select>
            {!activeLoading && !activeError && (
              <span className="text-xs font-semibold uppercase tracking-[0.13em] text-[#5f665f] dark:text-[#a99c83]">
                {activeCount} {activeCount === 1 ? "entry" : "entries"}
              </span>
            )}
          </div>
        </div>
        {view === "techniques" ? (
          <Button
            onClick={onAdd}
            className="wuxia-primary-action h-10 w-full rounded-sm px-4 sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Technique
          </Button>
        ) : null}
      </div>

      <div className="character-technique-list border-t border-[#cdbfa7]/75 dark:border-[#806b48]/55">
        {activeError ? (
          <div className="border-b border-[#cdbfa7]/75 py-14 text-center dark:border-[#806b48]/55" role="alert">
            <p className="font-display text-xl text-[#495c53] dark:text-[#cdbb98]">
              Instrument actions could not be loaded.
            </p>
            <Button
              type="button"
              variant="outline"
              className="wuxia-secondary-action mt-4"
              onClick={onRetryInstruments}
            >
              Try again
            </Button>
          </div>
        ) : activeLoading ? (
          <div className="flex items-center justify-center py-12" role="status">
            <span className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#6a7f70] dark:border-[#b1915e]" />
            <span className="ml-3 text-[#676b65] dark:text-[#aa9c83]">
              {view === "techniques"
                ? "Loading techniques…"
                : "Loading instrument actions…"}
            </span>
          </div>
        ) : view === "techniques" ? (
          families.map((family) => {
            const technique =
              family.techniques.find(({ id }) => id === activeByFamily[family.key]) ??
              family.techniques[0];
            const selectedInFamily = family.techniques.some(
              ({ id }) => id === selectedTechniqueId,
            );
            return (
              <TechniqueCard
                key={family.key}
                technique={technique}
                variants={family.techniques}
                familyName={family.baseName}
                isSelected={selectedTechniqueId === technique.id}
                selectedSP={selectedTechniqueId === technique.id ? selectedSp : undefined}
                selectedDie={selectedDie}
                isMinimized={preferences.isMinimized(family.techniques[0].id)}
                onMinimizedChange={(isMinimized) =>
                  preferences.setMinimized(family.techniques[0].id, isMinimized)
                }
                onSelect={onSelect}
                onEdit={onEdit}
                onDelete={(techniqueId) => {
                  if (techniqueId === selectedTechniqueId) {
                    const replacement = family.techniques.find(
                      ({ id }) => id !== techniqueId,
                    );
                    if (replacement) {
                      const options = Object.keys(replacement.spEffects)
                        .map(Number)
                        .sort((a, b) => a - b);
                      onSelect(
                        replacement.id,
                        options.includes(selectedSp) ? selectedSp : (options[0] ?? 0),
                      );
                    }
                  }
                  onDelete(techniqueId);
                }}
                onVariantChange={(variant) => {
                  setActiveByFamily((current) => ({
                    ...current,
                    [family.key]: variant.id,
                  }));
                  if (selectedInFamily) {
                    const options = Object.keys(variant.spEffects)
                      .map(Number)
                      .sort((a, b) => a - b);
                    onSelect(
                      variant.id,
                      options.includes(selectedSp) ? selectedSp : (options[0] ?? 0),
                    );
                  }
                }}
              />
            );
          })
        ) : (
          instrumentGroups.map((instrument) => (
            <section
              key={instrument.id}
              aria-labelledby={`instrument-actions-${instrument.id}`}
            >
              <div className="border-b border-[#cdbfa7]/75 bg-[#efe8d9]/45 px-5 py-3 sm:px-6 dark:border-[#806b48]/55 dark:bg-[#493a25]/20">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3
                    id={`instrument-actions-${instrument.id}`}
                    className="font-display text-lg text-[#314a41] dark:text-[#e4d6bc]"
                  >
                    {instrument.name}
                  </h3>
                  <span className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[#6a6d66] dark:text-[#a99c83]">
                    {instrument.actions.length}{" "}
                    {instrument.actions.length === 1 ? "action" : "actions"}
                  </span>
                </div>
              </div>
              {instrument.actions.map((action) => (
                <InstrumentActionCard
                  key={action.id}
                  action={action}
                  characterId={characterId}
                  instrumentName={instrument.name}
                  onUse={() => onUseInstrumentAction(instrument.id, action.id)}
                  isUsing={
                    usingInstrumentAction?.instrumentId === instrument.id &&
                    usingInstrumentAction.actionId === action.id
                  }
                  useDisabled={usingInstrumentAction !== null}
                />
              ))}
            </section>
          ))
        )}

        {view === "techniques" && !isLoading && techniques.length === 0 && (
          <div className="border-b border-[#cdbfa7]/75 py-14 text-center dark:border-[#806b48]/55">
            <p className="font-display text-xl text-[#495c53] dark:text-[#cdbb98]">
              This manual has no techniques yet.
            </p>
            <p className="mt-2 text-sm text-[#5f665f] dark:text-[#9f927b]">
              Add the first technique to begin writing the path.
            </p>
          </div>
        )}
        {view === "instrument-actions" &&
          !instrumentsLoading &&
          !instrumentsError &&
          instrumentActionCount === 0 && (
            <div className="border-b border-[#cdbfa7]/75 py-14 text-center dark:border-[#806b48]/55">
              <p className="font-display text-xl text-[#495c53] dark:text-[#cdbb98]">
                This character has no instrument actions yet.
              </p>
              <p className="mt-2 text-sm text-[#5f665f] dark:text-[#9f927b]">
                Actions appear here when they are added to an assigned Spiritual Instrument.
              </p>
            </div>
          )}
      </div>
    </section>
  );
}
