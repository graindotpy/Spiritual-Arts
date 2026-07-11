import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import TechniqueCard from "@/components/technique-card";
import { useTechniquePreferences } from "./use-technique-preferences";
import type { Technique } from "@shared/schema";
import type { SpiritDieSlot } from "@shared/spirit-dice";

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

  return (
    <section className="wuxia-sheet-panel p-5 sm:p-6 lg:col-span-2" aria-labelledby="techniques-heading">
      <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="wuxia-kicker mb-1.5">Cultivated arts</p>
          <h2 id="techniques-heading" className="font-display text-3xl text-[#20352e] dark:text-[#f1eadc]">
            Techniques
          </h2>
        </div>
        <Button onClick={onAdd} className="w-full rounded-full bg-spiritual-600 text-white hover:bg-spiritual-700 sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Add Technique
        </Button>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12" role="status">
            <span className="h-8 w-8 animate-spin rounded-full border-b-2 border-spiritual-600" />
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading techniques…</span>
          </div>
        ) : (
          techniques.map((technique) => (
            <TechniqueCard
              key={technique.id}
              technique={technique}
              isSelected={selectedTechniqueId === technique.id}
              selectedSP={selectedTechniqueId === technique.id ? selectedSp : undefined}
              selectedDie={selectedDie}
              isMinimized={preferences.isMinimized(technique.id)}
              onMinimizedChange={(isMinimized) =>
                preferences.setMinimized(technique.id, isMinimized)
              }
              onSelect={onSelect}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}

        {!isLoading && techniques.length === 0 && (
          <Card className="campaign-inner-surface border-0 shadow-none">
            <CardContent className="py-12 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                No techniques yet. Add one to get started.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </section>
  );
}
