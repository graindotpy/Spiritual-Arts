import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CampaignDialogBody,
  CampaignDialogContent,
  CampaignDialogFooter,
  CampaignDialogHeader,
} from "@/components/campaign-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { requestJson } from "@/lib/api";
import { characterKeys } from "@/lib/query-keys";
import { useToast } from "@/hooks/use-toast";
import type { Character } from "@shared/schema";

interface CharacterCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onCharacterCreated: (character: Character) => void;
  createUrl?: string;
}

export default function CharacterCreator({ isOpen, onClose, onCharacterCreated, createUrl = "/api/character" }: CharacterCreatorProps) {
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [level, setLevel] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createCharacter = useMutation({
    mutationFn: (data: { name: string; path: string; level: number }) =>
      requestJson<Character>("POST", createUrl, data),
    onSuccess: (character) => {
      if (createUrl === "/api/character") {
        queryClient.setQueryData<Character[]>(characterKeys.all, (current = []) => [
          ...current,
          character,
        ]);
      }
      toast({
        title: "Success",
        description: "Character created successfully",
      });
      onCharacterCreated(character);
      handleClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create character",
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    setName("");
    setPath("");
    setLevel(1);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !path.trim()) {
      toast({
        title: "Error",
        description: "Name and path are required",
        variant: "destructive",
      });
      return;
    }
    
    createCharacter.mutate({
      name: name.trim(),
      path: path.trim(),
      level
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <CampaignDialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <CampaignDialogHeader
            icon={UserPlus}
            eyebrow="New hero"
            title="Create New Character"
            description="Set the foundations of your character before entering the campaign."
          />

          <CampaignDialogBody className="space-y-5">
            <div>
              <Label htmlFor="name" className="wuxia-dialog-label">
                Character Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter character name"
                className="wuxia-dialog-control"
                required
              />
            </div>

            <div>
              <Label htmlFor="path" className="wuxia-dialog-label">
                Spiritual Path
              </Label>
              <Input
                id="path"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="e.g., Path of Gluttony, Path of Wrath"
                className="wuxia-dialog-control"
                required
              />
            </div>

            <div>
              <Label htmlFor="level" className="wuxia-dialog-label">
                Starting Level
              </Label>
              <Select value={level.toString()} onValueChange={(value) => setLevel(parseInt(value))}>
                <SelectTrigger id="level" className="wuxia-dialog-control">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="wuxia-select-content">
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((levelOption) => (
                    <SelectItem key={levelOption} value={levelOption.toString()}>
                      Level {levelOption}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CampaignDialogBody>

          <CampaignDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createCharacter.isPending}
              className="wuxia-secondary-action w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createCharacter.isPending}
              className="wuxia-primary-action w-full sm:w-auto"
            >
              {createCharacter.isPending ? "Creating..." : "Create Character"}
            </Button>
          </CampaignDialogFooter>
        </form>
      </CampaignDialogContent>
    </Dialog>
  );
}
