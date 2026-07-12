import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dice5, Plus, Trash2 } from "lucide-react";
import {
  CampaignDialogBody,
  CampaignDialogContent,
  CampaignDialogFooter,
  CampaignDialogHeader,
} from "@/components/campaign-dialog";
import type { DieSize } from "@shared/schema";

interface SpiritDieOverrideProps {
  isOpen: boolean;
  onClose: () => void;
  currentDice: DieSize[];
  onSave: (dice: DieSize[]) => Promise<void>;
}

export default function SpiritDieOverride({ 
  isOpen, 
  onClose, 
  currentDice, 
  onSave 
}: SpiritDieOverrideProps) {
  const [overrideDice, setOverrideDice] = useState<DieSize[]>(currentDice);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setOverrideDice([...currentDice]);
    }
  }, [currentDice, isOpen]);

  const addDie = () => {
    setOverrideDice([...overrideDice, 'd4']);
  };

  const removeDie = (index: number) => {
    setOverrideDice(overrideDice.filter((_, i) => i !== index));
  };

  const updateDie = (index: number, size: DieSize) => {
    const newDice = [...overrideDice];
    newDice[index] = size;
    setOverrideDice(newDice);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(overrideDice);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <CampaignDialogContent className="sm:max-w-md">
        <CampaignDialogHeader
          icon={Dice5}
          eyebrow="Spirit dice"
          title="Manual Spirit Die Override"
          description="Configure your spirit dice manually instead of using the level-based calculation."
        />

        <CampaignDialogBody>
          <div className="space-y-3">
            {overrideDice.map((die, index) => (
              <div key={index} className="wuxia-dialog-section flex items-center gap-3 p-3">
                <span className="wuxia-dialog-label mb-0 w-12 shrink-0">Die {index + 1}</span>
                <Select value={die} onValueChange={(value: DieSize) => updateDie(index, value)}>
                  <SelectTrigger className="wuxia-dialog-control min-w-0 flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="wuxia-select-content">
                    <SelectItem value="d4">d4</SelectItem>
                    <SelectItem value="d6">d6</SelectItem>
                    <SelectItem value="d8">d8</SelectItem>
                    <SelectItem value="d10">d10</SelectItem>
                    <SelectItem value="d12">d12</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => removeDie(index)}
                  aria-label={`Remove die ${index + 1}`}
                  className="wuxia-danger-action h-9 w-9 shrink-0 p-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {overrideDice.length < 2 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addDie}
                className="wuxia-add-row w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Die
              </Button>
            )}
          </div>
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
            type="button"
            onClick={handleSave}
            disabled={isSaving || overrideDice.length === 0}
            className="wuxia-primary-action w-full sm:w-auto"
          >
            {isSaving ? "Applying…" : "Apply Override"}
          </Button>
        </CampaignDialogFooter>
      </CampaignDialogContent>
    </Dialog>
  );
}
