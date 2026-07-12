import { useState, useEffect, useMemo } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Maximize2, Minimize2, Plus, ScrollText, Trash2 } from "lucide-react";
import {
  CampaignDialogBody,
  CampaignDialogContent,
  CampaignDialogFooter,
  CampaignDialogHeader,
} from "@/components/campaign-dialog";
import { useCharacterState } from "@/hooks/use-character-state";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { richTextContentToPlainText } from "@shared/enhanced-content";
import type { InsertTechnique, Technique, SPEffect, TriggerType } from "@shared/schema";
import { getTechniqueVariantLabel, splitTechniqueName, techniqueFamilyKey } from "@shared/technique-variants";

interface TechniqueEditorProps {
  technique: Technique | null;
  techniques: Technique[];
  isOpen: boolean;
  onClose: () => void;
  characterId: string;
}



interface SPEffectEntry {
  sp: number;
  effect: string;
  actionType: TriggerType;
  enabled: boolean;
  alternateName?: string;
}

export default function TechniqueEditor({ 
  technique, 
  techniques,
  isOpen, 
  onClose, 
  characterId 
}: TechniqueEditorProps) {
  const [name, setName] = useState("");
  const [triggerDescription, setTriggerDescription] = useState("");

  const [spEffects, setSPEffects] = useState<SPEffectEntry[]>([]);
  const [currentTechnique, setCurrentTechnique] = useState<Technique | null>(technique);
  const [isCreatingVariant, setIsCreatingVariant] = useState(false);
  const [variantName, setVariantName] = useState("");
  const [expandedEditor, setExpandedEditor] = useState<string | null>(null);

  const { createTechnique, updateTechnique } = useCharacterState(characterId);
  const { toast } = useToast();

  const family = useMemo(() => {
    if (!currentTechnique) return [];
    const key = techniqueFamilyKey(currentTechnique.name);
    return techniques.filter((candidate) => techniqueFamilyKey(candidate.name) === key);
  }, [currentTechnique, techniques]);

  // Initialize form when technique changes
  useEffect(() => {
    setExpandedEditor(null);
    if (currentTechnique) {
      setName(currentTechnique.name);
      setTriggerDescription(currentTechnique.triggerDescription);

      
      const effects = currentTechnique.spEffects as SPEffect;
      const entries: SPEffectEntry[] = Object.entries(effects).map(([sp, effectData]) => ({
        sp: parseInt(sp),
        effect: effectData.effect,
        actionType: effectData.actionType,
        enabled: true,
        alternateName: effectData.alternateName || ""
      }));
      setSPEffects(entries.sort((a, b) => a.sp - b.sp));
    } else {
      // Reset form for new technique
      setName("");
      setTriggerDescription("");
      setSPEffects([{ sp: 1, effect: "", actionType: "action", enabled: true, alternateName: "" }]);
    }
  }, [isOpen, currentTechnique]);

  useEffect(() => {
    if (!isOpen) return;
    setCurrentTechnique(technique);
    setIsCreatingVariant(false);
    setVariantName("");
    setExpandedEditor(null);
  }, [isOpen, technique]);

  const handleAddSPLevel = () => {
    const maxSP = spEffects.length > 0 ? Math.max(...spEffects.map(e => e.sp)) : 0;
    setSPEffects([...spEffects, { sp: maxSP + 1, effect: "", actionType: "action", enabled: true, alternateName: "" }]);
  };

  const handleRemoveSPLevel = (index: number) => {
    setSPEffects(spEffects.filter((_, i) => i !== index));
    setExpandedEditor(null);
  };

  const handleSPEffectChange = <K extends keyof SPEffectEntry>(
    index: number,
    field: K,
    value: SPEffectEntry[K],
  ) => {
    const updated = [...spEffects];
    updated[index] = { ...updated[index], [field]: value };
    setSPEffects(updated);
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!richTextContentToPlainText(triggerDescription).trim()) {
      toast({
        title: "Add a trigger description",
        description: "Describe when this technique can be used.",
        variant: "destructive",
      });
      return;
    }

    const enabledEntries = spEffects.filter(
      (entry) => entry.enabled && richTextContentToPlainText(entry.effect).trim(),
    );
    if (enabledEntries.length === 0) {
      toast({
        title: "Add an SP effect",
        description: "A technique needs at least one enabled investment level.",
        variant: "destructive",
      });
      return;
    }
    if (new Set(enabledEntries.map((entry) => entry.sp)).size !== enabledEntries.length) {
      toast({
        title: "Duplicate SP levels",
        description: "Each investment level must use a different SP value.",
        variant: "destructive",
      });
      return;
    }
    
    const spEffectsObj: SPEffect = {};
    enabledEntries.forEach(entry => {
        spEffectsObj[entry.sp] = {
          effect: entry.effect,
          actionType: entry.actionType,
          alternateName: entry.alternateName?.trim() || undefined
        };
      });

    const trimmedVariantName = variantName.trim();
    const baseName = splitTechniqueName(currentTechnique?.name ?? name).baseName;
    if (isCreatingVariant && !trimmedVariantName) {
      toast({
        title: "Name the variant",
        description: "Enter the value that will appear after the technique name.",
        variant: "destructive",
      });
      return;
    }
    if (
      isCreatingVariant &&
      family.some(
        (candidate) =>
          getTechniqueVariantLabel(candidate).toLocaleLowerCase() ===
          trimmedVariantName.toLocaleLowerCase(),
      )
    ) {
      toast({ title: "Variant already exists", variant: "destructive" });
      return;
    }

    const techniqueData: Omit<InsertTechnique, "characterId"> = {
      name: isCreatingVariant ? `${baseName}: ${trimmedVariantName}` : name.trim(),
      triggerDescription,
      spEffects: spEffectsObj
    };

    try {
      if (currentTechnique && !isCreatingVariant) {
        await updateTechnique.mutateAsync({ id: currentTechnique.id, ...techniqueData });
      } else {
        await createTechnique.mutateAsync(techniqueData);
      }
      onClose();
    } catch (error) {
      console.error("Failed to save technique:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <CampaignDialogContent className={expandedEditor ? "max-w-6xl" : "max-w-5xl"}>
        <CampaignDialogHeader
          icon={ScrollText}
          eyebrow="Path manual"
          title={technique ? "Edit technique" : "Add new technique"}
          description={
            technique
              ? "Refine the technique and its Spirit Point investment effects."
              : "Record a technique, its trigger, and the effects unlocked at each Spirit Point tier."
          }
        />

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <CampaignDialogBody className="space-y-6">
            {currentTechnique && (
              <section className="wuxia-dialog-section space-y-4 p-4 sm:p-5" aria-label="Technique variants">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <Label htmlFor="variant-selector" className="wuxia-dialog-label">
                      Variant to edit
                    </Label>
                    <Select
                      value={currentTechnique.id}
                      onValueChange={(id) => {
                        const selected = techniques.find((candidate) => candidate.id === id);
                        if (selected) {
                          setCurrentTechnique(selected);
                          setIsCreatingVariant(false);
                          setVariantName("");
                        }
                      }}
                      disabled={isCreatingVariant}
                    >
                      <SelectTrigger id="variant-selector" className="wuxia-dialog-control w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="wuxia-select-content">
                        {family.map((candidate) => (
                          <SelectItem key={candidate.id} value={candidate.id}>
                            {getTechniqueVariantLabel(candidate)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="wuxia-secondary-action"
                    onClick={() => {
                      setIsCreatingVariant(true);
                      setVariantName("");
                    }}
                    disabled={isCreatingVariant}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create variant
                  </Button>
                </div>
                {isCreatingVariant && (
                  <div>
                    <Label htmlFor="variant-name" className="wuxia-dialog-label">
                      Variant name
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 text-sm font-semibold text-[#526159] dark:text-[#c8b99d]">
                        {splitTechniqueName(currentTechnique.name).baseName}:
                      </span>
                      <Input
                        id="variant-name"
                        value={variantName}
                        onChange={(event) => setVariantName(event.target.value)}
                        placeholder="Variant name"
                        className="wuxia-dialog-control"
                        required
                        autoFocus
                        maxLength={Math.max(1, 253 - splitTechniqueName(currentTechnique.name).baseName.length)}
                      />
                    </div>
                    <button
                      type="button"
                      className="mt-2 text-xs font-semibold text-[#6a5144] underline-offset-2 hover:underline dark:text-[#c5a982]"
                      onClick={() => setIsCreatingVariant(false)}
                    >
                      Cancel new variant
                    </button>
                  </div>
                )}
              </section>
            )}

            <div>
              <Label htmlFor="name" className="wuxia-dialog-label">
                Technique name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter technique name"
                className="wuxia-dialog-control"
                required
                disabled={isCreatingVariant}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <Label className="wuxia-dialog-label mb-0">
                  Trigger description
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="wuxia-secondary-action h-8"
                  onClick={() =>
                    setExpandedEditor((current) => current === "trigger" ? null : "trigger")
                  }
                  aria-expanded={expandedEditor === "trigger"}
                >
                  {expandedEditor === "trigger" ? (
                    <Minimize2 className="mr-1.5 h-3.5 w-3.5" />
                  ) : (
                    <Maximize2 className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {expandedEditor === "trigger" ? "Collapse" : "Expand"}
                </Button>
              </div>
              <Textarea
                value={richTextContentToPlainText(triggerDescription)}
                onChange={(event) => setTriggerDescription(event.target.value)}
                label="Trigger description"
                placeholder="Describe when this technique can be used"
                aria-label="Trigger description"
                rows={6}
                className="wuxia-dialog-control min-h-32"
              />
            </div>

            <section aria-labelledby="investment-effects-heading">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="wuxia-dialog-kicker">Spirit Point tiers</p>
                  <h3
                    id="investment-effects-heading"
                    className="font-display text-xl text-[#2b4138] dark:text-[#eadcc2]"
                  >
                    Investment effects
                  </h3>
                </div>
                <span className="rounded-sm border border-[#b9aa8f] bg-[#fffaf0]/45 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-[#667069] dark:border-[#806b48] dark:bg-[#4d3e29]/25 dark:text-[#c5b18d]">
                  {spEffects.length} {spEffects.length === 1 ? "tier" : "tiers"}
                </span>
              </div>

              <div className="space-y-4">
                {spEffects.map((entry, index) => {
                  const enabledId = `investment-enabled-${index}`;
                  const alternateNameId = `investment-name-${index}`;
                  const actionTypeId = `investment-action-${index}`;

                  return (
                    <div
                      key={index}
                      className="wuxia-dialog-section p-4 sm:p-5"
                    >
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex h-9 items-center rounded-sm border border-[#aa9878] bg-[#eee5d2]/75 px-2 text-sm font-semibold text-[#43564d] dark:border-[#8d744b] dark:bg-[#493a25]/60 dark:text-[#ddc99f]">
                            <Input
                              type="number"
                              value={entry.sp}
                              onChange={(event) =>
                                handleSPEffectChange(
                                  index,
                                  "sp",
                                  parseInt(event.target.value, 10) || 1,
                                )
                              }
                              className="h-7 w-12 border-0 bg-transparent p-0 text-center text-sm font-bold shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                              min="1"
                              aria-label={`Spirit Point value for tier ${index + 1}`}
                            />
                            <span className="ml-1">SP</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={enabledId}
                              className="wuxia-checkbox"
                              checked={entry.enabled}
                              onCheckedChange={(checked) =>
                                handleSPEffectChange(index, "enabled", checked === true)
                              }
                            />
                            <Label htmlFor={enabledId} className="text-sm text-[#526159] dark:text-[#c8b99d]">
                              Enable this tier
                            </Label>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveSPLevel(index)}
                          className="wuxia-icon-action wuxia-icon-danger h-9 w-9 self-end sm:self-auto"
                          aria-label={`Remove ${entry.sp} SP investment tier`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <Label htmlFor={alternateNameId} className="wuxia-dialog-label">
                            Alternate name <span className="normal-case tracking-normal">(optional)</span>
                          </Label>
                          <Input
                            id={alternateNameId}
                            value={entry.alternateName || ""}
                            onChange={(event) =>
                              handleSPEffectChange(index, "alternateName", event.target.value)
                            }
                            placeholder="Name for this tier"
                            className="wuxia-dialog-control"
                            disabled={!entry.enabled}
                          />
                        </div>
                        <div>
                          <Label htmlFor={actionTypeId} className="wuxia-dialog-label">
                            Action type
                          </Label>
                          <Select
                            value={entry.actionType}
                            onValueChange={(value: TriggerType) =>
                              handleSPEffectChange(index, "actionType", value)
                            }
                            disabled={!entry.enabled}
                          >
                            <SelectTrigger id={actionTypeId} className="wuxia-dialog-control w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="wuxia-select-content">
                              <SelectItem value="action">Action</SelectItem>
                              <SelectItem value="bonus">Bonus Action</SelectItem>
                              <SelectItem value="reaction">Reaction</SelectItem>
                              <SelectItem value="passive">Passive</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="sm:col-span-2">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <Label className="wuxia-dialog-label mb-0">
                              Effect
                            </Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="wuxia-secondary-action h-8"
                              onClick={() => {
                                const editorKey = `effect-${index}`;
                                setExpandedEditor((current) => current === editorKey ? null : editorKey);
                              }}
                              disabled={!entry.enabled}
                              aria-expanded={expandedEditor === `effect-${index}`}
                            >
                              {expandedEditor === `effect-${index}` ? (
                                <Minimize2 className="mr-1.5 h-3.5 w-3.5" />
                              ) : (
                                <Maximize2 className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              {expandedEditor === `effect-${index}` ? "Collapse" : "Expand"}
                            </Button>
                          </div>
                          <Textarea
                            value={richTextContentToPlainText(entry.effect)}
                            onChange={(event) =>
                              handleSPEffectChange(index, "effect", event.target.value)
                            }
                            aria-label={`Effect for ${entry.sp} SP investment`}
                            placeholder="Describe the effect at this SP tier"
                            rows={6}
                            className="wuxia-dialog-control min-h-32"
                            disabled={!entry.enabled}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddSPLevel}
                  className="wuxia-add-row h-11 w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add SP investment tier
                </Button>
              </div>
            </section>
          </CampaignDialogBody>

          <CampaignDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="wuxia-secondary-action w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="wuxia-primary-action w-full sm:w-auto"
              disabled={createTechnique.isPending || updateTechnique.isPending}
            >
              {currentTechnique && !isCreatingVariant
                ? updateTechnique.isPending
                  ? "Updating…"
                  : "Update technique"
                : createTechnique.isPending
                  ? "Creating…"
                  : isCreatingVariant
                    ? "Create variant"
                    : "Create technique"}
            </Button>
          </CampaignDialogFooter>
        </form>
      </CampaignDialogContent>
    </Dialog>
  );
}
