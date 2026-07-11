import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
      <DialogContent className="sm:max-w-md bg-white dark:bg-[var(--dialog-bg)] border-gray-200 dark:border-[var(--dialog-border)]">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-white">Create New Character</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name" className="text-gray-700 dark:text-gray-300">
              Character Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter character name"
              className="bg-white dark:bg-[var(--dialog-input)] border-gray-300 dark:border-[var(--dialog-input-border)]"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="path" className="text-gray-700 dark:text-gray-300">
              Spiritual Path
            </Label>
            <Input
              id="path"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="e.g., Path of Gluttony, Path of Wrath"
              className="bg-white dark:bg-[var(--dialog-input)] border-gray-300 dark:border-[var(--dialog-input-border)]"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="level" className="text-gray-700 dark:text-gray-300">
              Starting Level
            </Label>
            <Select value={level.toString()} onValueChange={(value) => setLevel(parseInt(value))}>
              <SelectTrigger id="level" className="bg-white dark:bg-[var(--dialog-input)] border-gray-300 dark:border-[var(--dialog-input-border)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 20 }, (_, i) => i + 1).map((levelOption) => (
                  <SelectItem key={levelOption} value={levelOption.toString()}>
                    Level {levelOption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createCharacter.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createCharacter.isPending}
              className="bg-spiritual-600 hover:bg-spiritual-700 text-white"
            >
              {createCharacter.isPending ? "Creating..." : "Create Character"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
