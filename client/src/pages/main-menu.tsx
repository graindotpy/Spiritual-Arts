import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, Moon, Sun, User, Camera, Shield, Key, Trash2, Flag, Swords } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useWebSocket } from "@/hooks/use-websocket";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import CharacterCreator from "@/components/character-creator";
import PortraitUpload from "@/components/portrait-upload";
import SpiritRollNotification from "@/components/spirit-roll-notification";
import type { Character } from "@shared/schema";

interface MainMenuProps {
  onCharacterSelect: (character: Character) => void;
}

export default function MainMenu({ onCharacterSelect }: MainMenuProps) {
  const { theme, toggleTheme } = useTheme();
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [portraitUploadId, setPortraitUploadId] = useState<string | null>(null);
  const [isDmDialogOpen, setIsDmDialogOpen] = useState(false);
  const [dmCode, setDmCode] = useState("");
  const [isAdminDialogOpen, setIsAdminDialogOpen] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isFactionDialogOpen, setIsFactionDialogOpen] = useState(false);
  const [factionCode, setFactionCode] = useState("");
  const [isCardGameDialogOpen, setIsCardGameDialogOpen] = useState(false);
  const [cardGameCode, setCardGameCode] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // WebSocket for real-time roll notifications
  const { isConnected, lastRollBroadcast } = useWebSocket();

  const { data: characters = [] } = useQuery<Character[]>({
    queryKey: ["/api/characters"],
  });

  useEffect(() => {
    const stored = localStorage.getItem("adminMode");
    if (stored === "true") {
      setIsAdminMode(true);
    }
  }, []);

  const deleteCharacterMutation = useMutation({
    mutationFn: async (characterId: string) => {
      await apiRequest("DELETE", `/api/character/${characterId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/characters"] });
      toast({
        title: "Character deleted",
        description: "The character and its glossary terms were removed.",
      });
    },
    onError: (error) => {
      console.error("Delete character error:", error);
      toast({
        title: "Failed to delete character",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCharacterSelect = (character: Character) => {
    onCharacterSelect(character);
  };

  const handleCharacterCreated = (newCharacter: Character) => {
    onCharacterSelect(newCharacter);
  };

  const handleDmCodeSubmit = () => {
    if (dmCode === "3142") {
      setLocation("/dm-space");
      setDmCode("");
      setIsDmDialogOpen(false);
    } else {
      toast({
        title: "Invalid Code",
        description: "The code you entered is incorrect",
        variant: "destructive",
      });
      setDmCode("");
    }
  };

  const handleAdminCodeSubmit = () => {
    if (adminCode === "3142") {
      setIsAdminMode(true);
      localStorage.setItem("adminMode", "true");
      setAdminCode("");
      setIsAdminDialogOpen(false);
      toast({
        title: "Admin mode enabled",
        description: "Character delete controls are now available.",
      });
    } else {
      toast({
        title: "Invalid Code",
        description: "The code you entered is incorrect",
        variant: "destructive",
      });
      setAdminCode("");
    }
  };

  const handleAdminToggle = () => {
    if (isAdminMode) {
      setIsAdminMode(false);
      localStorage.removeItem("adminMode");
      toast({
        title: "Admin mode disabled",
      });
      return;
    }
    setIsAdminDialogOpen(true);
  };

  const handleFactionCodeSubmit = () => {
    if (factionCode === "3142") {
      setLocation("/factions");
      setFactionCode("");
      setIsFactionDialogOpen(false);
    } else {
      toast({
        title: "Invalid Code",
        description: "The code you entered is incorrect",
        variant: "destructive",
      });
      setFactionCode("");
    }
  };

  const handleCardGameCodeSubmit = () => {
    if (cardGameCode === "4321") {
      setLocation("/card-game");
      setCardGameCode("");
      setIsCardGameDialogOpen(false);
    } else {
      toast({
        title: "Invalid Code",
        description: "The code you entered is incorrect",
        variant: "destructive",
      });
      setCardGameCode("");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-spiritual-700 dark:text-spiritual-400">Path Manuals</h1>
              <p className="text-lg text-gray-600 dark:text-gray-300 mt-1">Spiritual Arts Mechanics</p>
            </div>
            
            <div className="flex gap-2 items-center">
              {isAdminMode && (
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                  Admin Mode
                </span>
              )}
              <Button
                onClick={() => setIsDmDialogOpen(true)}
                variant="outline"
                size="sm"
                data-testid="button-dm-space"
              >
                <Shield className="w-4 h-4 mr-2" />
                DM Space
              </Button>
              <Button
                onClick={() => setIsFactionDialogOpen(true)}
                variant="outline"
                size="sm"
                data-testid="button-factions"
              >
                <Flag className="w-4 h-4 mr-2" />
                Factions
              </Button>
              <Button
                onClick={() => setIsCardGameDialogOpen(true)}
                variant="outline"
                size="sm"
                data-testid="button-card-game"
              >
                <Swords className="w-4 h-4 mr-2" />
                Card Game
              </Button>
              <Button
                onClick={handleAdminToggle}
                variant={isAdminMode ? "destructive" : "outline"}
                size="sm"
                data-testid="button-admin-mode"
              >
                <Key className="w-4 h-4 mr-2" />
                {isAdminMode ? "Admin On" : "Admin Mode"}
              </Button>
              <Button
                onClick={toggleTheme}
                variant="outline"
                size="sm"
                className="p-2"
                data-testid="button-theme-toggle"
              >
                {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </header>
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Select a Character
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Choose a character to view their sheet, or create a new one
          </p>
        </div>

        {/* Character Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {characters.map((character) => (
            <Card
              key={character.id}
              className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
              onClick={() => handleCharacterSelect(character)}
            >
              <CardContent className="p-6 relative">
                {isAdminMode && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="absolute top-3 right-3 h-8 px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete ${character.name}? This cannot be undone.`)) {
                        deleteCharacterMutation.mutate(character.id);
                      }
                    }}
                    data-testid={`button-delete-character-${character.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
                <div className="flex items-center mb-4">
                  <div className="relative mr-4">
                    <div className="w-12 h-12 bg-spiritual-100 dark:bg-spiritual-900 rounded-full flex items-center justify-center overflow-hidden">
                      {character.portraitUrl ? (
                        <img
                          src={character.portraitUrl}
                          alt={character.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Hide broken image and show fallback icon
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            const fallbackDiv = target.nextElementSibling as HTMLElement;
                            if (fallbackDiv) {
                              fallbackDiv.style.display = 'flex';
                            }
                          }}
                        />
                      ) : null}
                      <User 
                        className="w-6 h-6 text-spiritual-600 dark:text-spiritual-400" 
                        style={{ display: character.portraitUrl ? 'none' : 'flex' }}
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute -top-1 -right-1 w-6 h-6 p-0 rounded-full bg-white dark:bg-gray-800 shadow-sm border"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPortraitUploadId(character.id);
                      }}
                    >
                      <Camera className="w-3 h-3" />
                    </Button>
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
                
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <p className="text-spiritual-600 dark:text-spiritual-400 font-medium">
                    {character.path}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Create New Character Card */}
          <Card
            className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 border-2 border-dashed border-spiritual-300 dark:border-spiritual-600"
            onClick={() => setIsCreatorOpen(true)}
          >
            <CardContent className="p-6 flex flex-col items-center justify-center h-full min-h-[180px]">
              <div className="w-12 h-12 bg-spiritual-100 dark:bg-spiritual-900 rounded-full flex items-center justify-center mb-4">
                <Plus className="w-6 h-6 text-spiritual-600 dark:text-spiritual-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Create New Character
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                Start your spiritual journey
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Empty State */}
        {characters.length === 0 && (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-spiritual-100 dark:bg-spiritual-900 rounded-full flex items-center justify-center mx-auto mb-6">
              <User className="w-12 h-12 text-spiritual-600 dark:text-spiritual-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No Characters Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Create your first character to begin using the Spirit Die System
            </p>
            <Button
              onClick={() => setIsCreatorOpen(true)}
              className="bg-spiritual-600 hover:bg-spiritual-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Character
            </Button>
          </div>
        )}
      </main>
      {/* Character Creator Dialog */}
      <CharacterCreator
        isOpen={isCreatorOpen}
        onClose={() => setIsCreatorOpen(false)}
        onCharacterCreated={handleCharacterCreated}
      />

      {/* Portrait Upload Dialog */}
      {portraitUploadId && (
        <PortraitUpload
          characterId={portraitUploadId}
          currentPortraitUrl={characters.find(c => c.id === portraitUploadId)?.portraitUrl}
          isOpen={true}
          onClose={() => setPortraitUploadId(null)}
        />
      )}

      {/* Real-time Spirit Die Roll Notifications */}
      <SpiritRollNotification 
        rollData={lastRollBroadcast}
        currentCharacterId={undefined} // Show all rolls on main menu
      />

      {/* DM Code Protection Dialog */}
      <Dialog open={isDmDialogOpen} onOpenChange={setIsDmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>DM Space Access</DialogTitle>
            <DialogDescription>
              Enter the access code to continue to the DM Space
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="password"
              placeholder="Enter code"
              value={dmCode}
              onChange={(e) => setDmCode(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleDmCodeSubmit();
                }
              }}
              data-testid="input-dm-code"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsDmDialogOpen(false);
                setDmCode("");
              }}
              data-testid="button-cancel-dm-code"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDmCodeSubmit}
              data-testid="button-submit-dm-code"
            >
              Enter
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Faction Code Protection Dialog */}
      <Dialog open={isFactionDialogOpen} onOpenChange={setIsFactionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Faction Setup Access</DialogTitle>
            <DialogDescription>
              Enter the access code to manage factions
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="password"
              placeholder="Enter code"
              value={factionCode}
              onChange={(e) => setFactionCode(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleFactionCodeSubmit();
                }
              }}
              data-testid="input-faction-code"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsFactionDialogOpen(false);
                setFactionCode("");
              }}
              data-testid="button-cancel-faction-code"
            >
              Cancel
            </Button>
            <Button
              onClick={handleFactionCodeSubmit}
              data-testid="button-submit-faction-code"
            >
              Enter
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Card Game Code Protection Dialog */}
      <Dialog open={isCardGameDialogOpen} onOpenChange={setIsCardGameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Card Game Access</DialogTitle>
            <DialogDescription>
              Enter the access code to open Card Game
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="password"
              placeholder="Enter code"
              value={cardGameCode}
              onChange={(e) => setCardGameCode(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleCardGameCodeSubmit();
                }
              }}
              data-testid="input-card-game-code"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsCardGameDialogOpen(false);
                setCardGameCode("");
              }}
              data-testid="button-cancel-card-game-code"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCardGameCodeSubmit}
              data-testid="button-submit-card-game-code"
            >
              Enter
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Code Protection Dialog */}
      <Dialog open={isAdminDialogOpen} onOpenChange={setIsAdminDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admin Mode Access</DialogTitle>
            <DialogDescription>
              Enter the access code to enable admin mode
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="password"
              placeholder="Enter code"
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleAdminCodeSubmit();
                }
              }}
              data-testid="input-admin-code"
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsAdminDialogOpen(false);
                setAdminCode("");
              }}
              data-testid="button-cancel-admin-code"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdminCodeSubmit}
              data-testid="button-submit-admin-code"
            >
              Enter
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
