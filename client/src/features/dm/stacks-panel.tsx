import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { DmStack } from "@shared/schema";
import {
  useDmGlossary,
  useDmScratchpadMutations,
  useDmScratchpads,
  useDmStackMutations,
  useDmStacks,
  type DmScratchpadUpdate,
  type DmStackDraft,
} from "./api";
import { ScratchpadCard } from "./scratchpad-card";
import { StackCard } from "./stack-card";
import { StackFormDialog } from "./stack-form-dialog";

interface StacksPanelProps {
  userId: string;
}

export function StacksPanel({ userId }: StacksPanelProps) {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingStack, setEditingStack] = useState<DmStack | null>(null);

  const stacksQuery = useDmStacks(userId);
  const scratchpadsQuery = useDmScratchpads(userId);
  const glossaryQuery = useDmGlossary(userId);
  const { createStack, updateStack, deleteStack } = useDmStackMutations(userId);
  const { createScratchpad, updateScratchpad, deleteScratchpad } =
    useDmScratchpadMutations(userId);

  const saveScratchpad = useCallback(
    (update: DmScratchpadUpdate) => updateScratchpad.mutateAsync(update),
    [updateScratchpad.mutateAsync],
  );

  const handleCreateStack = (draft: DmStackDraft) => {
    createStack.mutate(draft, {
      onSuccess: () => {
        setIsCreateDialogOpen(false);
        toast({
          title: "Success",
          description: "Stack created successfully",
        });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to create stack",
          variant: "destructive",
        });
      },
    });
  };

  const handleUpdateStack = (draft: DmStackDraft) => {
    if (!editingStack) {
      return;
    }

    updateStack.mutate(
      { id: editingStack.id, ...draft },
      {
        onSuccess: () => {
          setEditingStack(null);
          toast({
            title: "Success",
            description: "Stack updated successfully",
          });
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to update stack",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleDeleteStack = (id: string) => {
    deleteStack.mutate(id, {
      onSuccess: () => {
        toast({
          title: "Success",
          description: "Stack deleted successfully",
        });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to delete stack",
          variant: "destructive",
        });
      },
    });
  };

  const stacks = stacksQuery.data ?? [];
  const scratchpads = scratchpadsQuery.data ?? [];
  const glossaryTerms = glossaryQuery.data ?? [];

  return (
    <>
      <div className="flex justify-end gap-2 mb-6">
        <Button
          type="button"
          onClick={() => createScratchpad.mutate({ content: "" })}
          disabled={createScratchpad.isPending}
          variant="outline"
          className="border-spiritual-600 text-spiritual-600 hover:bg-spiritual-50 dark:border-spiritual-400 dark:text-spiritual-400 dark:hover:bg-spiritual-900"
          data-testid="button-create-scratchpad"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Scratchpad
        </Button>
        <Button
          type="button"
          onClick={() => setIsCreateDialogOpen(true)}
          className="bg-spiritual-600 hover:bg-spiritual-700 text-white"
          data-testid="button-create-stack"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Stack
        </Button>
      </div>

      <div className="space-y-8">
        <section aria-labelledby="dm-scratchpads-heading">
          <h2 id="dm-scratchpads-heading" className="sr-only">
            Scratchpads
          </h2>
          {scratchpadsQuery.isLoading ? (
            <div className="text-center py-6">
              <p className="text-gray-600 dark:text-gray-400">Loading scratchpads...</p>
            </div>
          ) : scratchpadsQuery.isError ? (
            <div className="text-center py-6 text-red-600 dark:text-red-400">
              Failed to load scratchpads.
            </div>
          ) : scratchpads.length === 0 ? (
            <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
              No scratchpads yet. Use “New Scratchpad” to create one.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {scratchpads.map((scratchpad) => (
                <ScratchpadCard
                  key={scratchpad.id}
                  scratchpad={scratchpad}
                  onUpdate={saveScratchpad}
                  onDelete={deleteScratchpad.mutateAsync}
                />
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="dm-stacks-heading">
          <h2 id="dm-stacks-heading" className="sr-only">
            Stacks
          </h2>
          {stacksQuery.isLoading ? (
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400">Loading stacks...</p>
            </div>
          ) : stacksQuery.isError ? (
            <div className="text-center py-12 text-red-600 dark:text-red-400">
              Failed to load stacks.
            </div>
          ) : stacks.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-spiritual-100 dark:bg-spiritual-900 rounded-full flex items-center justify-center mx-auto mb-6">
                <Plus className="w-12 h-12 text-spiritual-600 dark:text-spiritual-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                No Stacks Yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Create your first stack to begin tracking
              </p>
              <Button
                type="button"
                onClick={() => setIsCreateDialogOpen(true)}
                className="bg-spiritual-600 hover:bg-spiritual-700 text-white"
                data-testid="button-create-first-stack"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Stack
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stacks.map((stack) => (
                <StackCard
                  key={stack.id}
                  stack={stack}
                  userId={userId}
                  onEdit={setEditingStack}
                  onDelete={handleDeleteStack}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <StackFormDialog
        mode="create"
        open={isCreateDialogOpen}
        glossaryTerms={glossaryTerms}
        isPending={createStack.isPending}
        onClose={() => setIsCreateDialogOpen(false)}
        onSubmit={handleCreateStack}
      />
      <StackFormDialog
        mode="edit"
        open={Boolean(editingStack)}
        stack={editingStack}
        glossaryTerms={glossaryTerms}
        isPending={updateStack.isPending}
        onClose={() => setEditingStack(null)}
        onSubmit={handleUpdateStack}
      />
    </>
  );
}
