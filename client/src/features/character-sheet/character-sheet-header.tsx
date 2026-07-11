import { BookOpen, Home, Moon, Sun, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";
import type { Character } from "@shared/schema";

interface CharacterSheetHeaderProps {
  character: Character;
  onReturnToMenu: () => void;
  onEditLevel: () => void;
  onOpenGlossary: () => void;
}

export function CharacterSheetHeader({
  character,
  onReturnToMenu,
  onEditLevel,
  onOpenGlossary,
}: CharacterSheetHeaderProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="wuxia-topbar relative z-40">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
          <Button
            onClick={onReturnToMenu}
            variant="outline"
            size="sm"
            className="campaign-toolbar-button shrink-0"
            aria-label="Return to main menu"
          >
            <Home className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Main Menu</span>
          </Button>
          <div className="min-w-0">
            <p className="wuxia-kicker mb-0.5">Character manual</p>
            <h1 className="font-display truncate text-2xl leading-none text-[#20352e] sm:text-3xl dark:text-[#f1eadc]">
              {character.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="truncate text-sm text-[#667068] dark:text-[#adb8b1]">
                {character.path} · Level {character.level}
              </p>
              <Button
                onClick={onEditLevel}
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-[#52675f] hover:bg-[#e4ebe4] hover:text-[#255444] dark:text-[#a9b9b1] dark:hover:bg-white/[0.06] dark:hover:text-white"
              >
                <TrendingUp className="mr-1 h-3 w-3" />
                Edit
              </Button>
            </div>
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
          <Button
            onClick={toggleTheme}
            variant="outline"
            size="icon"
            className="campaign-toolbar-button"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
