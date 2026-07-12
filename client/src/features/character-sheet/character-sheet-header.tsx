import { BookOpen, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Character } from "@shared/schema";

interface CharacterSheetHeaderProps {
  character: Character;
  onReturnToMenu: () => void;
  onOpenGlossary: () => void;
}

export function CharacterSheetHeader({
  character,
  onReturnToMenu,
  onOpenGlossary,
}: CharacterSheetHeaderProps) {
  return (
    <header className="wuxia-topbar sticky top-0 z-40">
      <div className="mx-auto flex w-full max-w-[96rem] items-center justify-between gap-3 px-3 py-2.5 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Button
            onClick={onReturnToMenu}
            variant="outline"
            size="sm"
            className="campaign-toolbar-button shrink-0"
            aria-label="Return to main menu"
          >
            <Home className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Characters</span>
          </Button>
          <span className="hidden h-7 w-px bg-[#c8baa0]/70 sm:block dark:bg-[#715d3e]/70" aria-hidden="true" />
          <div className="hidden min-w-0 sm:block">
            <p className="wuxia-kicker mb-0.5">Spiritual Arts</p>
            <p className="font-display truncate text-lg leading-none text-[#20352e] dark:text-[#ead9b6]">
              {character.name}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            onClick={onOpenGlossary}
            variant="outline"
            size="sm"
            className="campaign-toolbar-button"
            aria-label="Open glossary"
          >
            <BookOpen className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Glossary</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
