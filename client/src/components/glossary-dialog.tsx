import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, Check, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CampaignDialogBody,
  CampaignDialogContent,
  CampaignDialogFooter,
  CampaignDialogHeader,
} from "@/components/campaign-dialog";
import { CampaignConfirmDialog } from "@/components/campaign-confirm-dialog";
import ExpandedTooltipDialog from "@/components/expanded-tooltip-dialog";
import { characterGlossaryScope } from "@/hooks/use-glossary";
import { requestJson } from "@/lib/api";
import { characterKeys } from "@/lib/query-keys";
import { useToast } from "@/hooks/use-toast";
import type { GlossaryTerm, InsertGlossaryTerm } from "@shared/schema";

interface GlossaryDialogProps {
  open: boolean;
  onClose: () => void;
  characterId: string;
}

export default function GlossaryDialog({ open, onClose, characterId }: GlossaryDialogProps) {
  const [newKeyword, setNewKeyword] = useState("");
  const [newDefinition, setNewDefinition] = useState("");
  const [editingTerm, setEditingTerm] = useState<GlossaryTerm | null>(null);
  const [editKeyword, setEditKeyword] = useState("");
  const [editDefinition, setEditDefinition] = useState("");
  const [termPendingDelete, setTermPendingDelete] = useState<GlossaryTerm | null>(null);
  const [expandedTermId, setExpandedTermId] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: glossaryTerms = [], isLoading } = useQuery<GlossaryTerm[]>({
    queryKey: characterKeys.glossary(characterId),
    enabled: open && !!characterId,
  });
  const expandedTerm = glossaryTerms.find((term) => term.id === expandedTermId) ?? null;

  const createTerm = useMutation({
    mutationFn: (data: Omit<InsertGlossaryTerm, "characterId">) =>
      requestJson<GlossaryTerm>("POST", `/api/character/${characterId}/glossary`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: characterKeys.glossary(characterId) });
      setNewKeyword("");
      setNewDefinition("");
      toast({
        title: "Success",
        description: "Glossary term added successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add glossary term",
        variant: "destructive",
      });
    },
  });

  const updateTerm = useMutation({
    mutationFn: async (data: { id: string } & Partial<InsertGlossaryTerm>) => {
      const { id, ...updateData } = data;
      return requestJson<GlossaryTerm>("PUT", `/api/glossary/${id}`, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: characterKeys.glossary(characterId) });
      setEditingTerm(null);
      setEditKeyword("");
      setEditDefinition("");
      toast({
        title: "Success",
        description: "Glossary term updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update glossary term",
        variant: "destructive",
      });
    },
  });

  const deleteTerm = useMutation({
    mutationFn: async (id: string) => {
      await requestJson<{ success: boolean }>("DELETE", `/api/glossary/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: characterKeys.glossary(characterId) });
      setTermPendingDelete(null);
      toast({
        title: "Success",
        description: "Glossary term deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete glossary term",
        variant: "destructive",
      });
    },
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim() || !newDefinition.trim()) return;

    await createTerm.mutateAsync({
      keyword: newKeyword.trim(),
      definition: newDefinition.trim(),
      expandedContent: null,
      hasExpandedContent: false,
    });
  };

  const handleEdit = (term: GlossaryTerm) => {
    setEditingTerm(term);
    setEditKeyword(term.keyword);
    setEditDefinition(term.definition);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTerm || !editKeyword.trim() || !editDefinition.trim()) return;

    await updateTerm.mutateAsync({
      id: editingTerm.id,
      keyword: editKeyword.trim(),
      definition: editDefinition.trim(),
    });
  };

  const handleClose = () => {
    setTermPendingDelete(null);
    setEditingTerm(null);
    setEditKeyword("");
    setEditDefinition("");
    setExpandedTermId(null);
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
        <CampaignDialogContent className="max-w-4xl">
          <CampaignDialogHeader
            icon={BookOpen}
            eyebrow="Character reference"
            title="Glossary"
            description="Define recurring terms so their meaning is always close at hand in the path manual."
          />

          <CampaignDialogBody className="space-y-7">
            <section className="wuxia-dialog-section p-4 sm:p-5" aria-labelledby="add-term-heading">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-sm border border-[#a89470] bg-[#e4eadc]/70 text-[#356454] dark:border-[#8d744b] dark:bg-[#594326]/45 dark:text-[#d1af73]">
                  <Plus className="h-4 w-4" />
                </span>
                <div>
                  <p className="wuxia-dialog-kicker">New reference</p>
                  <h3
                    id="add-term-heading"
                    className="font-display text-xl text-[#2b4138] dark:text-[#eadcc2]"
                  >
                    Add a glossary term
                  </h3>
                </div>
              </div>

              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <Label htmlFor="keyword" className="wuxia-dialog-label">
                    Keyword
                  </Label>
                  <Input
                    id="keyword"
                    value={newKeyword}
                    onChange={(event) => setNewKeyword(event.target.value)}
                    placeholder="e.g. Technique Drain"
                    className="wuxia-dialog-control"
                  />
                </div>
                <div>
                  <Label htmlFor="definition" className="wuxia-dialog-label">
                    Definition
                  </Label>
                  <Textarea
                    id="definition"
                    value={newDefinition}
                    onChange={(event) => setNewDefinition(event.target.value)}
                    placeholder="Explain what this term means…"
                    rows={3}
                    className="wuxia-dialog-control"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={!newKeyword.trim() || !newDefinition.trim() || createTerm.isPending}
                    className="wuxia-primary-action w-full sm:w-auto"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {createTerm.isPending ? "Adding…" : "Add term"}
                  </Button>
                </div>
              </form>
            </section>

            <section aria-labelledby="existing-terms-heading">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="wuxia-dialog-kicker">Recorded knowledge</p>
                  <h3
                    id="existing-terms-heading"
                    className="font-display text-xl text-[#2b4138] dark:text-[#eadcc2]"
                  >
                    Existing terms
                  </h3>
                </div>
                <span className="rounded-sm border border-[#b9aa8f] bg-[#fffaf0]/45 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-[#667069] dark:border-[#806b48] dark:bg-[#4d3e29]/25 dark:text-[#c5b18d]">
                  {glossaryTerms.length} {glossaryTerms.length === 1 ? "term" : "terms"}
                </span>
              </div>

              {isLoading ? (
                <div className="wuxia-dialog-section wuxia-dialog-section-muted p-8 text-center" role="status">
                  <BookOpen className="mx-auto mb-3 h-6 w-6 animate-pulse text-[#567366] motion-reduce:animate-none dark:text-[#c2a36d]" />
                  <p className="text-sm text-[#6d716a] dark:text-[#b7a98d]">Opening the glossary…</p>
                </div>
              ) : glossaryTerms.length === 0 ? (
                <div className="wuxia-dialog-section wuxia-dialog-section-muted p-8 text-center">
                  <BookOpen className="mx-auto mb-3 h-7 w-7 text-[#75867d] dark:text-[#aa936b]" />
                  <p className="font-display text-lg text-[#3d554b] dark:text-[#decbaa]">No terms recorded yet</p>
                  <p className="mt-1 text-sm text-[#74766e] dark:text-[#aa9d86]">
                    Add the first definition above to begin this character&apos;s reference.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {glossaryTerms.map((term) => (
                    <article key={term.id} className="wuxia-dialog-section p-4 sm:p-5">
                      {editingTerm?.id === term.id ? (
                        <form onSubmit={handleUpdate} className="space-y-4">
                          <div>
                            <Label htmlFor={`edit-keyword-${term.id}`} className="wuxia-dialog-label">
                              Keyword
                            </Label>
                            <Input
                              id={`edit-keyword-${term.id}`}
                              value={editKeyword}
                              onChange={(event) => setEditKeyword(event.target.value)}
                              className="wuxia-dialog-control"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`edit-definition-${term.id}`} className="wuxia-dialog-label">
                              Definition
                            </Label>
                            <Textarea
                              id={`edit-definition-${term.id}`}
                              value={editDefinition}
                              onChange={(event) => setEditDefinition(event.target.value)}
                              rows={3}
                              className="wuxia-dialog-control"
                            />
                          </div>
                          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="wuxia-secondary-action"
                              onClick={() => {
                                setEditingTerm(null);
                                setEditKeyword("");
                                setEditDefinition("");
                              }}
                            >
                              <X className="mr-1.5 h-3.5 w-3.5" />
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              size="sm"
                              disabled={
                                !editKeyword.trim() ||
                                !editDefinition.trim() ||
                                updateTerm.isPending
                              }
                              className="wuxia-primary-action"
                            >
                              <Check className="mr-1.5 h-3.5 w-3.5" />
                              {updateTerm.isPending ? "Saving…" : "Save term"}
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-display break-words text-xl text-[#31594d] dark:text-[#e2ca9b]">
                              {term.keyword}
                            </h4>
                            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#59635e] dark:text-[#c5b9a2]">
                              {term.definition}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1 self-end sm:self-start">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setExpandedTermId(term.id)}
                              className="wuxia-icon-action"
                            >
                              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                              Enhanced
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(term)}
                              className="wuxia-icon-action"
                            >
                              <Pencil className="mr-1.5 h-3.5 w-3.5" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => setTermPendingDelete(term)}
                              aria-label={`Delete ${term.keyword}`}
                              className="wuxia-icon-action wuxia-icon-danger h-9 w-9"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </CampaignDialogBody>

          <CampaignDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="wuxia-secondary-action w-full sm:w-auto"
            >
              Close glossary
            </Button>
          </CampaignDialogFooter>
        </CampaignDialogContent>
      </Dialog>

      {expandedTerm && (
        <ExpandedTooltipDialog
          open
          onClose={() => setExpandedTermId(null)}
          term={expandedTerm}
          entityId={characterId}
          scope={characterGlossaryScope}
        />
      )}

      <CampaignConfirmDialog
        open={termPendingDelete !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setTermPendingDelete(null);
        }}
        title="Delete glossary term?"
        description={
          termPendingDelete
            ? `Remove “${termPendingDelete.keyword}” from this character's glossary?`
            : "Remove this term from the glossary?"
        }
        isPending={deleteTerm.isPending}
        onConfirm={() => {
          if (termPendingDelete) deleteTerm.mutate(termPendingDelete.id);
        }}
      />
    </>
  );
}
