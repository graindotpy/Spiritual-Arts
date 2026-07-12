import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import TechniqueCard from "@/components/technique-card";
import { useTechniquePreferences } from "./use-technique-preferences";
import type { Technique } from "@shared/schema";
import type { SpiritDieSlot } from "@shared/spirit-dice";
import { groupTechniqueFamilies } from "@shared/technique-variants";

interface TechniquesPanelProps {
  techniques: Technique[];
  isLoading: boolean;
  selectedTechniqueId: string | null;
  selectedSp: number;
  selectedDie: SpiritDieSlot;
  onSelect: (techniqueId: string, sp: number) => void;
  onAdd: () => void;
  onEdit: (technique: Technique) => void;
  onDelete: (techniqueId: string) => void;
}

export function TechniquesPanel({
  techniques,
  isLoading,
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
    <section className="character-techniques min-w-0 px-4 py-6 sm:px-6 sm:py-7 xl:px-8 xl:py-8" aria-labelledby="techniques-heading">
      <div className="mb-5 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="wuxia-kicker mb-1.5">Path Manual</p>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id="techniques-heading" className="font-display text-3xl text-[#20352e] sm:text-4xl dark:text-[#f1eadc]">
              Techniques
            </h2>
            {!isLoading && (
              <span className="text-xs font-semibold uppercase tracking-[0.13em] text-[#5f665f] dark:text-[#a99c83]">
                {families.length} {families.length === 1 ? "entry" : "entries"}
              </span>
            )}
          </div>
        </div>
        <Button onClick={onAdd} className="wuxia-primary-action h-10 w-full rounded-sm px-4 sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Add Technique
        </Button>
      </div>

      <div className="character-technique-list border-t border-[#cdbfa7]/75 dark:border-[#806b48]/55">
        {isLoading ? (
          <div className="flex items-center justify-center py-12" role="status">
            <span className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#6a7f70] dark:border-[#b1915e]" />
            <span className="ml-3 text-[#676b65] dark:text-[#aa9c83]">Loading techniques…</span>
          </div>
        ) : (
          families.map((family) => {
            const technique =
              family.techniques.find(({ id }) => id === activeByFamily[family.key]) ??
              family.techniques[0];
            const selectedInFamily = family.techniques.some(({ id }) => id === selectedTechniqueId);
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
                  const replacement = family.techniques.find(({ id }) => id !== techniqueId);
                  if (replacement) {
                    const options = Object.keys(replacement.spEffects).map(Number).sort((a, b) => a - b);
                    onSelect(
                      replacement.id,
                      options.includes(selectedSp) ? selectedSp : (options[0] ?? 0),
                    );
                  }
                }
                onDelete(techniqueId);
              }}
              onVariantChange={(variant) => {
                setActiveByFamily((current) => ({ ...current, [family.key]: variant.id }));
                if (selectedInFamily) {
                  const options = Object.keys(variant.spEffects).map(Number).sort((a, b) => a - b);
                  onSelect(variant.id, options.includes(selectedSp) ? selectedSp : (options[0] ?? 0));
                }
              }}
            />
            );
          })
        )}

        {!isLoading && techniques.length === 0 && (
          <div className="border-b border-[#cdbfa7]/75 py-14 text-center dark:border-[#806b48]/55">
            <p className="font-display text-xl text-[#495c53] dark:text-[#cdbb98]">
              This manual has no techniques yet.
            </p>
            <p className="mt-2 text-sm text-[#5f665f] dark:text-[#9f927b]">
              Add the first technique to begin writing the path.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
