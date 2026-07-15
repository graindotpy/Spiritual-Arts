import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { Mark, type Extensions, type MarkViewProps } from "@tiptap/core";
import { MarkViewContent, ReactMarkViewRenderer } from "@tiptap/react";
import ExpandedTooltipDialog from "@/components/expanded-tooltip-dialog";
import { GlossaryTermTrigger } from "@/components/tooltip-text";
import {
  RichTextContent,
  richTextViewerExtensions,
} from "@/features/enhanced-content/rich-text";
import { useGlossaryTerms, type GlossaryScope } from "@/hooks/use-glossary";
import {
  decorateRichTextWithGlossaryReferences,
  GLOSSARY_REFERENCE_MARK,
} from "@/lib/glossary-linking";
import { normalizeRichTextContent } from "@shared/enhanced-content";
import type { DmGlossaryTerm, GlossaryTerm } from "@shared/schema";

type GlossaryEntry = GlossaryTerm | DmGlossaryTerm;

interface GlossaryReferenceContextValue {
  termsById: ReadonlyMap<string, GlossaryEntry>;
  openTerm: (termId: string) => void;
}

const GlossaryReferenceContext = createContext<GlossaryReferenceContextValue>({
  termsById: new Map(),
  openTerm: () => undefined,
});

function GlossaryReferenceView({ mark }: MarkViewProps) {
  const { termsById, openTerm } = useContext(GlossaryReferenceContext);
  const termId = typeof mark.attrs.termId === "string" ? mark.attrs.termId : "";
  const term = termsById.get(termId);

  if (!term) return <MarkViewContent />;

  return (
    <GlossaryTermTrigger term={term} onOpen={() => openTerm(term.id)}>
      <MarkViewContent />
    </GlossaryTermTrigger>
  );
}

const glossaryReferenceMark = Mark.create({
  name: GLOSSARY_REFERENCE_MARK,
  inclusive: false,
  addAttributes() {
    return {
      termId: {
        default: null,
        rendered: false,
      },
    };
  },
  renderHTML({ mark }) {
    return [
      "span",
      { "data-glossary-reference": String(mark.attrs.termId ?? "") },
      0,
    ];
  },
  addMarkView() {
    return ReactMarkViewRenderer(GlossaryReferenceView, { as: "span" });
  },
});

const glossaryRichTextExtensions: Extensions = [
  glossaryReferenceMark,
  ...richTextViewerExtensions,
];

export function GlossaryRichTextContent({
  content,
  entityId,
  scope,
  className,
}: {
  content: string;
  entityId: string;
  scope: GlossaryScope;
  className?: string;
}) {
  const [expandedTermId, setExpandedTermId] = useState<string | null>(null);
  const { data: glossaryTerms = [] } = useGlossaryTerms<GlossaryEntry>(scope, entityId);
  const termsById = useMemo(
    () => new Map(glossaryTerms.map((term) => [term.id, term])),
    [glossaryTerms],
  );
  const openTerm = useCallback((termId: string) => setExpandedTermId(termId), []);
  const contextValue = useMemo(
    () => ({ termsById, openTerm }),
    [openTerm, termsById],
  );
  const decoratedContent = useMemo(
    () => decorateRichTextWithGlossaryReferences(
      normalizeRichTextContent(content),
      glossaryTerms,
    ),
    [content, glossaryTerms],
  );
  const expandedTerm = expandedTermId ? termsById.get(expandedTermId) ?? null : null;

  return (
    <>
      <GlossaryReferenceContext.Provider value={contextValue}>
        <RichTextContent
          content={decoratedContent}
          className={className}
          extensions={glossaryRichTextExtensions}
        />
      </GlossaryReferenceContext.Provider>

      {expandedTerm && (
        <ExpandedTooltipDialog
          open
          onClose={() => setExpandedTermId(null)}
          term={expandedTerm}
          entityId={entityId}
          scope={scope}
        />
      )}
    </>
  );
}
