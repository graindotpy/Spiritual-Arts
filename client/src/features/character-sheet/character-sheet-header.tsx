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
    <header className="border-b border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Button
            onClick={onReturnToMenu}
            variant="outline"
            size="sm"
            className="border-spiritual-600 text-spiritual-600 hover:bg-spiritual-50 dark:border-spiritual-400 dark:text-spiritual-400 dark:hover:bg-spiritual-900"
          >
            <Home className="mr-2 h-4 w-4" />
            Main Menu
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-spiritual-700 dark:text-spiritual-400">
              {character.name}
            </h1>
            <div className="flex items-center gap-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {character.path} · Level {character.level}
              </p>
              <Button onClick={onEditLevel} variant="ghost" size="sm" className="h-6 px-2 text-xs">
                <TrendingUp className="mr-1 h-3 w-3" />
                Edit
              </Button>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={onOpenGlossary} variant="outline" size="sm">
            <BookOpen className="mr-2 h-4 w-4" />
            Glossary
          </Button>
          <Button
            onClick={toggleTheme}
            variant="outline"
            size="icon"
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
