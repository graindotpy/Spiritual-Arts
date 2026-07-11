import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manual Spirit Die Override</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Configure your spirit dice manually. This will override the level-based calculation.
          </p>
          
          <div className="space-y-3">
            {overrideDice.map((die, index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="text-sm font-medium w-12">Die {index + 1}</span>
                <Select value={die} onValueChange={(value: DieSize) => updateDie(index, value)}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="d4">d4</SelectItem>
                    <SelectItem value="d6">d6</SelectItem>
                    <SelectItem value="d8">d8</SelectItem>
                    <SelectItem value="d10">d10</SelectItem>
                    <SelectItem value="d12">d12</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeDie(index)}
                  aria-label={`Remove die ${index + 1}`}
                  className="text-red-600 hover:text-red-800 h-auto p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            
            {overrideDice.length < 2 && (
              <Button
                variant="outline"
                size="sm"
                onClick={addDie}
                className="w-full border-dashed"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Die
              </Button>
            )}
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || overrideDice.length === 0}
              className="bg-spiritual-600 hover:bg-spiritual-700"
            >
              {isSaving ? "Applying…" : "Apply Override"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
