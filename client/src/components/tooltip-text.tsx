import { useState } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Maximize2 } from "lucide-react";
import ExpandedTooltipDialog from "./expanded-tooltip-dialog";
import { useGlossaryTerms, type GlossaryScope } from "@/hooks/use-glossary";
import { cn } from "@/lib/utils";
import type { GlossaryTerm, DmGlossaryTerm } from "@shared/schema";

interface TooltipTextProps {
  text: string;
  entityId: string;
  scope: GlossaryScope;
  className?: string;
}

export default function TooltipText({ text, entityId, scope, className }: TooltipTextProps) {
  const [expandedTerm, setExpandedTerm] = useState<GlossaryTerm | DmGlossaryTerm | null>(null);
  const { data: glossaryTerms = [] } = useGlossaryTerms<GlossaryTerm | DmGlossaryTerm>(scope, entityId);

  if (!glossaryTerms || glossaryTerms.length === 0) {
    return <div className={cn("whitespace-pre-line", className)}>{text}</div>;
  }

  // Create a regex pattern to match all keywords (case-insensitive)
  const keywordPattern = new RegExp(
    `\\b(${glossaryTerms.map((t) => t.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`,
    'gi'
  );

  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = keywordPattern.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // Find the tooltip definition for this keyword
    const tooltip = glossaryTerms.find((t) => 
      t.keyword.toLowerCase() === match![0].toLowerCase()
    );
    


    if (tooltip) {
      parts.push(
        <Tooltip key={`${tooltip.id}:${match.index}`} delayDuration={200}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setExpandedTerm(tooltip);
                }}
                className="wuxia-glossary-keyword cursor-help font-semibold underline decoration-dotted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#668678] focus-visible:ring-offset-2 dark:focus-visible:ring-[#b48b52]"
                aria-haspopup="dialog"
                aria-label={`Open glossary entry for ${tooltip.keyword}`}
              >
                {match[0]}
              </button>
            </TooltipTrigger>
            <TooltipContent
              className="wuxia-glossary-tooltip max-w-sm overflow-hidden p-0"
              side="top"
              sideOffset={8}
            >
              <div className="px-4 py-3.5">
                <p className="mb-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-[#738077] dark:text-[#b69a6a]">
                  Glossary entry
                </p>
                <h4 className="font-display text-lg leading-tight text-[#31594d] dark:text-[#ead6ae]">
                  {tooltip.keyword}
                </h4>
                <p className="mt-2 whitespace-pre-line text-sm leading-5 text-[#56625c] dark:text-[#c8bba4]">
                  {tooltip.definition}
                </p>
              </div>
              <div className="flex items-center gap-2 border-t border-[#c8b99f]/70 bg-[#e9e2d4]/45 px-4 py-2 text-xs font-semibold text-[#4d675d] dark:border-[#806b48]/70 dark:bg-[#191610]/25 dark:text-[#c8ad7c]">
                <Maximize2 className="h-3.5 w-3.5" />
                Select the term to open the full entry
              </div>
            </TooltipContent>
          </Tooltip>
      );
    } else {
      parts.push(match![0]);
    }

    lastIndex = match!.index + match![0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return (
    <>
      <div className={cn("whitespace-pre-line", className)}>
        {parts.map((part, index) =>
          typeof part === "string" ? <span key={`text:${index}`}>{part}</span> : part,
        )}
      </div>
      
      {expandedTerm && (
        <ExpandedTooltipDialog
          open={!!expandedTerm}
          onClose={() => {
            setExpandedTerm(null);
          }}
          term={expandedTerm}
          entityId={entityId}
          scope={scope}
        />
      )}
    </>
  );
}

