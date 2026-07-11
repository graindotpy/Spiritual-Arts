import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { requestJson } from "@/lib/api";
import { characterKeys } from "@/lib/query-keys";
import type { Tracker } from "@shared/schema";

interface TrackerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  characterId: string;
}

export default function TrackerDialog({ isOpen, onClose, characterId }: TrackerDialogProps) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState<string>("");
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; target?: string }) => {
      return requestJson<Tracker>("POST", `/api/character/${characterId}/trackers`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: characterKeys.trackers(characterId),
      });
      onClose();
      setName("");
      setTarget("");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const targetText = target.trim() || undefined;
    createMutation.mutate({
      name: name.trim(),
      target: targetText
    });
  };

  const handleClose = () => {
    onClose();
    setName("");
    setTarget("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Tracker</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="tracker-name">Name</Label>
              <Input
                id="tracker-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter tracker name..."
                data-testid="input-tracker-name"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="tracker-target">Target (optional)</Label>
              <Input
                id="tracker-target"
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="Enter target description..."
                data-testid="input-tracker-target"
              />
            </div>
          </div>
          
          <DialogFooter className="mt-6">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={!name.trim() || createMutation.isPending}
              data-testid="button-create-tracker"
            >
              {createMutation.isPending ? "Creating..." : "Create Tracker"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
