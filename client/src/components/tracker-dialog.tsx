import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CampaignDialogBody,
  CampaignDialogContent,
  CampaignDialogFooter,
  CampaignDialogHeader,
} from "@/components/campaign-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ListPlus } from "lucide-react";
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
      <CampaignDialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <CampaignDialogHeader
            icon={ListPlus}
            eyebrow="Character tracker"
            title="Add New Tracker"
            description="Track a goal, resource, condition, or other campaign milestone."
          />

          <CampaignDialogBody className="space-y-5">
            <div>
              <Label htmlFor="tracker-name" className="wuxia-dialog-label">Name</Label>
              <Input
                id="tracker-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter tracker name..."
                data-testid="input-tracker-name"
                className="wuxia-dialog-control"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="tracker-target" className="wuxia-dialog-label">
                Target (optional)
              </Label>
              <Input
                id="tracker-target"
                type="text"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="Enter target description..."
                data-testid="input-tracker-target"
                className="wuxia-dialog-control"
              />
            </div>
          </CampaignDialogBody>
          
          <CampaignDialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              data-testid="button-cancel"
              className="wuxia-secondary-action w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={!name.trim() || createMutation.isPending}
              data-testid="button-create-tracker"
              className="wuxia-primary-action w-full sm:w-auto"
            >
              {createMutation.isPending ? "Creating..." : "Create Tracker"}
            </Button>
          </CampaignDialogFooter>
        </form>
      </CampaignDialogContent>
    </Dialog>
  );
}
