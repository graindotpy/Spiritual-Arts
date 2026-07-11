import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2 } from "lucide-react";
import { useCharacterState } from "@/hooks/use-character-state";
import { useToast } from "@/hooks/use-toast";
import type { InsertTechnique, Technique, SPEffect, TriggerType } from "@shared/schema";

interface TechniqueEditorProps {
  technique: Technique | null;
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
  isOpen, 
  onClose, 
  characterId 
}: TechniqueEditorProps) {
  const [name, setName] = useState("");
  const [triggerDescription, setTriggerDescription] = useState("");

  const [spEffects, setSPEffects] = useState<SPEffectEntry[]>([]);

  const { createTechnique, updateTechnique } = useCharacterState(characterId);
  const { toast } = useToast();

  // Initialize form when technique changes
  useEffect(() => {
    if (technique) {
      setName(technique.name);
      setTriggerDescription(technique.triggerDescription);

      
      const effects = technique.spEffects as SPEffect;
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
  }, [isOpen, technique]);

  const handleAddSPLevel = () => {
    const maxSP = spEffects.length > 0 ? Math.max(...spEffects.map(e => e.sp)) : 0;
    setSPEffects([...spEffects, { sp: maxSP + 1, effect: "", actionType: "action", enabled: true, alternateName: "" }]);
  };

  const handleRemoveSPLevel = (index: number) => {
    setSPEffects(spEffects.filter((_, i) => i !== index));
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

    const enabledEntries = spEffects.filter((entry) => entry.enabled && entry.effect.trim());
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

    const techniqueData: Omit<InsertTechnique, "characterId"> = {
      name: name.trim(),
      triggerDescription: triggerDescription.trim(),
      spEffects: spEffectsObj
    };

    try {
      if (technique) {
        await updateTechnique.mutateAsync({ id: technique.id, ...techniqueData });
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[var(--dialog-background)] text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600">
        <DialogHeader>
          <DialogTitle>
            {technique ? "Edit Technique" : "Add New Technique"}
          </DialogTitle>
          <DialogDescription>
            {technique ? "Modify technique details and SP investment effects" : "Create a new technique with customizable SP investment levels"}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="name">Technique Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter technique name"
              className="bg-white dark:bg-[var(--dialog-input)] border-gray-300 dark:border-[var(--dialog-input-border)] text-gray-900 dark:text-gray-100"
              required
            />
          </div>
          
          {/* Trigger type is now defined at SP level */}
          
          <div>
            <Label htmlFor="triggerDescription">Trigger Description</Label>
            <Textarea
              id="triggerDescription"
              value={triggerDescription}
              onChange={(e) => setTriggerDescription(e.target.value)}
              placeholder="Describe when this technique can be used"
              className="bg-white dark:bg-[var(--dialog-input)] border-gray-300 dark:border-[var(--dialog-input-border)] text-gray-900 dark:text-gray-100"
              rows={2}
              required
            />
          </div>
          
          <div>
            <Label className="block mb-4">SP Investment Effects</Label>
            <div className="space-y-4">
              {spEffects.map((entry, index) => (
                <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-[var(--dialog-section)]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200 px-2 py-1 rounded text-sm font-medium flex items-center">
                        <Input
                          type="number"
                          value={entry.sp}
                          onChange={(e) => handleSPEffectChange(index, 'sp', parseInt(e.target.value) || 1)}
                          className="w-16 h-6 p-1 text-xs border-none bg-transparent text-gray-800 dark:text-gray-200"
                          min="1"
                        />
                        <span className="ml-1">SP</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={entry.enabled}
                          onCheckedChange={(checked) =>
                            handleSPEffectChange(index, "enabled", checked === true)
                          }
                        />
                        <Label className="text-sm text-gray-700 dark:text-gray-300">
                          Enable this investment level
                        </Label>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveSPLevel(index)}
                      className="text-red-600 hover:text-red-800 h-auto p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm text-gray-700 dark:text-gray-300">Alternate Name (optional)</Label>
                      <Input
                        value={entry.alternateName || ""}
                        onChange={(e) => handleSPEffectChange(index, 'alternateName', e.target.value)}
                        placeholder="Optional different name for this investment level"
                        className="bg-white dark:bg-[var(--dialog-input)] border-gray-300 dark:border-[var(--dialog-input-border)] text-gray-900 dark:text-gray-100"
                        disabled={!entry.enabled}
                      />
                    </div>
                    <div>
                      <Label className="text-sm text-gray-700 dark:text-gray-300">Action Type</Label>
                      <Select 
                        value={entry.actionType} 
                        onValueChange={(value: TriggerType) => handleSPEffectChange(index, 'actionType', value)}
                        disabled={!entry.enabled}
                      >
                        <SelectTrigger className="w-full bg-white dark:bg-[var(--dialog-input)] border-gray-300 dark:border-[var(--dialog-input-border)] text-gray-900 dark:text-gray-100">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="action">Action</SelectItem>
                          <SelectItem value="bonus">Bonus Action</SelectItem>
                          <SelectItem value="reaction">Reaction</SelectItem>
                          <SelectItem value="passive">Passive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Textarea
                      value={entry.effect}
                      onChange={(e) => handleSPEffectChange(index, 'effect', e.target.value)}
                      placeholder="Describe the effect at this SP level"
                      className="bg-white dark:bg-[var(--dialog-input)] border-gray-300 dark:border-[var(--dialog-input-border)] text-gray-900 dark:text-gray-100"
                      rows={2}
                      disabled={!entry.enabled}
                    />
                  </div>
                </div>
              ))}
              
              <Button
                type="button"
                variant="outline"
                onClick={handleAddSPLevel}
                className="w-full border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-spiritual-400 hover:text-spiritual-600 dark:hover:border-spiritual-500 dark:hover:text-spiritual-400"
              >
                <Plus className="w-5 h-5 mr-2" />
                Add SP Investment Level
              </Button>
            </div>
          </div>


          
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-600">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="bg-spiritual-600 hover:bg-spiritual-700"
              disabled={createTechnique.isPending || updateTechnique.isPending}
            >
              {technique ? "Update Technique" : "Create Technique"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
