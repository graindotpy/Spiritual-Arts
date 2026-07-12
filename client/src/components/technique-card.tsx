import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Edit, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CampaignConfirmDialog } from "@/components/campaign-confirm-dialog";
import { cn } from "@/lib/utils";
import TooltipText from "./tooltip-text";
import { characterGlossaryScope } from "@/hooks/use-glossary";
import type { SPEffect, Technique, TriggerType } from "@shared/schema";
import {
  canSpiritDieMeetInvestment,
  getDieMaximum,
  type SpiritDieSlot,
} from "@shared/spirit-dice";
import { getTechniqueVariantLabel } from "@shared/technique-variants";
import {
  isSerializedRichTextContent,
  richTextContentToPlainText,
} from "@shared/enhanced-content";
import {
  RichTextContent,
  RichTextErrorBoundary,
} from "@/features/enhanced-content/rich-text";

interface TechniqueCardProps {
  technique: Technique;
  variants: Technique[];
  familyName: string;
  isSelected: boolean;
  selectedSP?: number;
  selectedDie: SpiritDieSlot;
  isMinimized: boolean;
  onMinimizedChange: (isMinimized: boolean) => void;
  onSelect: (techniqueId: string, sp: number) => void;
  onEdit: (technique: Technique) => void;
  onDelete?: (techniqueId: string) => void;
  onVariantChange: (technique: Technique) => void;
}

const TRIGGER_STYLES: Record<TriggerType, string> = {
  action: "border-[#829e74]/45 bg-[#dce6c9]/75 text-[#324a2d] dark:border-[#8d9c6b]/35 dark:bg-[#5b6640]/30 dark:text-[#d4ddb6]",
  bonus: "border-[#b79559]/45 bg-[#eee0bd]/75 text-[#654e26] dark:border-[#aa8a55]/35 dark:bg-[#755d34]/30 dark:text-[#e5cca0]",
  reaction: "border-[#b77b6f]/45 bg-[#eddbd4]/80 text-[#713b33] dark:border-[#a86359]/35 dark:bg-[#713b33]/30 dark:text-[#e4b6ad]",
  passive: "border-[#8c8271]/45 bg-[#e5dfd3]/80 text-[#514b43] dark:border-[#8c806a]/35 dark:bg-[#5b554a]/30 dark:text-[#d1c5af]",
};

const TRIGGER_LABELS: Record<TriggerType, string> = {
  action: "Action",
  bonus: "Bonus Action",
  reaction: "Reaction",
  passive: "Passive",
};

function TechniqueText({
  text,
  entityId,
  className,
}: {
  text: string;
  entityId: string;
  className: string;
}) {
  if (isSerializedRichTextContent(text)) {
    return (
      <RichTextErrorBoundary
        resetKey={`${entityId}:${text}`}
        fallback={
          <TooltipText
            text={richTextContentToPlainText(text)}
            entityId={entityId}
            scope={characterGlossaryScope}
            className={className}
          />
        }
      >
        <RichTextContent content={text} className={className} />
      </RichTextErrorBoundary>
    );
  }

  return (
    <TooltipText
      text={text}
      entityId={entityId}
      scope={characterGlossaryScope}
      className={className}
    />
  );
}

