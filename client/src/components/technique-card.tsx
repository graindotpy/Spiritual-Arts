import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Edit, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import TooltipText from "./tooltip-text";
import { characterGlossaryScope } from "@/hooks/use-glossary";
import type { SPEffect, Technique, TriggerType } from "@shared/schema";
import {
  canSpiritDieMeetInvestment,
  getDieMaximum,
  type SpiritDieSlot,
} from "@shared/spirit-dice";

interface TechniqueCardProps {
  technique: Technique;
  isSelected: boolean;
  selectedSP?: number;
  selectedDie: SpiritDieSlot;
  isMinimized: boolean;
  onMinimizedChange: (isMinimized: boolean) => void;
  onSelect: (techniqueId: string, sp: number) => void;
  onEdit: (technique: Technique) => void;
  onDelete?: (techniqueId: string) => void;
}

const TRIGGER_STYLES: Record<TriggerType, string> = {
  action: "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200",
  bonus: "bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200",
  reaction: "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200",
  passive: "bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-200",
};

const TRIGGER_LABELS: Record<TriggerType, string> = {
  action: "Action",
  bonus: "Bonus Action",
  reaction: "Reaction",
  passive: "Passive",
};

export default function TechniqueCard({
  technique,
  isSelected,
  selectedSP,
  selectedDie,
  isMinimized,
  onMinimizedChange,
  onSelect,
  onEdit,
  onDelete,
}: TechniqueCardProps) {
  const effects = technique.spEffects as SPEffect;
  const spOptions = useMemo(
    () => Object.keys(effects).map(Number).filter(Number.isFinite).sort((a, b) => a - b),
    [effects],
  );
  const [currentSp, setCurrentSp] = useState(() => selectedSP ?? spOptions[0] ?? 0);

  useEffect(() => {
    if (selectedSP && spOptions.includes(selectedSP)) {
      setCurrentSp(selectedSP);
      return;
    }
    if (!spOptions.includes(currentSp)) {
      setCurrentSp(spOptions[0] ?? 0);
    }
  }, [currentSp, selectedSP, spOptions]);

  const effect = effects[String(currentSp)];
  const selectSp = (sp: number) => {
    setCurrentSp(sp);
    onSelect(technique.id, sp);
  };

  const selectCurrentTechnique = () => {
    if (currentSp > 0) {
      onSelect(technique.id, currentSp);
    }
  };

  return (
    <Card
      role="group"
      tabIndex={0}
      aria-current={isSelected ? "true" : undefined}
      aria-label={`${technique.name}. Press Enter to select at ${currentSp} SP`}
      onClick={(event) => {
        const target = event.target;
        if (
          target instanceof Element &&
          target.closest("button, a, input, textarea, select, [contenteditable='true']")
        ) {
          return;
        }
        selectCurrentTechnique();
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectCurrentTechnique();
        }
      }}
      className={cn(
        "cursor-pointer border-2 p-4 text-gray-900 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-spiritual-500 focus-visible:ring-offset-2 dark:text-white",
        isSelected
          ? "scale-[1.01] border-spiritual-500 bg-spiritual-50 shadow-lg dark:bg-spiritual-900"
          : "border-gray-200 bg-white hover:border-spiritual-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-800",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {effect?.alternateName || technique.name}
            </h3>
            {effect && (
              <Badge className={TRIGGER_STYLES[effect.actionType]}>
                {TRIGGER_LABELS[effect.actionType]}
              </Badge>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="SP investment">
            {spOptions.map((sp) => {
              const isSupported = canSpiritDieMeetInvestment(selectedDie, sp);
              const unavailableReason = selectedDie
                ? `${selectedDie.toUpperCase()} supports techniques up to ${getDieMaximum(selectedDie)} SP`
                : "Select an available Spirit Die first";

              return (
                <Button
                  key={sp}
                  type="button"
                  size="sm"
                  variant={currentSp === sp ? "default" : "outline"}
                  onClick={() => selectSp(sp)}
                  disabled={!isSupported}
                  title={isSupported ? undefined : unavailableReason}
                  aria-pressed={isSelected && selectedSP === sp}
                  className={cn(currentSp === sp && "bg-spiritual-700 hover:bg-spiritual-800")}
                >
                  {sp} SP
                </Button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => onMinimizedChange(!isMinimized)}
            className="h-8 w-8 text-gray-500"
            aria-label={isMinimized ? "Expand technique" : "Collapse technique"}
          >
            {isMinimized ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => onEdit(technique)}
            className="h-8 w-8 text-gray-500"
            aria-label={`Edit ${technique.name}`}
          >
            <Edit className="h-4 w-4" />
          </Button>
          {onDelete && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => {
                if (confirm(`Are you sure you want to delete "${technique.name}"? This cannot be undone.`)) {
                  onDelete(technique.id);
                }
              }}
              className="h-8 w-8 text-gray-500 hover:text-red-600"
              aria-label={`Delete ${technique.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {!isMinimized && (
        <div className="mt-4 space-y-3">
          <TooltipText
            text={technique.triggerDescription}
            entityId={technique.characterId}
            scope={characterGlossaryScope}
            className="text-sm text-gray-600 dark:text-gray-300"
          />
          {effect && (
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700">
              <h4 className="mb-2 font-medium text-gray-900 dark:text-white">
                Effect ({currentSp} SP investment)
              </h4>
              <TooltipText
                text={effect.effect}
                entityId={technique.characterId}
                scope={characterGlossaryScope}
                className="text-sm text-gray-700 dark:text-gray-300"
              />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
