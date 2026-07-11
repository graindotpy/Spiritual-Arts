import { useEffect, useState } from "react";
import { Camera, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Character } from "@shared/schema";

interface CharacterCardProps {
  character: Character;
  onSelect: (character: Character) => void;
  onEditPortrait: (characterId: string) => void;
  onDelete?: (character: Character) => void;
  isDeleting?: boolean;
}

export function CharacterCard({
  character,
  onSelect,
  onEditPortrait,
  onDelete,
  isDeleting = false,
}: CharacterCardProps) {
  const [portraitFailed, setPortraitFailed] = useState(false);

  useEffect(() => setPortraitFailed(false), [character.portraitUrl]);

  return (
    <Card className="relative border-gray-200 bg-white transition-all hover:scale-[1.02] hover:shadow-lg dark:border-gray-700 dark:bg-gray-800">
      <button
        type="button"
        onClick={() => onSelect(character)}
        className="w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-spiritual-500 focus-visible:ring-offset-2"
        aria-label={`Open ${character.name}'s character sheet`}
      >
        <CardContent className="p-6">
          <div className="mb-4 flex items-center">
            <div className="mr-4 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-spiritual-100 dark:bg-spiritual-900">
              {character.portraitUrl && !portraitFailed ? (
                <img
                  src={character.portraitUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={() => setPortraitFailed(true)}
                />
              ) : (
                <User className="h-6 w-6 text-spiritual-600 dark:text-spiritual-400" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {character.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Level {character.level}</p>
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
        variant="outline"
        className="absolute right-3 top-3 h-8 w-8 rounded-full bg-white dark:bg-gray-800"
        onClick={() => onEditPortrait(character.id)}
        aria-label={`Change ${character.name}'s portrait`}
      >
        <Camera className="h-3.5 w-3.5" />
      </Button>
      {onDelete && (
        <Button
          type="button"
          size="icon"
          variant="destructive"
          className="absolute right-12 top-3 h-8 w-8 rounded-full"
          onClick={() => onDelete(character)}
          disabled={isDeleting}
          aria-label={`Delete ${character.name}`}
          data-testid={`button-delete-character-${character.id}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </Card>
  );
}
