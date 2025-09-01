import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Home, Moon, Sun, TrendingUp, BookOpen } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import SpiritDiePoolComponent from "@/components/spirit-die-pool";
import TechniqueCard from "@/components/technique-card";
import TechniqueEditor from "@/components/technique-editor";
import SpiritDieOverride from "@/components/spirit-die-override";
import EditableCharacterHeader from "@/components/editable-character-header";
import LevelEditor from "@/components/level-editor";
import GlossaryDialog from "@/components/glossary-dialog";
import { useTheme } from "@/components/theme-provider";
import { useCharacterState } from "@/hooks/use-character-state";
import { useWebSocket } from "@/hooks/use-websocket";
import SpiritRollNotification from "@/components/spirit-roll-notification";
import RollResultNotification from "@/components/roll-result-notification";
import TrackerComponent from "@/components/tracker";
import TrackerDialog from "@/components/tracker-dialog";
import { SPIRIT_DIE_PROGRESSION } from "@shared/schema";
import type { Character, Technique, SpiritDiePool, DieSize, Tracker } from "@shared/schema";

interface CharacterSheetProps {
  character: Character;
  onReturnToMenu: () => void;
}

export default function CharacterSheet({ character, onReturnToMenu }: CharacterSheetProps) {
  const { theme, toggleTheme } = useTheme();
  const [selectedDieIndex, setSelectedDieIndex] = useState<number | null>(null);
  const [selectedTechnique, setSelectedTechnique] = useState<string | null>(null);
  const [selectedSP, setSelectedSP] = useState<number>(0);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTechnique, setEditingTechnique] = useState<Technique | null>(null);
  const [isOverrideOpen, setIsOverrideOpen] = useState(false);
  const [isLevelEditorOpen, setIsLevelEditorOpen] = useState(false);
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(false);
  const [isTrackerDialogOpen, setIsTrackerDialogOpen] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [rollResult, setRollResult] = useState<number | null>(null);
  const [rollSuccess, setRollSuccess] = useState<boolean>(true);
  const [showResultNotification, setShowResultNotification] = useState(false);

  // WebSocket for real-time roll notifications
  const { isConnected, lastRollBroadcast } = useWebSocket();

  // Fetch fresh character data to ensure we have the latest level
  const { data: freshCharacter } = useQuery<Character>({
    queryKey: ["/api/character", character.id],
  });

  // Use fresh character data if available, fallback to prop
  const currentCharacter = freshCharacter || character;

  const { data: spiritDiePool } = useQuery<SpiritDiePool>({
    queryKey: ["/api/character", currentCharacter.id, "spirit-die-pool"],
  });

  const techniquesQuery = useQuery<Technique[]>({
    queryKey: ["/api/character", currentCharacter.id, "techniques"],
  });
  const techniques = techniquesQuery.data || [];

  const trackersQuery = useQuery<Tracker[]>({
    queryKey: ["/api/character", currentCharacter.id, "trackers"],
  });
  const trackers = trackersQuery.data || [];

  const {
    updateSpiritDiePool,
    rollSpiritedie
  } = useCharacterState(currentCharacter.id);

  const { toast } = useToast();

  // Delete tracker mutation
  const deleteTrackerMutation = useMutation({
    mutationFn: async (trackerId: string) => {
      const response = await apiRequest('DELETE', `/api/trackers/${trackerId}`);
      return response.json();
    },
    onSuccess: () => {
      trackersQuery.refetch();
      toast({ title: "Tracker deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete tracker", variant: "destructive" });
    }
  });

  // Delete technique mutation
  const deleteTechniqueMutation = useMutation({
    mutationFn: async (techniqueId: string) => {
      const response = await fetch(`/api/techniques/${techniqueId}`, { 
        method: "DELETE",
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error(`Failed to delete technique: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      techniquesQuery.refetch();
      toast({ title: "Technique deleted successfully" });
    },
    onError: (error) => {
      console.error('Delete error:', error);
      toast({ title: "Failed to delete technique", variant: "destructive" });
    }
  });

  // Get level-based dice or use override
  const levelBasedDice = SPIRIT_DIE_PROGRESSION[currentCharacter.level] || ['d4'];
  const isUsingOverride = spiritDiePool?.overrideDice !== null;
  const currentDice = spiritDiePool?.currentDice as DieSize[] || levelBasedDice;
  // Original dice should always be level-based unless there's an explicit override
  const originalDice = isUsingOverride ? (spiritDiePool?.overrideDice as DieSize[] || levelBasedDice) : levelBasedDice as DieSize[];

  // Auto-select first die if none selected and dice are available
  if (selectedDieIndex === null && currentDice.length > 0) {
    setSelectedDieIndex(0);
  }

  // Reset selection if die no longer exists
  if (selectedDieIndex !== null && selectedDieIndex >= currentDice.length) {
    setSelectedDieIndex(currentDice.length > 0 ? 0 : null);
  }

  // Global cleanup to ensure page scrolling is always restored
  useEffect(() => {
    const cleanup = () => {
      document.body.style.overflow = 'unset';
    };

    // Cleanup on window focus/blur events
    window.addEventListener('blur', cleanup);
    window.addEventListener('beforeunload', cleanup);
    
    return () => {
      cleanup();
      window.removeEventListener('blur', cleanup);
      window.removeEventListener('beforeunload', cleanup);
    };
  }, []);



  const handleDiceOverride = async (dice: DieSize[]) => {
    await updateSpiritDiePool.mutateAsync({
      currentDice: dice,
      overrideDice: dice
    });
  };

  const handleResetToLevel = async () => {
    const levelDice = SPIRIT_DIE_PROGRESSION[character.level] || ['d4'];
    await updateSpiritDiePool.mutateAsync({
      currentDice: levelDice,
      overrideDice: null
    });
  };

  const handleTechniqueSelect = (techniqueId: string, sp: number) => {
    // Select the technique and SP level for rolling later
    setSelectedTechnique(techniqueId);
    setSelectedSP(sp);
  };

  const handleRollButtonClick = async () => {
    if (selectedTechnique && selectedSP > 0 && selectedDieIndex !== null) {
      setIsRolling(true);
      try {
        const result = await rollSpiritedie.mutateAsync({ 
          spInvestment: selectedSP,
          dieIndex: selectedDieIndex 
        });
        setRollResult(result.value);
        setRollSuccess(result.success);
        
        // Stop rolling after animation completes and show result notification
        setTimeout(() => {
          setIsRolling(false);
          setShowResultNotification(true);
          
          // Hide result notification after 1 second
          setTimeout(() => {
            setShowResultNotification(false);
            setRollResult(null);
          }, 1000);
        }, 1500); // Updated to match new animation duration
      } catch (error) {
        setIsRolling(false);
        setRollResult(null);
        setShowResultNotification(false);
      }
    }
  };

  const handleDieSelect = (index: number) => {
    setSelectedDieIndex(index);
  };

  const handleDieRestore = async (index: number) => {
    // Create a copy of current dice array
    const newDice = [...currentDice];
    
    // Increase die by one step in progression (e.g., depleted -> d4, d4 -> d6, etc.)
    if (index < currentDice.length) {
      const currentDie = currentDice[index];
      const originalDie = originalDice[index];
      
      // Define the progression sequence including depleted
      const progression: (DieSize | "depleted")[] = ["depleted", "d4", "d6", "d8", "d10", "d12"];
      
      // Find current position and move one step up
      const currentIndex = progression.indexOf(currentDie);
      const originalIndex = progression.indexOf(originalDie as DieSize);
      
      if (currentIndex >= 0 && currentIndex < originalIndex && currentIndex < progression.length - 1) {
        newDice[index] = progression[currentIndex + 1] as DieSize;
        
        await updateSpiritDiePool.mutateAsync({
          currentDice: newDice
        });
      }
    }
  };

  const handleRestoreAll = async () => {
    // Long rest fully resets all dice to their maximum possible values
    await updateSpiritDiePool.mutateAsync({
      currentDice: originalDice
    });
  };

  const handleEditTechnique = (technique: Technique) => {
    setEditingTechnique(technique);
    setIsEditorOpen(true);
  };

  const handleDeleteTechnique = (techniqueId: string) => {
    deleteTechniqueMutation.mutate(techniqueId);
  };

  const handleAddTechnique = () => {
    setEditingTechnique(null);
    setIsEditorOpen(true);
  };

  // Remove selected technique data since we no longer track selection

  if (!character) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-spiritual-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading character sheet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                onClick={onReturnToMenu}
                variant="outline"
                size="sm"
                className="flex items-center border-spiritual-600 text-spiritual-600 hover:bg-spiritual-50 dark:border-spiritual-400 dark:text-spiritual-400 dark:hover:bg-spiritual-900"
              >
                <Home className="w-4 h-4 mr-2" />
                Main Menu
              </Button>
              
              <div>
                <h1 className="text-2xl font-bold text-spiritual-700 dark:text-spiritual-400">
                  {currentCharacter.name}
                </h1>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {currentCharacter.path} • Level {currentCharacter.level}
                  </p>
                  <Button
                    onClick={() => setIsLevelEditorOpen(true)}
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                  >
                    <TrendingUp className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                </div>
              </div>
            </div>
            
            <Button
              onClick={toggleTheme}
              variant="outline"
              size="sm"
              className="p-2"
            >
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Character Info & Spirit Die Pool */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
              <SpiritDiePoolComponent
                currentDice={currentDice}
                originalDice={originalDice}
                selectedDieIndex={selectedDieIndex}
                onDieSelect={handleDieSelect}
                onDieRestore={handleDieRestore}
                onRestoreAll={handleRestoreAll}
                isUsingOverride={isUsingOverride}
                onOverride={() => setIsOverrideOpen(true)}
                onResetToLevel={handleResetToLevel}
                isRolling={isRolling}
                rollResult={rollResult}
              />
              
              {/* Big ROLL Button */}
              {selectedTechnique && selectedSP > 0 && selectedDieIndex !== null && (
                <div className="mt-6 flex justify-center">
                  <Button
                    onClick={handleRollButtonClick}
                    disabled={isRolling}
                    size="lg"
                    className="bg-spiritual-600 hover:bg-spiritual-700 text-white font-bold py-4 px-12 text-xl shadow-lg transform transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:scale-100"
                  >
                    {isRolling ? "ROLLING..." : "ROLL"}
                  </Button>
                </div>
              )}
              
              {/* Trackers Section */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Trackers</h3>
                  <Button
                    size="sm"
                    onClick={() => setIsTrackerDialogOpen(true)}
                    className="bg-spiritual-600 hover:bg-spiritual-700 text-white"
                    data-testid="button-add-tracker"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {trackers.map((tracker) => (
                    <TrackerComponent
                      key={tracker.id}
                      tracker={tracker}
                      onDelete={(id) => deleteTrackerMutation.mutate(id)}
                    />
                  ))}
                  
                  {trackers.length === 0 && (
                    <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                      No trackers yet. Click + to add one.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Middle Column - Techniques */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Techniques</h2>
              <div className="flex gap-2">
                <Button 
                  onClick={() => setIsGlossaryOpen(true)} 
                  variant="outline"
                  className="border-spiritual-600 text-spiritual-600 hover:bg-spiritual-50 dark:border-spiritual-400 dark:text-spiritual-400 dark:hover:bg-spiritual-900"
                >
                  <BookOpen className="w-5 h-5 mr-2" />
                  Glossary
                </Button>
                <Button
                  onClick={handleAddTechnique}
                  className="bg-spiritual-600 hover:bg-spiritual-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Technique
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {techniquesQuery.isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-spiritual-600"></div>
                  <span className="ml-3 text-gray-600 dark:text-gray-400">Loading techniques...</span>
                </div>
              ) : (
                techniques.map((technique) => (
                  <TechniqueCard
                    key={technique.id}
                    technique={technique}
                    isSelected={selectedTechnique === technique.id}
                    selectedSP={selectedTechnique === technique.id ? selectedSP : undefined}
                    onSelect={handleTechniqueSelect}
                    onEdit={() => handleEditTechnique(technique)}
                    onDelete={handleDeleteTechnique}
                  />
                ))
              )}
              
              {!techniquesQuery.isLoading && techniques.length === 0 && (
                <Card>
                  <CardContent className="text-center py-12">
                    <p className="text-gray-500 dark:text-gray-400">
                      No techniques yet. Click "Add Technique" to create your first one.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>

        {/* Dialogs */}
        <TechniqueEditor
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          technique={editingTechnique}
          characterId={currentCharacter.id}
        />

        <SpiritDieOverride
          isOpen={isOverrideOpen}
          onClose={() => setIsOverrideOpen(false)}
          currentDice={originalDice}
          onSave={handleDiceOverride}
        />

        {/* Level Editor Dialog */}
        <LevelEditor
          character={currentCharacter}
          isOpen={isLevelEditorOpen}
          onClose={() => setIsLevelEditorOpen(false)}
        />
        
        {/* Glossary Dialog */}
        <GlossaryDialog
          open={isGlossaryOpen}
          characterId={currentCharacter.id}
          onClose={() => setIsGlossaryOpen(false)}
        />
        
        {/* Tracker Dialog */}
        <TrackerDialog
          isOpen={isTrackerDialogOpen}
          onClose={() => setIsTrackerDialogOpen(false)}
          characterId={currentCharacter.id}
        />

      </main>

      {/* Real-time Spirit Die Roll Notifications */}
      <SpiritRollNotification 
        rollData={lastRollBroadcast}
        currentCharacterId={currentCharacter.id}
      />

      {/* Roll Result Notification */}
      <RollResultNotification
        result={rollResult}
        success={rollSuccess}
        isVisible={showResultNotification}
      />
    </div>
  );
}
