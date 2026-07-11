import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { DmGlossaryTerm } from "@shared/schema";
import type { DmGlossaryDraft } from "./api";

interface GlossaryFormDialogProps {
  mode: "create" | "edit";
  open: boolean;
  term?: DmGlossaryTerm | null;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (draft: DmGlossaryDraft) => void;
}

export function GlossaryFormDialog({
  mode,
  open,
  term,
  isPending,
  onClose,
  onSubmit,
}: GlossaryFormDialogProps) {
  const { toast } = useToast();
  const [keyword, setKeyword] = useState("");
  const [definition, setDefinition] = useState("");
  const generatedId = useId().replace(/:/g, "");
  const isEditing = mode === "edit";
  const keywordId = `${mode}-glossary-keyword-${generatedId}`;
  const definitionId = `${mode}-glossary-definition-${generatedId}`;

  useEffect(() => {
    if (open) {
      setKeyword(term?.keyword ?? "");
      setDefinition(term?.definition ?? "");
    }
  }, [open, term]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!keyword.trim() || !definition.trim()) {
      toast({
        title: "Error",
        description: "Both Keyword and Definition are required",
        variant: "destructive",
      });
      return;
    }

    onSubmit({ keyword: keyword.trim(), definition: definition.trim() });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Glossary Term" : "Create New Glossary Term"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div>
              <label
                htmlFor={keywordId}
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
              >
                Keyword
              </label>
              <Input
                id={keywordId}
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="Enter keyword..."
                className="bg-white dark:bg-gray-700"
                data-testid={
                  isEditing ? "input-edit-glossary-keyword" : "input-glossary-keyword"
                }
              />
            </div>
            <div>
              <label
                htmlFor={definitionId}
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
              >
                Definition
              </label>
              <Textarea
                id={definitionId}
                value={definition}
                onChange={(event) => setDefinition(event.target.value)}
                placeholder="Enter definition..."
                rows={4}
                className="bg-white dark:bg-gray-700"
                data-testid={
                  isEditing
                    ? "textarea-edit-glossary-definition"
                    : "textarea-glossary-definition"
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              data-testid={
                isEditing
                  ? "button-cancel-edit-glossary"
                  : "button-cancel-create-glossary"
              }
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              data-testid={
                isEditing ? "button-save-edit-glossary" : "button-save-create-glossary"
              }
            >
              {isPending
                ? isEditing
                  ? "Saving..."
                  : "Creating..."
                : isEditing
                  ? "Save"
                  : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
