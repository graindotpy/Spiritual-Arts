import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type CampaignDialogContentProps = React.ComponentPropsWithoutRef<typeof DialogContent>;

export const CampaignDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  CampaignDialogContentProps
>(({ className, ...props }, ref) => (
  <DialogContent
    ref={ref}
    className={cn(
      "wuxia-dialog flex max-h-[min(92dvh,56rem)] w-[calc(100%-1rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:w-[calc(100%-2rem)]",
      className,
    )}
    {...props}
  />
));
CampaignDialogContent.displayName = "CampaignDialogContent";

interface CampaignDialogHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: LucideIcon;
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

export function CampaignDialogHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  actions,
  className,
  ...props
}: CampaignDialogHeaderProps) {
  return (
    <DialogHeader className={cn("wuxia-dialog-header", className)} {...props}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          {Icon && (
            <span className="wuxia-dialog-icon" aria-hidden="true">
              <Icon className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            <p className="wuxia-dialog-kicker">{eyebrow}</p>
            <DialogTitle className="wuxia-dialog-title">{title}</DialogTitle>
            {description && (
              <DialogDescription className="wuxia-dialog-description">
                {description}
              </DialogDescription>
            )}
          </div>
        </div>
        {actions && <div className="wuxia-dialog-header-actions">{actions}</div>}
      </div>
    </DialogHeader>
  );
}

export const CampaignDialogBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("wuxia-dialog-body min-h-0 flex-1 overflow-y-auto", className)}
    {...props}
  />
));
CampaignDialogBody.displayName = "CampaignDialogBody";

export const CampaignDialogFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "wuxia-dialog-footer flex shrink-0 flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end",
      className,
    )}
    {...props}
  />
));
CampaignDialogFooter.displayName = "CampaignDialogFooter";
