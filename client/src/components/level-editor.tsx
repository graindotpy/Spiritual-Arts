import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, Save, X } from "lucide-react";
import {
  CampaignDialogBody,
  CampaignDialogContent,
  CampaignDialogFooter,
  CampaignDialogHeader,
} from "@/components/campaign-dialog";
import { useToast } from "@/hooks/use-toast";
import { useCharacterState } from "@/hooks/use-character-state";
import type { Character } from "@shared/schema";

interface LevelEditorProps {
  character: Character;
  isOpen: boolean;
  onClose: () => void;
}

export default function LevelEditor({ character, isOpen, onClose }: LevelEditorProps) {
  const [level, setLevel] = useState(character.level.toString());
  const { toast } = useToast();
  const { updateCharacterLevel } = useCharacterState(character.id);
  const isSaving = updateCharacterLevel.isPending;

  useEffect(() => {
    if (isOpen) {
      setLevel(character.level.toString());
    }
  }, [character.id, character.level, isOpen]);

  const handleSave = async () => {
    const newLevel = parseInt(level);
    
    // Validation
    if (isNaN(newLevel) || newLevel < 1 || newLevel > 20) {
      toast({
        title: "Invalid level",
        description: "Level must be a number between 1 and 20",
        variant: "destructive",
      });
      return;
    }

    if (newLevel === character.level) {
      onClose();
      return;
    }

    try {
      await updateCharacterLevel.mutateAsync({ level: newLevel });
      onClose();
    } catch {
      // The shared mutation reports the error consistently.
    }
  };

  const handleClose = () => {
    setLevel(character.level.toString());
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <CampaignDialogContent className="sm:max-w-md">
        <CampaignDialogHeader
          icon={TrendingUp}
          eyebrow="Character progress"
          title="Update Character Level"
          description={`Change ${character.name}'s level (1–20).`}
        />

        <CampaignDialogBody className="space-y-5">
          {/* Current Level Display */}
          <div className="wuxia-dialog-section wuxia-dialog-section-muted p-4 text-center">
            <p className="wuxia-dialog-label mb-1">Current Level</p>
            <p className="text-3xl font-semibold text-emerald-800 dark:text-amber-200">
              {character.level}
            </p>
          </div>

          {/* Level Input */}
          <div>
            <Label htmlFor="level" className="wuxia-dialog-label">New Level</Label>
            <Input
              id="level"
              type="number"
              min="1"
              max="20"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              placeholder="Enter level (1-20)"
              disabled={isSaving}
              className="wuxia-dialog-control"
            />
          </div>
        </CampaignDialogBody>

        <CampaignDialogFooter>
          <Button
            type="button"
            onClick={handleClose}
            variant="outline"
            disabled={isSaving}
            className="wuxia-secondary-action w-full sm:w-auto"
          >
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="wuxia-primary-action w-full sm:w-auto"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : "Save Level"}
          </Button>
        </CampaignDialogFooter>
      </CampaignDialogContent>
    </Dialog>
  );
}
