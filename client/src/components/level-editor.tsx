import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, Save, X } from "lucide-react";
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Update Character Level
          </DialogTitle>
          <DialogDescription>
            Change {character.name}'s level (1-20)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Level Display */}
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Current Level</p>
            <p className="text-2xl font-bold text-spiritual-600 dark:text-spiritual-400">
              {character.level}
            </p>
          </div>

          {/* Level Input */}
          <div className="space-y-2">
            <Label htmlFor="level">New Level</Label>
            <Input
              id="level"
              type="number"
              min="1"
              max="20"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              placeholder="Enter level (1-20)"
              disabled={isSaving}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 bg-spiritual-600 hover:bg-spiritual-700"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save Level"}
            </Button>
            <Button
              onClick={handleClose}
              variant="outline"
              disabled={isSaving}
              className="flex-1"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
