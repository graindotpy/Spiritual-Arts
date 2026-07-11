import { Switch, Route, useLocation } from "wouter";
import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { characterKeys } from "./lib/query-keys";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import type { Character } from "@shared/schema";

const CharacterSheet = lazy(() => import("@/pages/character-sheet"));
const MainMenu = lazy(() => import("@/pages/main-menu"));
const DmSpace = lazy(() => import("@/pages/dm-space"));
const NotFound = lazy(() => import("@/pages/not-found"));

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <p className="text-gray-600 dark:text-gray-400">Loading…</p>
    </div>
  );
}

function Router() {
  const [, setLocation] = useLocation();

  const handleCharacterSelect = (character: Character) => {
    setLocation(`/character/${character.id}`);
  };

  const handleReturnToMenu = () => {
    setLocation("/");
  };

  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/">
          <MainMenu onCharacterSelect={handleCharacterSelect} />
        </Route>
        <Route path="/character/:id">
          {(params) => (
            <CharacterSheetWrapper
              characterId={params.id}
              onReturnToMenu={handleReturnToMenu}
            />
          )}
        </Route>
        <Route path="/dm-space">
          <DmSpace />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

// Wrapper component to fetch character data from URL parameter
function CharacterSheetWrapper({ characterId, onReturnToMenu }: { characterId: string; onReturnToMenu: () => void }) {
  const { data: character, isLoading, error } = useQuery<Character>({
    queryKey: characterKeys.detail(characterId),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Loading character…</p>
        </div>
      </div>
    );
  }

  if (error || !character) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">Character not found</p>
          <button 
            onClick={onReturnToMenu}
            className="text-spiritual-600 hover:text-spiritual-700 dark:text-spiritual-400 dark:hover:text-spiritual-300"
          >
            Return to Main Menu
          </button>
        </div>
      </div>
    );
  }

  return (
    <CharacterSheet 
      character={character}
      onReturnToMenu={onReturnToMenu}
    />
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
