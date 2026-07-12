import { AlertTriangle } from "lucide-react";
import {
  CampaignDialogBody,
  CampaignDialogContent,
  CampaignDialogFooter,
  CampaignDialogHeader,
} from "@/components/campaign-dialog";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

interface CampaignConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  detail?: string;
  confirmLabel?: string;
  pendingLabel?: string;
  isPending?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function CampaignConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  detail = "This action cannot be undone.",
  confirmLabel = "Delete",
  pendingLabel = "Deleting…",
  isPending = false,
  onConfirm,
}: CampaignConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending) onOpenChange(nextOpen);
      }}
    >
      <CampaignDialogContent className="max-w-md">
        <CampaignDialogHeader
          icon={AlertTriangle}
          eyebrow="Confirm action"
          title={title}
          description={description}
        />
        <CampaignDialogBody>
          <p className="wuxia-dialog-section wuxia-dialog-section-muted px-4 py-3 text-sm leading-6 text-[#725047] dark:text-[#d8b2a2]">
            {detail}
          </p>
        </CampaignDialogBody>
        <CampaignDialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="wuxia-secondary-action w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="wuxia-danger-action w-full sm:w-auto"
          >
            {isPending ? pendingLabel : confirmLabel}
          </Button>
        </CampaignDialogFooter>
      </CampaignDialogContent>
    </Dialog>
  );
}
