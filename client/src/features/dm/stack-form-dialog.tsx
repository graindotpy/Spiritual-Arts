import { useEffect, useId, useRef, useState } from "react";
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
import type { DmGlossaryTerm, DmStack } from "@shared/schema";
import type { DmStackDraft } from "./api";

interface StackFormDialogProps {
  mode: "create" | "edit";
  open: boolean;
  stack?: DmStack | null;
  glossaryTerms: DmGlossaryTerm[];
  isPending: boolean;
  onClose: () => void;
  onSubmit: (draft: DmStackDraft) => void;
}

export function StackFormDialog({
  mode,
  open,
  stack,
  glossaryTerms,
  isPending,
  onClose,
  onSubmit,
}: StackFormDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [effect, setEffect] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [matches, setMatches] = useState<DmGlossaryTerm[]>([]);
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const effectTextareaRef = useRef<HTMLTextAreaElement>(null);
  const autocompleteContainerRef = useRef<HTMLDivElement>(null);
  const generatedId = useId().replace(/:/g, "");

  const fieldPrefix = `${mode}-stack-${generatedId}`;
  const nameId = `${fieldPrefix}-name`;
  const targetId = `${fieldPrefix}-target`;
  const effectId = `${fieldPrefix}-effect`;
  const listboxId = `${fieldPrefix}-glossary-options`;

  useEffect(() => {
    if (!open) {
      return;
    }

    setName(stack?.name ?? "");
    setTarget(stack?.target ?? "");
    setEffect(stack?.effect ?? "");
    setCursorPosition(0);
    setMatches([]);
    setActiveMatchIndex(0);
    setShowAutocomplete(false);
  }, [open, stack]);

  useEffect(() => {
    if (!showAutocomplete) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (
        autocompleteContainerRef.current &&
        !autocompleteContainerRef.current.contains(event.target as Node)
      ) {
        setShowAutocomplete(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showAutocomplete]);

  const updateAutocomplete = (value: string, cursor: number) => {
    const textBeforeCursor = value.slice(0, cursor);
    const currentWord = textBeforeCursor.split(/\s+/).at(-1) ?? "";

    if (!currentWord) {
      setMatches([]);
      setShowAutocomplete(false);
      return;
    }

    const nextMatches = glossaryTerms.filter((term) =>
      term.keyword.toLowerCase().startsWith(currentWord.toLowerCase()),
    );
    setMatches(nextMatches);
    setActiveMatchIndex(0);
    setShowAutocomplete(nextMatches.length > 0);
  };

  const handleEffectChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    const cursor = event.target.selectionStart ?? 0;
    setEffect(value);
    setCursorPosition(cursor);
    updateAutocomplete(value, cursor);
  };

  const insertGlossaryTerm = (term: DmGlossaryTerm) => {
    const textBeforeCursor = effect.slice(0, cursorPosition);
    const currentWord = textBeforeCursor.split(/\s+/).at(-1) ?? "";
    const wordStart = cursorPosition - currentWord.length;
    const nextEffect =
      effect.slice(0, wordStart) + term.keyword + effect.slice(cursorPosition);
    const nextCursor = wordStart + term.keyword.length;

    setEffect(nextEffect);
    setShowAutocomplete(false);
    window.requestAnimationFrame(() => {
      effectTextareaRef.current?.setSelectionRange(nextCursor, nextCursor);
      effectTextareaRef.current?.focus();
    });
  };

  const handleEffectKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showAutocomplete || matches.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveMatchIndex((index) => (index + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveMatchIndex((index) => (index - 1 + matches.length) % matches.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      insertGlossaryTerm(matches[activeMatchIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setShowAutocomplete(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !target.trim() || !effect.trim()) {
      toast({
        title: "Error",
        description: "Name, Target and Effect are required",
        variant: "destructive",
      });
      return;
    }

    onSubmit({
      name: name.trim(),
      target: target.trim(),
      effect: effect.trim(),
    });
  };

  const closeDialog = () => {
    setShowAutocomplete(false);
    onClose();
  };

  const isEditing = mode === "edit";

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeDialog();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Stack" : "Create New Stack"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div>
              <label
                htmlFor={nameId}
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
              >
                Name
              </label>
              <Input
                id={nameId}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter stack name..."
                className="bg-white dark:bg-gray-700"
                data-testid={isEditing ? "input-edit-stack-name" : "input-stack-name"}
              />
            </div>
            <div>
              <label
                htmlFor={targetId}
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
              >
                Target
              </label>
              <Textarea
                id={targetId}
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                placeholder="Enter target description..."
                rows={3}
                className="bg-white dark:bg-gray-700"
                data-testid={
                  isEditing ? "textarea-edit-stack-target" : "textarea-stack-target"
                }
              />
            </div>
            <div className="relative" ref={autocompleteContainerRef}>
              <label
                htmlFor={effectId}
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
              >
                Effect
              </label>
              <Textarea
                id={effectId}
                ref={effectTextareaRef}
                value={effect}
                onChange={handleEffectChange}
                onKeyDown={handleEffectKeyDown}
                onClick={(event) => setCursorPosition(event.currentTarget.selectionStart ?? 0)}
                placeholder="Enter effect description..."
                rows={3}
                className="bg-white dark:bg-gray-700"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={showAutocomplete}
                aria-controls={listboxId}
                aria-activedescendant={
                  showAutocomplete ? `${listboxId}-${matches[activeMatchIndex]?.id}` : undefined
                }
                data-testid={
                  isEditing ? "textarea-edit-stack-effect" : "textarea-stack-effect"
                }
              />
              {showAutocomplete && matches.length > 0 && (
                <div
                  id={listboxId}
                  role="listbox"
                  aria-label="Glossary term suggestions"
                  data-autocomplete-dropdown
                  className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto"
                >
                  {matches.map((term, index) => (
                    <button
                      key={term.id}
                      id={`${listboxId}-${term.id}`}
                      type="button"
                      role="option"
                      aria-selected={index === activeMatchIndex}
                      onMouseEnter={() => setActiveMatchIndex(index)}
                      onClick={() => insertGlossaryTerm(term)}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 aria-selected:bg-gray-100 dark:aria-selected:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                      data-testid={
                        isEditing
                          ? `autocomplete-item-edit-${term.id}`
                          : `autocomplete-item-${term.id}`
                      }
                    >
                      <div className="font-semibold text-spiritual-700 dark:text-spiritual-400">
                        {term.keyword}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {term.definition}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={closeDialog}
              data-testid={isEditing ? "button-cancel-edit" : "button-cancel-create"}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              data-testid={isEditing ? "button-save-edit" : "button-save-create"}
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
