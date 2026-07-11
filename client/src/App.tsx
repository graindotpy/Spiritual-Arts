import { lazy, Suspense } from "react";
import { useQuery, QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch, useLocation } from "wouter";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { characterKeys } from "@/lib/query-keys";
import { queryClient } from "@/lib/queryClient";
import type { Character } from "@shared/schema";

const CharacterSheet = lazy(() => import("@/pages/character-sheet"));
const MainMenu = lazy(() => import("@/pages/main-menu"));
const DmSpace = lazy(() => import("@/pages/dm-space"));
const CardGame = lazy(() => import("@/pages/card-game"));
const Factions = lazy(() => import("@/pages/factions"));
const NotFound = lazy(() => import("@/pages/not-found"));

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <p className="text-gray-600 dark:text-gray-400" role="status">
        Loading…
      </p>
    </div>
  );
}

function Router() {
  const [, setLocation] = useLocation();

  const handleCharacterSelect = (character: Character) => {
    sessionStorage.setItem("returnTo", "/");
    setLocation(`/character/${character.id}`);
  };

  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/">
          <MainMenu onCharacterSelect={handleCharacterSelect} />
        </Route>
        <Route path="/character/:id">
          {(params) => <CharacterSheetWrapper characterId={params.id} />}
        </Route>
        <Route path="/dm-space">
          <DmSpace />
        </Route>
        <Route path="/card-game">
          <CardGame />
        </Route>
        <Route path="/factions">
          <Factions />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function CharacterSheetWrapper({ characterId }: { characterId: string }) {
  const [, setLocation] = useLocation();
  const search = typeof window === "undefined" ? "" : window.location.search;
  const returnFrom = new URLSearchParams(search).get("from");
  const storedReturn =
    typeof window === "undefined" ? null : sessionStorage.getItem("returnTo");
  const returnPath = returnFrom === "dm" ? "/dm-space" : storedReturn || "/";
  const characterQuery = useQuery<Character>({
    queryKey: characterKeys.detail(characterId),
    retry: false,
  });

  const handleReturn = () => {
    sessionStorage.removeItem("returnTo");
    setLocation(returnPath);
  };

  if (characterQuery.isLoading) {
    return <PageLoader />;
  }

  if (characterQuery.isError || !characterQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="mb-4 text-gray-600 dark:text-gray-400">Character not found</p>
          <button
            type="button"
            onClick={handleReturn}
            className="text-spiritual-600 hover:text-spiritual-700 dark:text-spiritual-400 dark:hover:text-spiritual-300"
          >
            Return to {returnPath === "/dm-space" ? "DM Space" : "Main Menu"}
          </button>
        </div>
      </div>
    );
  }

  return <CharacterSheet character={characterQuery.data} onReturnToMenu={handleReturn} />;
}

export default function App() {
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
