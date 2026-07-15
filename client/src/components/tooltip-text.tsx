import { useState, type ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Maximize2 } from "lucide-react";
import ExpandedTooltipDialog from "./expanded-tooltip-dialog";
import { useGlossaryTerms, type GlossaryScope } from "@/hooks/use-glossary";
import { findGlossaryMatches } from "@/lib/glossary-linking";
import { cn } from "@/lib/utils";
import type { GlossaryTerm, DmGlossaryTerm } from "@shared/schema";

export type GlossaryReferenceTerm = Pick<GlossaryTerm, "id" | "keyword" | "definition">;

export function GlossaryTermTrigger({
  term,
  onOpen,
  children,
}: {
  term: GlossaryReferenceTerm;
  onOpen: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onOpen();
          }}
          className="wuxia-glossary-keyword cursor-help font-semibold underline decoration-dotted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#668678] focus-visible:ring-offset-2 dark:focus-visible:ring-[#b48b52]"
          aria-haspopup="dialog"
          aria-label={`Open glossary entry for ${term.keyword}`}
        >
          {children}
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
            {term.keyword}
          </h4>
          <p className="mt-2 whitespace-pre-line text-sm leading-5 text-[#56625c] dark:text-[#c8bba4]">
            {term.definition}
          </p>
        </div>
        <div className="flex items-center gap-2 border-t border-[#c8b99f]/70 bg-[#e9e2d4]/45 px-4 py-2 text-xs font-semibold text-[#4d675d] dark:border-[#806b48]/70 dark:bg-[#191610]/25 dark:text-[#c8ad7c]">
          <Maximize2 className="h-3.5 w-3.5" />
          Select the term to open the full entry
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

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

  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  const matches = findGlossaryMatches(text, glossaryTerms);

  for (const match of matches) {
    // Add text before the match
    if (match.start > lastIndex) {
      parts.push(text.slice(lastIndex, match.start));
    }

    parts.push(
      <GlossaryTermTrigger
        key={`${match.term.id}:${match.start}`}
        term={match.term}
        onOpen={() => setExpandedTerm(match.term)}
      >
        {text.slice(match.start, match.end)}
      </GlossaryTermTrigger>,
    );

    lastIndex = match.end;
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

