import { useState } from "react";
import { Plus, Trash2, User } from "lucide-react";
import { useLocation } from "wouter";
import CharacterCreator from "@/components/character-creator";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useDmCharacterMutations, useDmCharacters } from "./api";

interface CharactersPanelProps {
  userId: string;
}

export function CharactersPanel({ userId }: CharactersPanelProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isCreatorOpen, setCreatorOpen] = useState(false);
  const charactersQuery = useDmCharacters(userId);
  const { deleteCharacter, invalidateCharacters } = useDmCharacterMutations(userId);
  const characters = charactersQuery.data ?? [];

  const openCharacter = (characterId: string) => {
    sessionStorage.setItem("returnTo", "/dm-space");
    setLocation(`/character/${characterId}?from=dm`);
  };

  const removeCharacter = (characterId: string, characterName: string) => {
    if (!confirm(`Delete ${characterName}? This cannot be undone.`)) return;

    deleteCharacter.mutate(characterId, {
      onSuccess: () => toast({ title: "DM character deleted" }),
      onError: () =>
        toast({
          title: "DM character deletion failed",
          description: "The character could not be deleted.",
          variant: "destructive",
        }),
    });
  };

  return (
    <>
      <div className="mb-6 flex justify-end">
        <Button
          type="button"
          onClick={() => setCreatorOpen(true)}
          data-testid="button-dm-create-character"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Character
        </Button>
      </div>

      {charactersQuery.isLoading ? (
        <p className="py-12 text-center text-gray-600 dark:text-gray-400" role="status">
          Loading characters…
        </p>
      ) : charactersQuery.isError ? (
        <p className="py-12 text-center text-red-600 dark:text-red-400" role="alert">
          DM characters could not be loaded.
        </p>
      ) : characters.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-spiritual-100 dark:bg-spiritual-900">
            <User className="h-12 w-12 text-spiritual-600 dark:text-spiritual-400" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
            No DM Characters Yet
          </h2>
          <p className="mb-6 text-gray-600 dark:text-gray-400">
            Create a DM-only character for private reference.
          </p>
          <Button type="button" onClick={() => setCreatorOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Your First DM Character
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {characters.map((character) => (
            <Card
              key={character.id}
              className="relative border-gray-200 bg-white transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
              data-testid={`card-dm-character-${character.id}`}
            >
              <button
                type="button"
                onClick={() => openCharacter(character.id)}
                className="w-full rounded-lg p-6 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-spiritual-500"
                aria-label={`Open ${character.name}'s character sheet`}
              >
                <CardContent className="p-0">
                  <div className="mb-4 flex items-center">
                    <div className="mr-3 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-spiritual-100 dark:bg-spiritual-900">
                      {character.portraitUrl ? (
                        <img
                          src={character.portraitUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User className="h-5 w-5 text-spiritual-600 dark:text-spiritual-400" />
                      )}
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
                  <p className="border-t border-gray-200 pt-4 font-medium text-spiritual-600 dark:border-gray-700 dark:text-spiritual-400">
                    {character.path}
                  </p>
                </CardContent>
              </button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => removeCharacter(character.id, character.name)}
                disabled={deleteCharacter.isPending}
                className="absolute right-3 top-3 h-8 w-8 text-red-600 hover:text-red-700 dark:text-red-400"
                aria-label={`Delete ${character.name}`}
                data-testid={`button-delete-dm-character-${character.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      <CharacterCreator
        isOpen={isCreatorOpen}
        onClose={() => setCreatorOpen(false)}
        createUrl={`/api/dm/${userId}/characters`}
        onCharacterCreated={() => {
          void invalidateCharacters();
        }}
      />
    </>
  );
}
