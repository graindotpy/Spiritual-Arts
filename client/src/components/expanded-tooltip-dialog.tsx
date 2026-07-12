import { BookOpen } from "lucide-react";
import {
  EnhancedContentDialog,
  type EnhancedContentSaveData,
} from "@/components/enhanced-content-dialog";
import { useGlossaryMutations, type GlossaryScope } from "@/hooks/use-glossary";
import { useToast } from "@/hooks/use-toast";
import type { DmGlossaryTerm, GlossaryTerm } from "@shared/schema";

interface ExpandedTooltipDialogProps {
  open: boolean;
  onClose: () => void;
  term: GlossaryTerm | DmGlossaryTerm;
  entityId: string;
  scope: GlossaryScope;
}

export default function ExpandedTooltipDialog({
  open,
  onClose,
  term,
  entityId,
  scope,
}: ExpandedTooltipDialogProps) {
  const { toast } = useToast();
  const { updateTerm } = useGlossaryMutations(
    scope,
    entityId,
    () => toast({ title: "Enhanced content saved" }),
    () => toast({ title: "Enhanced content could not be saved", variant: "destructive" }),
  );

  const save = ({ summary, expandedContent, hasExpandedContent }: EnhancedContentSaveData) =>
    updateTerm.mutateAsync({
      termId: term.id,
      update: {
        definition: summary,
        expandedContent,
        hasExpandedContent,
      },
    });

  return (
    <EnhancedContentDialog
      open={open}
      onClose={onClose}
      recordKey={term.id}
      title={term.keyword}
      eyebrow="Glossary reference"
      description="A concise definition with optional rich notes, tables, and imagery."
      summaryTitle="Basic definition"
      summary={term.definition}
      expandedContent={term.expandedContent}
      icon={BookOpen}
      canEdit
      onSave={save}
    />
  );
}