export default function TechniqueCard({
  technique,
  variants,
  familyName,
  isSelected,
  selectedSP,
  selectedDie,
  isMinimized,
  onMinimizedChange,
  onSelect,
  onEdit,
  onDelete,
  onVariantChange,
}: TechniqueCardProps) {
  const effects = technique.spEffects as SPEffect;
  const spOptions = useMemo(
    () => Object.keys(effects).map(Number).filter(Number.isFinite).sort((a, b) => a - b),
    [effects],
  );
  const [currentSp, setCurrentSp] = useState(() => selectedSP ?? spOptions[0] ?? 0);
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);

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
    <>
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
        "character-technique-entry cursor-pointer rounded-none border-0 bg-transparent px-5 py-5 text-[#2f3c37] shadow-none transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#668678] focus-visible:ring-inset sm:px-6 dark:text-[#e6dcc8]",
        isSelected
          ? "character-technique-entry-selected"
          : "character-technique-entry-idle",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-xl text-[#263a33] dark:text-[#eee7da]">
              {effect?.alternateName || familyName}
            </h3>
            {variants.length > 1 && (
              <Select
                value={technique.id}
                onValueChange={(id) => {
                  const variant = variants.find((candidate) => candidate.id === id);
                  if (variant) onVariantChange(variant);
                }}
              >
                <SelectTrigger
                  className="h-8 w-auto min-w-28 rounded-sm border-[#b9aa8f] bg-[#fffaf0]/45 px-2.5 text-sm font-semibold text-[#6a5144] dark:border-[#806b48] dark:bg-[#4d3e29]/25 dark:text-[#d8c69f]"
                  aria-label={`Select ${familyName} variant`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="wuxia-select-content">
                  {variants.map((variant) => (
                    <SelectItem key={variant.id} value={variant.id}>
                      {getTechniqueVariantLabel(variant)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {effect && (
              <Badge className={cn("rounded-sm border px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.08em] shadow-none", TRIGGER_STYLES[effect.actionType])}>
                {TRIGGER_LABELS[effect.actionType]}
              </Badge>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="SP investment">
            {spOptions.map((sp) => {
              const isSupported = canSpiritDieMeetInvestment(selectedDie, sp);
              const isActiveInvestment = isSelected && selectedSP === sp;
              const unavailableReason = selectedDie
                ? `${selectedDie.toUpperCase()} supports techniques up to ${getDieMaximum(selectedDie)} SP`
                : "Select an available Spirit Die first";

              return (
                <Button
                  key={sp}
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => selectSp(sp)}
                  disabled={!isSupported}
                  title={isSupported ? undefined : unavailableReason}
                  aria-pressed={isSelected && selectedSP === sp}
                  className={cn(
                    "h-8 rounded-sm px-3 text-xs font-semibold",
                    isActiveInvestment
                      ? "border-[#496c5e] bg-[#496c5e] text-white hover:bg-[#3c5c50] dark:border-[#a27a4c] dark:bg-[#7d382f] dark:hover:bg-[#93473a]"
                      : currentSp === sp
                        ? "border-[#9e8962] bg-[#eee5d2]/70 text-[#4e5c55] hover:border-[#668678] hover:bg-[#e5eadf] hover:text-[#31594d] dark:!border-[#8d744b] dark:!bg-[#433923] dark:!text-[#d8c69f] dark:hover:!border-[#a88957] dark:hover:!bg-[#514229] dark:hover:!text-[#ead9b6]"
                        : "border-[#b9aa8f] bg-transparent text-[#5b6861] hover:border-[#668678] hover:bg-[#edf0e8] hover:text-[#31594d] dark:border-[#806b48] dark:text-[#b9aa8c] dark:hover:border-[#a88957] dark:hover:bg-[#5c482b]/30 dark:hover:text-[#ead9b6]",
                  )}
                >
                  {sp} SP
                </Button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-1 self-end sm:self-auto">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => onMinimizedChange(!isMinimized)}
            className="wuxia-icon-action h-10 w-10 sm:h-8 sm:w-8"
            aria-label={isMinimized ? "Expand technique" : "Collapse technique"}
          >
            {isMinimized ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => onEdit(technique)}
            className="wuxia-icon-action h-10 w-10 sm:h-8 sm:w-8"
            aria-label={`Edit ${technique.name}`}
          >
            <Edit className="h-4 w-4" />
          </Button>
          {onDelete && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setDeleteConfirmationOpen(true)}
              className="wuxia-icon-action wuxia-icon-danger h-10 w-10 sm:h-8 sm:w-8"
              aria-label={`Delete ${technique.name}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {!isMinimized && (
        <div className="mt-4 space-y-4">
          <TechniqueText
            text={technique.triggerDescription}
            entityId={technique.characterId}
            className="technique-rich-text text-sm leading-6 text-[#626861] dark:text-[#b9ad96]"
          />
          {effect && (
            <div className="character-technique-effect border-l-2 border-[#9b4437]/70 py-1 pl-4 dark:border-[#b36d58]/70">
              <h4 className="mb-1.5 text-xs font-bold uppercase tracking-[0.1em] text-[#6a5144] dark:text-[#c5a982]">
                Effect ({currentSp} SP investment)
              </h4>
              <TechniqueText
                text={effect.effect}
                entityId={technique.characterId}
                className="technique-rich-text text-sm leading-6 text-[#454e49] dark:text-[#d2c6af]"
              />
            </div>
          )}
        </div>
      )}
      </Card>

      <CampaignConfirmDialog
        open={deleteConfirmationOpen}
        onOpenChange={setDeleteConfirmationOpen}
        title="Delete technique?"
        description={`Remove “${technique.name}” from this path manual?`}
        onConfirm={() => {
          onDelete?.(technique.id);
          setDeleteConfirmationOpen(false);
        }}
      />
    </>
  );
}
