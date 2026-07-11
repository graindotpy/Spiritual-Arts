import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, BookOpen } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: glossaryTerms = [], isLoading } = useQuery<GlossaryTerm[]>({
    queryKey: characterKeys.glossary(characterId),
    enabled: open && !!characterId,
  });

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

  const handleDelete = async (id: string, keyword: string) => {
    if (confirm(`Are you sure you want to delete the term "${keyword}"? This cannot be undone.`)) {
      await deleteTerm.mutateAsync(id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-[var(--dialog-background)] text-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-600">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Glossary - Keyword Definitions
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Add New Term */}
          <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-[var(--dialog-section)]">
            <h3 className="font-medium mb-4">Add New Term</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="keyword">Keyword</Label>
                  <Input
                    id="keyword"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    placeholder="e.g., Technique Drain"
                    className="bg-white dark:bg-[var(--dialog-input)] border-gray-300 dark:border-[var(--dialog-input-border)] text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div className="flex items-end">
                  <Button 
                    type="submit" 
                    disabled={!newKeyword.trim() || !newDefinition.trim() || createTerm.isPending}
                    className="bg-spiritual-600 hover:bg-spiritual-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Term
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="definition">Definition</Label>
                <Textarea
                  id="definition"
                  value={newDefinition}
                  onChange={(e) => setNewDefinition(e.target.value)}
                  placeholder="Detailed explanation of this keyword..."
                  rows={3}
                  className="bg-white dark:bg-[var(--dialog-input)] border-gray-300 dark:border-[var(--dialog-input-border)] text-gray-900 dark:text-gray-100"
                />
              </div>
            </form>
          </div>

          {/* Existing Terms */}
          <div>
            <h3 className="font-medium mb-4">Existing Terms ({glossaryTerms.length})</h3>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Loading glossary terms...</div>
            ) : glossaryTerms.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No glossary terms defined yet. Add your first term above.
              </div>
            ) : (
              <div className="space-y-4">
                {glossaryTerms.map((term: GlossaryTerm) => (
                  <div key={term.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800">
                    {editingTerm?.id === term.id ? (
                      <form onSubmit={handleUpdate} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Keyword</Label>
                            <Input
                              value={editKeyword}
                              onChange={(e) => setEditKeyword(e.target.value)}
                              className="bg-white dark:bg-[var(--dialog-input)] border-gray-300 dark:border-[var(--dialog-input-border)] text-gray-900 dark:text-gray-100"
                            />
                          </div>
                          <div className="flex items-end gap-2">
                            <Button 
                              type="submit" 
                              size="sm"
                              disabled={!editKeyword.trim() || !editDefinition.trim() || updateTerm.isPending}
                              className="bg-spiritual-600 hover:bg-spiritual-700"
                            >
                              Save
                            </Button>
                            <Button 
                              type="button" 
                              size="sm" 
                              variant="secondary"
                              onClick={() => {
                                setEditingTerm(null);
                                setEditKeyword("");
                                setEditDefinition("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                        <div>
                          <Label>Definition</Label>
                          <Textarea
                            value={editDefinition}
                            onChange={(e) => setEditDefinition(e.target.value)}
                            rows={3}
                            className="bg-white dark:bg-[var(--dialog-input)] border-gray-300 dark:border-[var(--dialog-input-border)] text-gray-900 dark:text-gray-100"
                          />
                        </div>
                      </form>
                    ) : (
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-semibold text-spiritual-700 dark:text-spiritual-300 mb-2">
                            {term.keyword}
                          </h4>
                          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">
                            {term.definition}
                          </p>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(term)}
                            className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                             onClick={() => handleDelete(term.id, term.keyword)}
                            aria-label={`Delete ${term.keyword}`}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
