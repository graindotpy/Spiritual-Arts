import { useState } from "react";
import { BookOpen, Edit2, Plus, Sparkles, Trash2 } from "lucide-react";
import ExpandedTooltipDialog from "@/components/expanded-tooltip-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dmGlossaryScope } from "@/hooks/use-glossary";
import { useToast } from "@/hooks/use-toast";
import type { DmGlossaryTerm } from "@shared/schema";
import {
  useDmGlossary,
  useDmGlossaryMutations,
  type DmGlossaryDraft,
} from "./api";
import { GlossaryFormDialog } from "./glossary-form-dialog";

interface GlossaryPanelProps {
  userId: string;
}

export function GlossaryPanel({ userId }: GlossaryPanelProps) {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<DmGlossaryTerm | null>(null);
  const [expandedTermId, setExpandedTermId] = useState<string | null>(null);
  const glossaryQuery = useDmGlossary(userId);
  const { createGlossaryTerm, updateGlossaryTerm, deleteGlossaryTerm } =
    useDmGlossaryMutations(userId);

  const glossaryTerms = glossaryQuery.data ?? [];
  const expandedTerm =
    glossaryTerms.find((term) => term.id === expandedTermId) ?? null;

  const handleCreate = (draft: DmGlossaryDraft) => {
    createGlossaryTerm.mutate(draft, {
      onSuccess: () => {
        setIsCreateDialogOpen(false);
        toast({
          title: "Success",
          description: "Glossary term created successfully",
        });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to create glossary term",
          variant: "destructive",
        });
      },
    });
  };

  const handleUpdate = (draft: DmGlossaryDraft) => {
    if (!editingTerm) {
      return;
    }

    updateGlossaryTerm.mutate(
      { id: editingTerm.id, ...draft },
      {
        onSuccess: () => {
          setEditingTerm(null);
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
      },
    );
  };

  const handleDelete = (term: DmGlossaryTerm) => {
    deleteGlossaryTerm.mutate(term.id, {
      onSuccess: () => {
        if (expandedTermId === term.id) {
          setExpandedTermId(null);
        }
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
  };

  return (
    <>
      <div className="flex justify-end mb-6">
        <Button
          type="button"
          onClick={() => setIsCreateDialogOpen(true)}
          className="bg-spiritual-600 hover:bg-spiritual-700 text-white"
          data-testid="button-create-glossary"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Glossary Term
        </Button>
      </div>

      {glossaryQuery.isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">Loading glossary terms...</p>
        </div>
      ) : glossaryQuery.isError ? (
        <div className="text-center py-12 text-red-600 dark:text-red-400">
          Failed to load glossary terms.
        </div>
      ) : glossaryTerms.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-spiritual-100 dark:bg-spiritual-900 rounded-full flex items-center justify-center mx-auto mb-6">
            <BookOpen className="w-12 h-12 text-spiritual-600 dark:text-spiritual-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No Glossary Terms Yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Create your first glossary term
          </p>
          <Button
            type="button"
            onClick={() => setIsCreateDialogOpen(true)}
            className="bg-spiritual-600 hover:bg-spiritual-700 text-white"
            data-testid="button-create-first-glossary"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Glossary Term
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {glossaryTerms.map((term) => (
            <Card
              key={term.id}
              className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
              data-testid={`card-glossary-${term.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg text-spiritual-700 dark:text-spiritual-400">
                    {term.keyword}
                  </CardTitle>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setExpandedTermId(term.id)}
                      data-testid={`button-enhanced-glossary-${term.id}`}
                      title="Edit Enhanced Content"
                      aria-label={`Edit enhanced content for ${term.keyword}`}
                    >
                      <Sparkles className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingTerm(term)}
                      aria-label={`Edit ${term.keyword}`}
                      data-testid={`button-edit-glossary-${term.id}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(term)}
                      aria-label={`Delete ${term.keyword}`}
                      data-testid={`button-delete-glossary-${term.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-900 dark:text-white whitespace-pre-line">
                  {term.definition}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <GlossaryFormDialog
        mode="create"
        open={isCreateDialogOpen}
        isPending={createGlossaryTerm.isPending}
        onClose={() => setIsCreateDialogOpen(false)}
        onSubmit={handleCreate}
      />
      <GlossaryFormDialog
        mode="edit"
        open={Boolean(editingTerm)}
        term={editingTerm}
        isPending={updateGlossaryTerm.isPending}
        onClose={() => setEditingTerm(null)}
        onSubmit={handleUpdate}
      />

      {expandedTerm && (
        <ExpandedTooltipDialog
          open
          onClose={() => setExpandedTermId(null)}
          term={expandedTerm}
          entityId={userId}
          scope={dmGlossaryScope}
        />
      )}
    </>
  );
}
