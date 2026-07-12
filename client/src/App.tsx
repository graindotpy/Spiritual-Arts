import { lazy, Suspense } from "react";
import { useQuery, QueryClientProvider } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, BookX, LoaderCircle } from "lucide-react";
import { Route, Switch, useLocation } from "wouter";
import { ThemeProvider } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
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
const InstrumentVault = lazy(() => import("@/pages/instrument-vault"));
const NotFound = lazy(() => import("@/pages/not-found"));

function PageLoader() {
  return (
    <div className="wuxia-shell flex min-h-screen items-center justify-center px-4 py-10">
      <div className="wuxia-orb wuxia-orb-left" aria-hidden="true" />
      <div
        className="wuxia-paper relative z-10 mx-auto flex max-w-sm flex-col items-center rounded-[1.35rem] px-8 py-10 text-center dark:rounded-sm"
        role="status"
        aria-live="polite"
      >
        <span className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[#8ea293]/45 bg-[#dfe8de]/70 text-[#3b6758] dark:rounded-sm dark:border-[#9c7d4f]/55 dark:bg-[#59472f]/35 dark:text-[#d0ad70]">
          <BookOpen className="h-6 w-6" aria-hidden="true" />
          <LoaderCircle
            className="absolute -bottom-1 -right-1 h-5 w-5 animate-spin rounded-full bg-[#f9f3e7] p-0.5 text-[#85683f] motion-reduce:animate-none dark:bg-[#30281d] dark:text-[#d0ad70]"
            aria-hidden="true"
          />
        </span>
        <p className="wuxia-kicker">Spiritual Arts</p>
        <p className="font-display mt-2 text-2xl text-[#253b33] dark:text-[#f0e3ca]">
          Opening the manual&hellip;
        </p>
        <p className="mt-2 text-sm leading-6 text-[#6a6b63] dark:text-[#b9aa8c]">
          Gathering the latest pages of your journey.
        </p>
      </div>
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
        <Route path="/instrument-vault">
          <InstrumentVault />
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
      <div className="wuxia-shell flex min-h-screen items-center justify-center px-4 py-10">
        <div className="wuxia-orb wuxia-orb-left" aria-hidden="true" />
        <section className="wuxia-paper relative z-10 mx-auto max-w-lg rounded-[1.5rem] px-7 py-9 text-center sm:px-10 sm:py-11 dark:rounded-sm">
          <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[#b29369]/45 bg-[#eee3cf]/75 text-[#86643b] dark:rounded-sm dark:border-[#9c7d4f]/55 dark:bg-[#59472f]/35 dark:text-[#d0ad70]">
            <BookX className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="wuxia-kicker">A page has gone astray</p>
          <h1 className="font-display mt-2 text-3xl text-[#253b33] sm:text-4xl dark:text-[#f0e3ca]">
            Character not found
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[#6a6b63] sm:text-base dark:text-[#b9aa8c]">
            This character manual may have been removed, or the path used to reach it is no longer valid.
          </p>
          <Button
            type="button"
            onClick={handleReturn}
            className="wuxia-primary-action mt-7 h-11 px-5"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Return to {returnPath === "/dm-space" ? "DM Space" : "Main Menu"}
          </Button>
        </section>
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
