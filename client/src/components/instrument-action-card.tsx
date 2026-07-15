import { LoaderCircle, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import TooltipText from "@/components/tooltip-text";
import { RichTextErrorBoundary } from "@/features/enhanced-content/rich-text";
import { GlossaryRichTextContent } from "@/features/glossary/rich-text";
import { characterGlossaryScope } from "@/hooks/use-glossary";
import { cn } from "@/lib/utils";
import {
  isSerializedRichTextContent,
  richTextContentToPlainText,
} from "@shared/enhanced-content";
import type { InstrumentAction, TriggerType } from "@shared/schema";

const ACTION_TYPE_STYLES: Record<TriggerType, string> = {
  action:
    "border-[#829e74]/45 bg-[#dce6c9]/75 text-[#324a2d] dark:border-[#8d9c6b]/35 dark:bg-[#5b6640]/30 dark:text-[#d4ddb6]",
  bonus:
    "border-[#b79559]/45 bg-[#eee0bd]/75 text-[#654e26] dark:border-[#aa8a55]/35 dark:bg-[#755d34]/30 dark:text-[#e5cca0]",
  reaction:
    "border-[#b77b6f]/45 bg-[#eddbd4]/80 text-[#713b33] dark:border-[#a86359]/35 dark:bg-[#713b33]/30 dark:text-[#e4b6ad]",
  passive:
    "border-[#8c8271]/45 bg-[#e5dfd3]/80 text-[#514b43] dark:border-[#8c806a]/35 dark:bg-[#5b554a]/30 dark:text-[#d1c5af]",
};

const ACTION_TYPE_LABELS: Record<TriggerType, string> = {
  action: "Action",
  bonus: "Bonus Action",
  reaction: "Reaction",
  passive: "Passive",
};

function ActionDescription({
  action,
  characterId,
}: {
  action: InstrumentAction;
  characterId: string;
}) {
  const className =
    "technique-rich-text text-sm leading-6 text-[#454e49] dark:text-[#d2c6af]";

  if (isSerializedRichTextContent(action.description)) {
    return (
      <RichTextErrorBoundary
        resetKey={`instrument-action:${action.id}:${action.description}`}
        fallback={
          <TooltipText
            text={richTextContentToPlainText(action.description)}
            entityId={characterId}
            scope={characterGlossaryScope}
            className={className}
          />
        }
      >
        <GlossaryRichTextContent
          content={action.description}
          entityId={characterId}
          scope={characterGlossaryScope}
          className={className}
        />
      </RichTextErrorBoundary>
    );
  }

  return (
    <TooltipText
      text={action.description}
      entityId={characterId}
      scope={characterGlossaryScope}
      className={className}
    />
  );
}

export function InstrumentActionCard({
  action,
  characterId,
  instrumentName,
  onUse,
  isUsing,
  useDisabled,
}: {
  action: InstrumentAction;
  characterId: string;
  instrumentName: string;
  onUse: () => void;
  isUsing: boolean;
  useDisabled: boolean;
}) {
  const foundryActionCount = action.mechanics?.actions.length ?? 0;

  return (
    <Card className="character-technique-entry rounded-none border-0 bg-transparent px-5 py-5 text-[#2f3c37] shadow-none sm:px-6 dark:text-[#e6dcc8]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-display text-xl text-[#263a33] dark:text-[#eee7da]">
            {action.name}
          </h4>
          <Badge
            className={cn(
              "rounded-sm border px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-[0.08em] shadow-none",
              ACTION_TYPE_STYLES[action.actionType],
            )}
          >
            {ACTION_TYPE_LABELS[action.actionType]}
          </Badge>
        </div>
        {foundryActionCount > 0 ? (
          <Button
            type="button"
            size="sm"
            className="wuxia-primary-action h-9 shrink-0 self-start px-3"
            onClick={onUse}
            disabled={useDisabled}
            aria-label={`Use ${action.name} from ${instrumentName} in Foundry`}
          >
            {isUsing ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {isUsing ? "Sending…" : "Use Action"}
          </Button>
        ) : null}
      </div>
      <div className="mt-4 border-l-2 border-[#9b4437]/70 py-1 pl-4 dark:border-[#b36d58]/70">
        <ActionDescription action={action} characterId={characterId} />
      </div>
    </Card>
  );
}
