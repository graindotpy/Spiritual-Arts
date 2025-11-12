import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Edit2, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { DmStack } from "@shared/schema";

// Simple user ID generator
const getUserId = () => {
  let userId = localStorage.getItem('userId');
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('userId', userId);
  }
  return userId;
};

export default function DmSpace() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const userId = getUserId();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingStack, setEditingStack] = useState<DmStack | null>(null);
  const [formTarget, setFormTarget] = useState("");
  const [formEffect, setFormEffect] = useState("");

  // Fetch DM stacks
  const { data: stacks = [], isLoading } = useQuery<DmStack[]>({
    queryKey: ['/api/dm', userId, 'stacks'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/dm/${userId}/stacks`);
      return response.json();
    },
  });

  // Create stack mutation
  const createStack = useMutation({
    mutationFn: async (data: { target: string; effect: string }) => {
      const response = await apiRequest('POST', `/api/dm/${userId}/stacks`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dm', userId, 'stacks'] });
      setIsCreateDialogOpen(false);
      setFormTarget("");
      setFormEffect("");
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

  // Update stack mutation
  const updateStack = useMutation({
    mutationFn: async (data: { id: string; target: string; effect: string }) => {
      const response = await apiRequest('PUT', `/api/dm/stacks/${data.id}`, {
        target: data.target,
        effect: data.effect,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dm', userId, 'stacks'] });
      setEditingStack(null);
      setFormTarget("");
      setFormEffect("");
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
  });

  // Delete stack mutation
  const deleteStack = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/dm/stacks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dm', userId, 'stacks'] });
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

  const handleCreate = () => {
    if (!formTarget.trim() || !formEffect.trim()) {
      toast({
        title: "Error",
        description: "Both Target and Effect are required",
        variant: "destructive",
      });
      return;
    }
    createStack.mutate({ target: formTarget.trim(), effect: formEffect.trim() });
  };

  const handleUpdate = () => {
    if (!editingStack || !formTarget.trim() || !formEffect.trim()) {
      toast({
        title: "Error",
        description: "Both Target and Effect are required",
        variant: "destructive",
      });
      return;
    }
    updateStack.mutate({
      id: editingStack.id,
      target: formTarget.trim(),
      effect: formEffect.trim(),
    });
  };

  const openEditDialog = (stack: DmStack) => {
    setEditingStack(stack);
    setFormTarget(stack.target);
    setFormEffect(stack.effect);
  };

  const closeDialogs = () => {
    setIsCreateDialogOpen(false);
    setEditingStack(null);
    setFormTarget("");
    setFormEffect("");
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/")}
                data-testid="button-main-menu"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Main Menu
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-spiritual-700 dark:text-spiritual-400">DM Space</h1>
                <p className="text-lg text-gray-600 dark:text-gray-300 mt-1">Stack Tracker</p>
              </div>
            </div>
            
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              className="bg-spiritual-600 hover:bg-spiritual-700 text-white"
              data-testid="button-create-stack"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Stack
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">Loading stacks...</p>
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
              <Card
                key={stack.id}
                className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg text-spiritual-700 dark:text-spiritual-400">
                      Stack #{stack.id.slice(0, 8)}
                    </CardTitle>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditDialog(stack)}
                        data-testid={`button-edit-stack-${stack.id}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteStack.mutate(stack.id)}
                        data-testid={`button-delete-stack-${stack.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Target
                    </h4>
                    <p className="text-gray-900 dark:text-white whitespace-pre-line">
                      {stack.target}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Effect
                    </h4>
                    <p className="text-gray-900 dark:text-white whitespace-pre-line">
                      {stack.effect}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Create Stack Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Stack</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Target
              </label>
              <Textarea
                value={formTarget}
                onChange={(e) => setFormTarget(e.target.value)}
                placeholder="Enter target description..."
                rows={3}
                className="bg-white dark:bg-gray-700"
                data-testid="textarea-stack-target"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Effect
              </label>
              <Textarea
                value={formEffect}
                onChange={(e) => setFormEffect(e.target.value)}
                placeholder="Enter effect description..."
                rows={3}
                className="bg-white dark:bg-gray-700"
                data-testid="textarea-stack-effect"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={closeDialogs}
              data-testid="button-cancel-create"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createStack.isPending}
              data-testid="button-save-create"
            >
              {createStack.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Stack Dialog */}
      <Dialog open={!!editingStack} onOpenChange={(open) => !open && closeDialogs()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Stack</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Target
              </label>
              <Textarea
                value={formTarget}
                onChange={(e) => setFormTarget(e.target.value)}
                placeholder="Enter target description..."
                rows={3}
                className="bg-white dark:bg-gray-700"
                data-testid="textarea-edit-stack-target"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Effect
              </label>
              <Textarea
                value={formEffect}
                onChange={(e) => setFormEffect(e.target.value)}
                placeholder="Enter effect description..."
                rows={3}
                className="bg-white dark:bg-gray-700"
                data-testid="textarea-edit-stack-effect"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={closeDialogs}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateStack.isPending}
              data-testid="button-save-edit"
            >
              {updateStack.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
