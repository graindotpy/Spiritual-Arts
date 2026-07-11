import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Flag,
  KeyRound,
  Moon,
  Plus,
  Shield,
  Sun,
  Swords,
  User,
} from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import CharacterCreator from "@/components/character-creator";
import PortraitUpload from "@/components/portrait-upload";
import SpiritRollNotification from "@/components/spirit-roll-notification";
import { useTheme } from "@/components/theme-provider";
import { CharacterCard } from "@/features/main-menu/character-card";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { requestJson } from "@/lib/api";
import { characterKeys } from "@/lib/query-keys";
import type { Character } from "@shared/schema";

interface MainMenuProps {
  onCharacterSelect: (character: Character) => void;
}

export default function MainMenu({ onCharacterSelect }: MainMenuProps) {
  const { theme, toggleTheme } = useTheme();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreatorOpen, setCreatorOpen] = useState(false);
  const [portraitUploadId, setPortraitUploadId] = useState<string | null>(null);
  const [isManageMode, setManageMode] = useState(
    () => localStorage.getItem("adminMode") === "true",
  );
  const { lastRollBroadcast } = useWebSocket();
  const charactersQuery = useQuery<Character[]>({ queryKey: characterKeys.all });
  const characters = charactersQuery.data ?? [];

  const deleteCharacter = useMutation({
    mutationFn: async (characterId: string) => {
      await requestJson<{ success: boolean }>("DELETE", `/api/character/${characterId}`);
      return characterId;
    },
    onSuccess: (characterId) => {
      queryClient.setQueryData<Character[]>(characterKeys.all, (current = []) =>
        current.filter((character) => character.id !== characterId),
      );
      toast({
        title: "Character deleted",
        description: "The character and its related data were removed.",
      });
    },
    onError: () => {
      toast({
        title: "Character deletion failed",
        description: "The character could not be deleted. Please try again.",
        variant: "destructive",
      });
    },
  });

  const confirmCharacterDeletion = (character: Character) => {
    if (!confirm(`Delete ${character.name}? This cannot be undone.`)) return;
    deleteCharacter.mutate(character.id);
  };

  const toggleManageMode = () => {
    setManageMode((active) => {
      const next = !active;
      if (next) {
        localStorage.setItem("adminMode", "true");
      } else {
        localStorage.removeItem("adminMode");
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="border-b border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-3xl font-bold text-spiritual-700 dark:text-spiritual-400">
              Path Manuals
            </h1>
            <p className="mt-1 text-lg text-gray-600 dark:text-gray-300">
              Spiritual Arts Mechanics
            </p>
          </div>
          <nav className="flex flex-wrap items-center justify-end gap-2" aria-label="Tools">
            <Button
              type="button"
              onClick={() => setLocation("/dm-space")}
              variant="outline"
              size="sm"
              data-testid="button-dm-space"
            >
              <Shield className="mr-2 h-4 w-4" />
              DM Space
            </Button>
            <Button
              type="button"
              onClick={() => setLocation("/factions")}
              variant="outline"
              size="sm"
              data-testid="button-factions"
            >
              <Flag className="mr-2 h-4 w-4" />
              Factions
            </Button>
            <Button
              type="button"
              onClick={() => setLocation("/card-game")}
              variant="outline"
              size="sm"
              data-testid="button-card-game"
            >
              <Swords className="mr-2 h-4 w-4" />
              Card Game
            </Button>
            <Button
              type="button"
              onClick={toggleManageMode}
              variant={isManageMode ? "destructive" : "outline"}
              size="sm"
              aria-pressed={isManageMode}
              data-testid="button-admin-mode"
            >
              <KeyRound className="mr-2 h-4 w-4" />
              {isManageMode ? "Managing" : "Manage"}
            </Button>
            <Button
              type="button"
              onClick={toggleTheme}
              variant="outline"
              size="icon"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              data-testid="button-theme-toggle"
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
            Select a Character
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Choose a character to view their sheet, or create a new one.
          </p>
        </div>

        {charactersQuery.isError && (
          <p className="mb-6 text-center text-red-600" role="alert">
            Characters could not be loaded. Please refresh and try again.
          </p>
        )}

        {charactersQuery.isLoading ? (
          <p className="py-12 text-center text-gray-600 dark:text-gray-400" role="status">
            Loading characters…
          </p>
        ) : (
          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {characters.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                onSelect={onCharacterSelect}
                onEditPortrait={setPortraitUploadId}
                onDelete={isManageMode ? confirmCharacterDeletion : undefined}
                isDeleting={deleteCharacter.isPending}
              />
            ))}

            <Card className="border-2 border-dashed border-spiritual-300 bg-white transition-all hover:scale-[1.02] hover:shadow-lg dark:border-spiritual-600 dark:bg-gray-800">
              <button
                type="button"
                onClick={() => setCreatorOpen(true)}
                className="h-full min-h-[180px] w-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-spiritual-500"
              >
                <CardContent className="flex h-full flex-col items-center justify-center p-6">
                  <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-spiritual-100 dark:bg-spiritual-900">
                    <Plus className="h-6 w-6 text-spiritual-600 dark:text-spiritual-400" />
                  </span>
                  <span className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                    Create New Character
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Start your spiritual journey
                  </span>
                </CardContent>
              </button>
            </Card>
          </div>
        )}

        {!charactersQuery.isLoading && characters.length === 0 && (
          <div className="py-12 text-center">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-spiritual-100 dark:bg-spiritual-900">
              <User className="h-12 w-12 text-spiritual-600 dark:text-spiritual-400" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
              No Characters Yet
            </h3>
            <Button type="button" onClick={() => setCreatorOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Character
            </Button>
          </div>
        )}
      </main>

      <CharacterCreator
        isOpen={isCreatorOpen}
        onClose={() => setCreatorOpen(false)}
        onCharacterCreated={onCharacterSelect}
      />
      {portraitUploadId && (
        <PortraitUpload
          characterId={portraitUploadId}
          currentPortraitUrl={characters.find((item) => item.id === portraitUploadId)?.portraitUrl}
          isOpen
          onClose={() => setPortraitUploadId(null)}
        />
      )}
      <SpiritRollNotification rollData={lastRollBroadcast} currentCharacterId={undefined} />
    </div>
  );
}
