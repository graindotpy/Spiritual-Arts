import { useState } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Maximize2 } from "lucide-react";
import ExpandedTooltipDialog from "./expanded-tooltip-dialog";
import { useTooltipContext } from "@/contexts/tooltip-context";
import { useGlossaryTerms, type GlossaryScope } from "@/hooks/use-glossary";
import type { GlossaryTerm, DmGlossaryTerm } from "@shared/schema";

interface TooltipTextProps {
  text: string;
  entityId: string;
  scope: GlossaryScope;
  className?: string;
}

export default function TooltipText({ text, entityId, scope, className }: TooltipTextProps) {
  const [expandedTerm, setExpandedTerm] = useState<GlossaryTerm | DmGlossaryTerm | null>(null);
  const { setIsEnhancedTooltipOpen } = useTooltipContext();
  
  const { data: glossaryTerms = [] } = useGlossaryTerms<GlossaryTerm | DmGlossaryTerm>(scope, entityId);

  if (!glossaryTerms || glossaryTerms.length === 0) {
    return <div className={`${className} whitespace-pre-line`}>{text}</div>;
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
        <TooltipProvider key={match.index}>
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <span className="text-spiritual-600 dark:text-spiritual-400 underline decoration-dotted cursor-help font-medium">
                {match![0]}
              </span>
            </TooltipTrigger>
            <TooltipContent 
              className="max-w-xs bg-white dark:bg-gray-800 border border-spiritual-200 dark:border-spiritual-600 shadow-lg"
              side="top"
            >
              <div className="space-y-2">
                <h4 className="font-semibold text-spiritual-700 dark:text-spiritual-300">
                  {tooltip.keyword}
                </h4>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
                  {tooltip.definition}
                </p>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.nativeEvent.stopImmediatePropagation();
                    setExpandedTerm(tooltip);
                    setIsEnhancedTooltipOpen(true);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className="h-6 px-2 text-xs w-full justify-start"
                >
                  <Maximize2 className="w-3 h-3 mr-1" />
                  {(tooltip.hasExpandedContent || tooltip.expandedContent) 
                    ? "View Enhanced Details" 
                    : "Add Enhanced Content"}
                </Button>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
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
      <div className={`${className} whitespace-pre-line`}>
        {parts.map((part, index) => (
          typeof part === 'string' ? part : <span key={index}>{part}</span>
        ))}
      </div>
      
      {expandedTerm && (
        <ExpandedTooltipDialog
          open={!!expandedTerm}
          onClose={() => {
            setExpandedTerm(null);
            setIsEnhancedTooltipOpen(false);
          }}
          term={expandedTerm}
          entityId={entityId}
          scope={scope}
        />
      )}
    </>
  );
}

