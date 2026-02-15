import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Edit2, ArrowLeft, BookOpen, ChevronUp, ChevronDown, Sparkles, User, LayoutGrid } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import CharacterCreator from "@/components/character-creator";
import TooltipText from "@/components/tooltip-text";
import ExpandedTooltipDialog from "@/components/expanded-tooltip-dialog";
import { dmGlossaryScope } from "@/hooks/use-glossary";
import type { DmStack, DmGlossaryTerm, DmScratchpad, Character } from "@shared/schema";

// Simple user ID generator
const getUserId = () => {
  let userId = localStorage.getItem('userId');
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('userId', userId);
  }
  return userId;
};

// Scratchpad card component with debounced save
function ScratchpadCard({ 
  scratchpad, 
  onUpdate, 
  onDelete 
}: { 
  scratchpad: DmScratchpad; 
  onUpdate: (data: { id: string; title?: string; content?: string }) => void;
  onDelete: (id: string) => void;
}) {
  const [localTitle, setLocalTitle] = useState(scratchpad.title || "Scratchpad");
  const [localContent, setLocalContent] = useState(scratchpad.content);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  
  // Sync local state with prop changes (when server data refreshes)
  useEffect(() => {
    setLocalTitle(scratchpad.title || "Scratchpad");
  }, [scratchpad.title]);
  
  useEffect(() => {
    setLocalContent(scratchpad.content);
  }, [scratchpad.content]);
  
  // Debounced save for content
  useEffect(() => {
    if (localContent === scratchpad.content) return;
    
    const timer = setTimeout(() => {
      onUpdate({ id: scratchpad.id, content: localContent });
    }, 500);
    
    return () => clearTimeout(timer);
  }, [localContent, scratchpad.content, scratchpad.id, onUpdate]);
  
  // Debounced save for title
  useEffect(() => {
    if (localTitle === scratchpad.title) return;
    
    const timer = setTimeout(() => {
      onUpdate({ id: scratchpad.id, title: localTitle });
    }, 500);
    
    return () => clearTimeout(timer);
  }, [localTitle, scratchpad.title, scratchpad.id, onUpdate]);
  
  return (
    <Card
      className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
      data-testid={`card-scratchpad-${scratchpad.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          {isEditingTitle ? (
            <Input
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={() => setIsEditingTitle(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setIsEditingTitle(false);
                }
              }}
              autoFocus
              className="text-lg font-semibold"
              data-testid={`input-scratchpad-title-${scratchpad.id}`}
            />
          ) : (
            <CardTitle 
              className="text-lg text-spiritual-700 dark:text-spiritual-400 cursor-pointer hover:opacity-70"
              onClick={() => setIsEditingTitle(true)}
              data-testid={`title-scratchpad-${scratchpad.id}`}
            >
              {localTitle}
            </CardTitle>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(scratchpad.id)}
            data-testid={`button-delete-scratchpad-${scratchpad.id}`}
          >
            <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Textarea
          value={localContent}
          onChange={(e) => setLocalContent(e.target.value)}
          placeholder="Enter your notes here..."
          rows={8}
          className="bg-white dark:bg-gray-700 resize-none"
          data-testid={`textarea-scratchpad-${scratchpad.id}`}
        />
      </CardContent>
    </Card>
  );
}

export default function DmSpace() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const userId = getUserId();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingStack, setEditingStack] = useState<DmStack | null>(null);
  const [formName, setFormName] = useState("");
  const [formTarget, setFormTarget] = useState("");
  const [formEffect, setFormEffect] = useState("");
  
  // Counter state for each stack (visual only)
  const [stackCounters, setStackCounters] = useState<Record<string, number>>({});
  
  // Autocomplete state
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [filteredGlossary, setFilteredGlossary] = useState<DmGlossaryTerm[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const effectTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Glossary state
  const [isGlossaryDialogOpen, setIsGlossaryDialogOpen] = useState(false);
  const [editingGlossaryTerm, setEditingGlossaryTerm] = useState<DmGlossaryTerm | null>(null);
  const [expandedGlossaryTerm, setExpandedGlossaryTerm] = useState<DmGlossaryTerm | null>(null);
  const [formKeyword, setFormKeyword] = useState("");
  const [formDefinition, setFormDefinition] = useState("");
  const [isCharacterCreatorOpen, setIsCharacterCreatorOpen] = useState(false);

  // Fetch DM stacks
  const { data: stacks = [], isLoading } = useQuery<DmStack[]>({
    queryKey: ['/api/dm', userId, 'stacks'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/dm/${userId}/stacks`);
      return response.json();
    },
  });

  // Fetch DM glossary
  const { data: glossaryTerms = [], isLoading: isLoadingGlossary } = useQuery<DmGlossaryTerm[]>({
    queryKey: ['/api/dm', userId, 'glossary'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/dm/${userId}/glossary`);
      return response.json();
    },
  });

  // Fetch DM scratchpads
  const { data: scratchpads = [], isLoading: isLoadingScratchpads } = useQuery<DmScratchpad[]>({
    queryKey: ['/api/dm', userId, 'scratchpads'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/dm/${userId}/scratchpads`);
      return response.json();
    },
  });

  // Fetch DM-only characters
  const { data: dmCharacters = [], isLoading: isLoadingCharacters } = useQuery<Character[]>({
    queryKey: ['/api/dm', userId, 'characters'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/dm/${userId}/characters`);
      return response.json();
    },
  });

  // Delete DM character mutation
  const deleteCharacter = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/character/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dm', userId, 'characters'] });
      toast({
        title: "Success",
        description: "Character deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete character",
        variant: "destructive",
      });
    },
  });

  // Create stack mutation
  const createStack = useMutation({
    mutationFn: async (data: { name: string; target: string; effect: string }) => {
      const response = await apiRequest('POST', `/api/dm/${userId}/stacks`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dm', userId, 'stacks'] });
      setIsCreateDialogOpen(false);
      setFormName("");
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
    mutationFn: async (data: { id: string; name: string; target: string; effect: string }) => {
      const response = await apiRequest('PUT', `/api/dm/stacks/${data.id}`, {
        name: data.name,
        target: data.target,
        effect: data.effect,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dm', userId, 'stacks'] });
      setEditingStack(null);
      setFormName("");
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

  // Create glossary term mutation
  const createGlossaryTerm = useMutation({
    mutationFn: async (data: { keyword: string; definition: string }) => {
      const response = await apiRequest('POST', `/api/dm/${userId}/glossary`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dm', userId, 'glossary'] });
      setIsGlossaryDialogOpen(false);
      setFormKeyword("");
      setFormDefinition("");
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

  // Update glossary term mutation
  const updateGlossaryTerm = useMutation({
    mutationFn: async (data: { id: string; keyword: string; definition: string }) => {
      const response = await apiRequest('PUT', `/api/dm/glossary/${data.id}`, {
        keyword: data.keyword,
        definition: data.definition,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dm', userId, 'glossary'] });
      setEditingGlossaryTerm(null);
      setFormKeyword("");
      setFormDefinition("");
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

  // Delete glossary term mutation
  const deleteGlossaryTerm = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/dm/glossary/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dm', userId, 'glossary'] });
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

  // Create scratchpad mutation
  const createScratchpad = useMutation({
    mutationFn: async (data: { title?: string; content: string }) => {
      const response = await apiRequest('POST', `/api/dm/${userId}/scratchpads`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dm', userId, 'scratchpads'] });
    },
  });

  // Update scratchpad mutation
  const updateScratchpad = useMutation({
    mutationFn: async (data: { id: string; title?: string; content?: string }) => {
      const response = await apiRequest('PUT', `/api/dm/scratchpads/${data.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dm', userId, 'scratchpads'] });
    },
  });

  // Delete scratchpad mutation
  const deleteScratchpad = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/dm/scratchpads/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dm', userId, 'scratchpads'] });
    },
  });

  const handleCreate = () => {
    if (!formName.trim() || !formTarget.trim() || !formEffect.trim()) {
      toast({
        title: "Error",
        description: "Name, Target and Effect are required",
        variant: "destructive",
      });
      return;
    }
    createStack.mutate({ name: formName.trim(), target: formTarget.trim(), effect: formEffect.trim() });
  };

  const handleUpdate = () => {
    if (!editingStack || !formName.trim() || !formTarget.trim() || !formEffect.trim()) {
      toast({
        title: "Error",
        description: "Name, Target and Effect are required",
        variant: "destructive",
      });
      return;
    }
    updateStack.mutate({
      id: editingStack.id,
      name: formName.trim(),
      target: formTarget.trim(),
      effect: formEffect.trim(),
    });
  };

  const openEditDialog = (stack: DmStack) => {
    setEditingStack(stack);
    setFormName(stack.name);
    setFormTarget(stack.target);
    setFormEffect(stack.effect);
  };

  const closeDialogs = () => {
    setIsCreateDialogOpen(false);
    setEditingStack(null);
    setFormName("");
    setFormTarget("");
    setFormEffect("");
    setShowAutocomplete(false);
  };

  const handleCreateGlossary = () => {
    if (!formKeyword.trim() || !formDefinition.trim()) {
      toast({
        title: "Error",
        description: "Both Keyword and Definition are required",
        variant: "destructive",
      });
      return;
    }
    createGlossaryTerm.mutate({ keyword: formKeyword.trim(), definition: formDefinition.trim() });
  };

  const handleUpdateGlossary = () => {
    if (!editingGlossaryTerm || !formKeyword.trim() || !formDefinition.trim()) {
      toast({
        title: "Error",
        description: "Both Keyword and Definition are required",
        variant: "destructive",
      });
      return;
    }
    updateGlossaryTerm.mutate({
      id: editingGlossaryTerm.id,
      keyword: formKeyword.trim(),
      definition: formDefinition.trim(),
    });
  };

  const openGlossaryEditDialog = (term: DmGlossaryTerm) => {
    setEditingGlossaryTerm(term);
    setFormKeyword(term.keyword);
    setFormDefinition(term.definition);
  };

  const closeGlossaryDialogs = () => {
    setIsGlossaryDialogOpen(false);
    setEditingGlossaryTerm(null);
    setFormKeyword("");
    setFormDefinition("");
  };

  const incrementCounter = (stackId: string) => {
    setStackCounters(prev => ({
      ...prev,
      [stackId]: (prev[stackId] || 0) + 1
    }));
  };

  const decrementCounter = (stackId: string) => {
    setStackCounters(prev => ({
      ...prev,
      [stackId]: Math.max((prev[stackId] || 0) - 1, 0)
    }));
  };

  // Autocomplete handlers
  const handleEffectChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setFormEffect(value);
    
    const cursorPos = e.target.selectionStart || 0;
    setCursorPosition(cursorPos);
    
    // Get the word being typed at cursor position
    const textBeforeCursor = value.slice(0, cursorPos);
    const words = textBeforeCursor.split(/\s+/);
    const currentWord = words[words.length - 1];
    
    // Show autocomplete if typing a word (at least 1 character)
    if (currentWord && currentWord.length > 0) {
      const matches = glossaryTerms.filter(term =>
        term.keyword.toLowerCase().startsWith(currentWord.toLowerCase())
      );
      
      if (matches.length > 0) {
        setFilteredGlossary(matches);
        setShowAutocomplete(true);
      } else {
        setShowAutocomplete(false);
      }
    } else {
      setShowAutocomplete(false);
    }
  };

  const insertGlossaryTerm = (term: DmGlossaryTerm) => {
    if (!effectTextareaRef.current) return;
    
    const textarea = effectTextareaRef.current;
    const value = formEffect;
    const cursorPos = cursorPosition;
    
    // Find the start of the current word
    const textBeforeCursor = value.slice(0, cursorPos);
    const words = textBeforeCursor.split(/\s+/);
    const currentWord = words[words.length - 1];
    const wordStart = cursorPos - currentWord.length;
    
    // Replace the current word with the glossary term
    const newValue = value.slice(0, wordStart) + term.keyword + value.slice(cursorPos);
    setFormEffect(newValue);
    setShowAutocomplete(false);
    
    // Set cursor position after inserted term
    setTimeout(() => {
      const newCursorPos = wordStart + term.keyword.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
      textarea.focus();
    }, 0);
  };

  // Close autocomplete when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (effectTextareaRef.current && !effectTextareaRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        // Don't close if clicking on autocomplete dropdown
        if (!target.closest('[data-autocomplete-dropdown]')) {
          setShowAutocomplete(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
                <p className="text-lg text-gray-600 dark:text-gray-300 mt-1">Manage Stacks & Glossary</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/card-game")}
              data-testid="button-card-game"
            >
              <LayoutGrid className="w-4 h-4 mr-2" />
              Card Game
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="stacks" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-3 mb-8">
            <TabsTrigger value="stacks" data-testid="tab-stacks">
              Stack Tracker
            </TabsTrigger>
            <TabsTrigger value="characters" data-testid="tab-characters">
              <User className="w-4 h-4 mr-2" />
              Characters
            </TabsTrigger>
            <TabsTrigger value="glossary" data-testid="tab-glossary">
              <BookOpen className="w-4 h-4 mr-2" />
              Glossary
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stacks">
            <div className="flex justify-end gap-2 mb-6">
              <Button
                onClick={() => createScratchpad.mutate({ content: "" })}
                variant="outline"
                className="border-spiritual-600 text-spiritual-600 hover:bg-spiritual-50 dark:border-spiritual-400 dark:text-spiritual-400 dark:hover:bg-spiritual-900"
                data-testid="button-create-scratchpad"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Scratchpad
              </Button>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="bg-spiritual-600 hover:bg-spiritual-700 text-white"
                data-testid="button-create-stack"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Stack
              </Button>
            </div>

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
                {scratchpads.map((scratchpad) => (
                  <ScratchpadCard
                    key={scratchpad.id}
                    scratchpad={scratchpad}
                    onUpdate={(data) => updateScratchpad.mutate(data)}
                    onDelete={(id) => deleteScratchpad.mutate(id)}
                  />
                ))}
                {stacks.map((stack) => (
                  <Card
                    key={stack.id}
                    className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                    data-testid={`card-stack-${stack.id}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg text-spiritual-700 dark:text-spiritual-400">
                          {stack.name}
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
                      
                      {/* Counter */}
                      <div className="flex items-center justify-center py-2">
                        <div className="flex flex-col items-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => incrementCounter(stack.id)}
                            className="h-6 w-6 p-0"
                            data-testid={`button-increment-${stack.id}`}
                          >
                            <ChevronUp className="w-4 h-4" />
                          </Button>
                          <span className="text-2xl font-bold text-spiritual-700 dark:text-spiritual-400 my-1">
                            {stackCounters[stack.id] || 0}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => decrementCounter(stack.id)}
                            className="h-6 w-6 p-0"
                            data-testid={`button-decrement-${stack.id}`}
                          >
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Effect
                        </h4>
                        <TooltipText
                          text={stack.effect}
                          entityId={userId}
                          scope={dmGlossaryScope}
                          className="text-gray-900 dark:text-white"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="characters">
            <div className="flex justify-end mb-6">
              <Button
                onClick={() => setIsCharacterCreatorOpen(true)}
                className="bg-spiritual-600 hover:bg-spiritual-700 text-white"
                data-testid="button-dm-create-character"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Character
              </Button>
            </div>

            {isLoadingCharacters ? (
              <div className="text-center py-12">
                <p className="text-gray-600 dark:text-gray-400">Loading characters...</p>
              </div>
            ) : dmCharacters.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-24 h-24 bg-spiritual-100 dark:bg-spiritual-900 rounded-full flex items-center justify-center mx-auto mb-6">
                  <User className="w-12 h-12 text-spiritual-600 dark:text-spiritual-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  No DM Characters Yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Create a DM-only character for private reference
                </p>
                <Button
                  onClick={() => setIsCharacterCreatorOpen(true)}
                  className="bg-spiritual-600 hover:bg-spiritual-700 text-white"
                  data-testid="button-dm-create-first-character"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First DM Character
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {dmCharacters.map((character) => (
                  <Card
                    key={character.id}
                    className="cursor-pointer bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                    onClick={() => {
                      sessionStorage.setItem("returnTo", "/dm-space");
                      setLocation(`/character/${character.id}?from=dm`);
                    }}
                    data-testid={`card-dm-character-${character.id}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-spiritual-100 dark:bg-spiritual-900 rounded-full flex items-center justify-center mr-3">
                            <User className="w-5 h-5 text-spiritual-600 dark:text-spiritual-400" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                              {character.name}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Level {character.level}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete ${character.name}? This cannot be undone.`)) {
                              deleteCharacter.mutate(character.id);
                            }
                          }}
                          data-testid={`button-delete-dm-character-${character.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </Button>
                      </div>
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                        <p className="text-spiritual-600 dark:text-spiritual-400 font-medium">
                          {character.path}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="glossary">
            <div className="flex justify-end mb-6">
              <Button
                onClick={() => setIsGlossaryDialogOpen(true)}
                className="bg-spiritual-600 hover:bg-spiritual-700 text-white"
                data-testid="button-create-glossary"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Glossary Term
              </Button>
            </div>

            {isLoadingGlossary ? (
              <div className="text-center py-12">
                <p className="text-gray-600 dark:text-gray-400">Loading glossary terms...</p>
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
                  onClick={() => setIsGlossaryDialogOpen(true)}
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
                            size="sm"
                            variant="ghost"
                            onClick={() => setExpandedGlossaryTerm(term)}
                            data-testid={`button-enhanced-glossary-${term.id}`}
                            title="Edit Enhanced Content"
                          >
                            <Sparkles className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openGlossaryEditDialog(term)}
                            data-testid={`button-edit-glossary-${term.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteGlossaryTerm.mutate(term.id)}
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
          </TabsContent>
        </Tabs>
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
                Name
              </label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Enter stack name..."
                className="bg-white dark:bg-gray-700"
                data-testid="input-stack-name"
              />
            </div>
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
            <div className="relative">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Effect
              </label>
              <Textarea
                ref={effectTextareaRef}
                value={formEffect}
                onChange={handleEffectChange}
                placeholder="Enter effect description..."
                rows={3}
                className="bg-white dark:bg-gray-700"
                data-testid="textarea-stack-effect"
              />
              {showAutocomplete && filteredGlossary.length > 0 && (
                <div
                  data-autocomplete-dropdown
                  className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto"
                >
                  {filteredGlossary.map((term) => (
                    <button
                      key={term.id}
                      type="button"
                      onClick={() => insertGlossaryTerm(term)}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                      data-testid={`autocomplete-item-${term.id}`}
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
                Name
              </label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Enter stack name..."
                className="bg-white dark:bg-gray-700"
                data-testid="input-edit-stack-name"
              />
            </div>
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
            <div className="relative">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Effect
              </label>
              <Textarea
                ref={effectTextareaRef}
                value={formEffect}
                onChange={handleEffectChange}
                placeholder="Enter effect description..."
                rows={3}
                className="bg-white dark:bg-gray-700"
                data-testid="textarea-edit-stack-effect"
              />
              {showAutocomplete && filteredGlossary.length > 0 && (
                <div
                  data-autocomplete-dropdown
                  className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto"
                >
                  {filteredGlossary.map((term) => (
                    <button
                      key={term.id}
                      type="button"
                      onClick={() => insertGlossaryTerm(term)}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                      data-testid={`autocomplete-item-edit-${term.id}`}
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

      {/* Create Glossary Term Dialog */}
      <Dialog open={isGlossaryDialogOpen} onOpenChange={setIsGlossaryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Glossary Term</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Keyword
              </label>
              <Input
                value={formKeyword}
                onChange={(e) => setFormKeyword(e.target.value)}
                placeholder="Enter keyword..."
                className="bg-white dark:bg-gray-700"
                data-testid="input-glossary-keyword"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Definition
              </label>
              <Textarea
                value={formDefinition}
                onChange={(e) => setFormDefinition(e.target.value)}
                placeholder="Enter definition..."
                rows={4}
                className="bg-white dark:bg-gray-700"
                data-testid="textarea-glossary-definition"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={closeGlossaryDialogs}
              data-testid="button-cancel-create-glossary"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateGlossary}
              disabled={createGlossaryTerm.isPending}
              data-testid="button-save-create-glossary"
            >
              {createGlossaryTerm.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Glossary Term Dialog */}
      <Dialog open={!!editingGlossaryTerm} onOpenChange={(open) => !open && closeGlossaryDialogs()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Glossary Term</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Keyword
              </label>
              <Input
                value={formKeyword}
                onChange={(e) => setFormKeyword(e.target.value)}
                placeholder="Enter keyword..."
                className="bg-white dark:bg-gray-700"
                data-testid="input-edit-glossary-keyword"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Definition
              </label>
              <Textarea
                value={formDefinition}
                onChange={(e) => setFormDefinition(e.target.value)}
                placeholder="Enter definition..."
                rows={4}
                className="bg-white dark:bg-gray-700"
                data-testid="textarea-edit-glossary-definition"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={closeGlossaryDialogs}
              data-testid="button-cancel-edit-glossary"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateGlossary}
              disabled={updateGlossaryTerm.isPending}
              data-testid="button-save-edit-glossary"
            >
              {updateGlossaryTerm.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Enhanced Content Dialog */}
      {expandedGlossaryTerm && (
        <ExpandedTooltipDialog
          open={!!expandedGlossaryTerm}
          onClose={() => setExpandedGlossaryTerm(null)}
          term={expandedGlossaryTerm}
          entityId={userId}
          scope={dmGlossaryScope}
        />
      )}

      <CharacterCreator
        isOpen={isCharacterCreatorOpen}
        onClose={() => setIsCharacterCreatorOpen(false)}
        createUrl={`/api/dm/${userId}/characters`}
        onCharacterCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/dm', userId, 'characters'] });
          toast({
            title: "Success",
            description: "Character created successfully",
          });
        }}
      />
    </div>
  );
}
