import { useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  Feather,
  Flag,
  KeyRound,
  Plus,
  Shield,
  Sparkles,
  Swords,
  User,
} from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CharacterCreator from "@/components/character-creator";
import { CampaignMark } from "@/components/campaign-mark";
import PortraitUpload from "@/components/portrait-upload";
import SpiritRollNotification from "@/components/spirit-roll-notification";
import { CharacterCard } from "@/features/main-menu/character-card";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { requestJson } from "@/lib/api";
import { characterKeys } from "@/lib/query-keys";
import type { Character } from "@shared/schema";

interface MainMenuProps {
  onCharacterSelect: (character: Character) => void;
}

const pageOptions = [
  { label: "Path Manuals", path: "/" },
  { label: "Instrument Vault", path: "/instrument-vault" },
];

const toolbarButtonClass =
  "border-[#b8aa90]/70 bg-[#fffaf0]/65 text-[#27352f] shadow-sm backdrop-blur transition-colors hover:border-[#557d6f] hover:bg-[#fffaf0] hover:text-[#204e42] dark:border-white/15 dark:bg-white/[0.06] dark:text-[#e9e2d3] dark:hover:border-[#82a99a]/60 dark:hover:bg-white/[0.1] dark:hover:text-white";

function formatSessionDate(value: string) {
  if (!value) return "To be announced";

  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return trimmed;

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));

  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function CampaignLandscape() {
  return (
    <div className="wuxia-landscape" aria-hidden="true">
      <svg
        viewBox="0 0 760 500"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        role="img"
      >
        <defs>
          <linearGradient id="wuxia-sky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--landscape-sky-top)" />
            <stop offset="1" stopColor="var(--landscape-sky-bottom)" />
          </linearGradient>
          <linearGradient id="wuxia-river" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="var(--landscape-river)" stopOpacity="0" />
            <stop offset="0.5" stopColor="var(--landscape-river)" stopOpacity="0.78" />
            <stop offset="1" stopColor="var(--landscape-river)" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="wuxia-sun-glow">
            <stop offset="0" stopColor="var(--landscape-sun)" stopOpacity="0.48" />
            <stop offset="1" stopColor="var(--landscape-sun)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="760" height="500" fill="url(#wuxia-sky)" />
        <circle cx="560" cy="128" r="92" fill="url(#wuxia-sun-glow)" />
        <circle cx="560" cy="128" r="48" fill="var(--landscape-sun)" opacity="0.86" />

        <g className="wuxia-birds" fill="none" stroke="var(--landscape-ink)" strokeWidth="2">
          <path d="M164 116q10-8 20 0 10-8 20 0" />
          <path d="M218 86q7-6 14 0 7-6 14 0" />
        </g>

        <path
          d="M-45 346 74 213l58 74 92-146 69 106 62-72 91 134 74-110 91 98 74-56 120 127v132H-45Z"
          fill="var(--landscape-mountain-far)"
        />
        <path
          d="M-38 398 78 272l55 75 96-118 75 91 95-144 88 130 78-71 70 98 89-84 100 108v143H-38Z"
          fill="var(--landscape-mountain-mid)"
        />

        <g className="wuxia-mist wuxia-mist-one" fill="var(--landscape-mist)">
          <path d="M-120 308c109-48 202-17 288-8 104 11 171-18 270-15 98 3 178 47 302 9v60H-120Z" />
        </g>
        <g className="wuxia-mist wuxia-mist-two" fill="var(--landscape-mist)" opacity="0.72">
          <path d="M-80 362c134-39 218 7 333-4 97-10 179-43 287-13 64 18 130 17 234-2v70H-80Z" />
        </g>

        <path
          d="M-48 445 86 336l83 86 78-53 85 74 95-146 83 118 59-70 64 80 93-61 88 77v59H-48Z"
          fill="var(--landscape-mountain-near)"
        />
        <path
          d="M394 500c30-84 78-119 105-163 25-40 30-76 42-112-2 55 4 96 20 130 17 37 45 75 72 145Z"
          fill="url(#wuxia-river)"
          opacity="0.72"
        />

        <g
          className="wuxia-pines"
          fill="none"
          stroke="var(--landscape-ink)"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M132 404v-83m0 10-27 32m27-13 33 32m-33-10-39 42m39-21 42 42" />
          <path d="M659 415v-69m0 9-22 27m22-10 27 26m-27-7-31 35m31-17 33 33" />
        </g>
      </svg>

      <div className="wuxia-art-label">
        <span className="wuxia-art-seal">SA</span>
        <span>
          <strong>Spiritual Arts</strong>
          <small>Campaign companion</small>
        </span>
      </div>
    </div>
  );
}

export default function MainMenu({ onCharacterSelect }: MainMenuProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreatorOpen, setCreatorOpen] = useState(false);
  const [portraitUploadId, setPortraitUploadId] = useState<string | null>(null);
  const [isDmMode, setDmMode] = useState(
    () => localStorage.getItem("dmMode") === "true",
  );
  const [nextSessionDate, setNextSessionDate] = useState(() => localStorage.getItem("nextSessionDate") ?? "");
  const [isManageMode, setManageMode] = useState(
    () =>
      localStorage.getItem("dmMode") === "true" &&
      localStorage.getItem("adminMode") === "true",
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

  const handleNextSessionDateChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setNextSessionDate(value);
    localStorage.setItem("nextSessionDate", value);
  };

  const toggleDmMode = () => {
    if (isDmMode) {
      localStorage.removeItem("dmMode");
      localStorage.removeItem("adminMode");
      setDmMode(false);
      setManageMode(false);
      return;
    }

    const code = typeof window !== "undefined" && typeof window.prompt === "function"
      ? window.prompt("Enter the DM Mode code:")
      : null;
    if (code === null) return;

    if (code.trim() !== "31428") {
      toast({
        title: "Incorrect code",
        description: "DM Mode was not activated.",
        variant: "destructive",
      });
      return;
    }

    localStorage.setItem("dmMode", "true");
    setDmMode(true);
    toast({
      title: "DM Mode activated",
      description: "DM tools are now available in the top bar.",
    });
  };

  return (
    <div className="wuxia-shell min-h-screen">
      <div className="wuxia-orb wuxia-orb-left" aria-hidden="true" />
      <div className="wuxia-orb wuxia-orb-right" aria-hidden="true" />

      <header className="wuxia-topbar sticky top-0 z-40">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <CampaignMark />
            <div className="min-w-0">
              <p className="wuxia-kicker mb-0.5">Spiritual Arts</p>
              <label htmlFor="page-selector" className="sr-only">
                Select page
              </label>
              <Select value="/" onValueChange={setLocation}>
                <SelectTrigger
                  id="page-selector"
                  className="font-display h-auto w-[13.5rem] border-0 bg-transparent p-0 text-left text-2xl leading-none text-[#1f342d] shadow-none focus:ring-1 focus:ring-[#8d6b40] dark:text-[#ead9b6] [&>svg]:ml-2 [&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-[#8e7958] [&>span]:line-clamp-none"
                  aria-label="Select page"
                  data-testid="select-page"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-[#c9bca3] bg-[#fffaf0] text-[#24342e] dark:border-[#846a45] dark:bg-[#2b251c] dark:text-[#ead9b6]">
                  {pageOptions.map((option) => (
                    <SelectItem key={option.path} value={option.path}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <nav className="flex flex-wrap items-center justify-end gap-2" aria-label="Tools">
            <Button
              type="button"
              onClick={toggleDmMode}
              variant="outline"
              size="sm"
              className={
                isDmMode
                  ? "border-[#557d6f] bg-[#dce9df] text-[#204e42] shadow-sm hover:bg-[#d2e2d8] dark:border-[#82a99a]/60 dark:bg-[#31584c]/60 dark:text-[#e7f1ec] dark:hover:bg-[#31584c]/80"
                  : toolbarButtonClass
              }
              aria-pressed={isDmMode}
              data-testid="button-dm-mode"
            >
              <KeyRound className="mr-2 h-4 w-4" />
              DM Mode
            </Button>
            {isDmMode && (
              <>
                <Button
                  type="button"
                  onClick={() => setLocation("/dm-space")}
                  variant="outline"
                  size="sm"
                  className={toolbarButtonClass}
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
                  className={toolbarButtonClass}
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
                  className={toolbarButtonClass}
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
                  className={isManageMode ? "shadow-sm" : toolbarButtonClass}
                  aria-pressed={isManageMode}
                  data-testid="button-admin-mode"
                >
                  <KeyRound className="mr-2 h-4 w-4" />
                  {isManageMode ? "Managing" : "Manage"}
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-12 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:px-8 lg:pb-16 lg:pt-16">
          <div className="max-w-2xl wuxia-hero-copy">
            <p className="wuxia-eyebrow">
              <Sparkles className="h-3.5 w-3.5" />
              campaign companion
            </p>
            <h1 className="font-display mt-5 text-5xl leading-[0.95] tracking-[-0.035em] text-[#1c3029] sm:text-6xl lg:text-7xl dark:text-[#f3ecde]">
              Act 4
              <span className="mt-2 block italic text-[#436f60] dark:text-[#c5a66f]">
                Ketsu
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#5f655e] sm:text-lg dark:text-[#bfb092]">
              Kozan campaign companion app. Track Paths, Spirit Die, unique mechanics, and more.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                size="lg"
                onClick={() => setCreatorOpen(true)}
                className="wuxia-primary-action h-12 px-6"
              >
                <Feather className="mr-2 h-4 w-4" />
                Create a character
              </Button>
              <a
                href="#characters"
                className="wuxia-secondary-action inline-flex h-12 items-center justify-center px-6 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f7651] focus-visible:ring-offset-2"
              >
                View the roster
                <ArrowDown className="ml-2 h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="wuxia-hero-art relative mx-auto w-full max-w-[42rem] lg:pr-4">
            <CampaignLandscape />
            <div className="wuxia-session-note absolute -bottom-6 left-5 w-[calc(100%-2.5rem)] max-w-[20rem] px-5 py-4 sm:left-8">
              <p className="wuxia-kicker">Session planner</p>
              <p className="font-display mt-1 text-xl leading-none tracking-[-0.02em] sm:text-2xl">
                Next Session Date
              </p>
              {isDmMode ? (
                <input
                  type="text"
                  value={nextSessionDate}
                  onChange={handleNextSessionDateChange}
                  placeholder="YYYY-MM-DD"
                  className="wuxia-session-date mt-2 w-full border-none bg-transparent p-0 font-display text-2xl leading-none outline-none focus:ring-0 sm:text-3xl"
                  aria-label="Next Session Date"
                />
              ) : (
                <p className="wuxia-session-date mt-2 font-display text-2xl leading-none sm:text-3xl">
                  {formatSessionDate(nextSessionDate)}
                </p>
              )}
            </div>
          </div>
        </section>

        <section
          id="characters"
          className="wuxia-paper relative mx-auto mb-12 max-w-7xl scroll-mt-28 rounded-[1.75rem] px-4 py-7 sm:mb-16 sm:px-7 sm:py-9 lg:px-10 lg:py-11"
        >
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="wuxia-eyebrow">
                <span className="h-px w-7 bg-current opacity-50" />
                The party
              </p>
              <h2 className="font-display mt-3 text-3xl text-[#20352e] sm:text-4xl dark:text-[#ead9b6]">
                Choose your character
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#666a63] sm:text-base dark:text-[#b7a98c]">
                Open a path manual to continue the journey, or bind a new one for a fresh hero.
              </p>
            </div>
            {!charactersQuery.isLoading && (
              <span className="inline-flex w-fit items-center gap-2 rounded-sm border border-[#c9bda7] bg-[#f9f3e8]/75 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.13em] text-[#607068] dark:border-[#806640] dark:bg-[#4d3e29]/30 dark:text-[#c7b28d]">
                <User className="h-3.5 w-3.5" />
                {characters.length} {characters.length === 1 ? "traveller" : "travellers"}
              </span>
            )}
          </div>

          {charactersQuery.isError && (
            <div
              className="mb-6 rounded-xl border border-[#c6796b]/45 bg-[#f8e6df]/70 px-4 py-3 text-sm text-[#813b31] dark:border-[#c6796b]/30 dark:bg-[#712f27]/20 dark:text-[#efb8ad]"
              role="alert"
            >
              Characters could not be loaded. Please refresh and try again.
            </div>
          )}

          {charactersQuery.isLoading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3" role="status">
              <span className="sr-only">Loading characters…</span>
              {[0, 1, 2].map((item) => (
                <div key={item} className="wuxia-card wuxia-card-skeleton overflow-hidden">
                  <div className="h-48 animate-pulse bg-[#d8d2c3]/60 motion-reduce:animate-none dark:bg-white/[0.06]" />
                  <div className="space-y-3 p-6">
                    <div className="h-3 w-24 animate-pulse rounded-full bg-[#d8d2c3]/70 motion-reduce:animate-none dark:bg-white/[0.08]" />
                    <div className="h-7 w-2/3 animate-pulse rounded-full bg-[#d8d2c3]/70 motion-reduce:animate-none dark:bg-white/[0.08]" />
                    <div className="h-4 w-full animate-pulse rounded-full bg-[#d8d2c3]/60 motion-reduce:animate-none dark:bg-white/[0.06]" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {characters.map((character, index) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  onSelect={onCharacterSelect}
                  onEditPortrait={setPortraitUploadId}
                  onDelete={isManageMode ? confirmCharacterDeletion : undefined}
                  isDeleting={deleteCharacter.isPending}
                  revealDelayMs={Math.min(index * 70, 350)}
                />
              ))}

              <article
                className="wuxia-card wuxia-card-reveal wuxia-new-card group relative min-h-[338px] overflow-hidden"
                style={{ animationDelay: `${Math.min(characters.length * 70, 350)}ms` }}
              >
                <button
                  type="button"
                  onClick={() => setCreatorOpen(true)}
                  className="relative z-10 flex h-full min-h-[338px] w-full flex-col items-center justify-center px-7 py-9 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#557d6f] focus-visible:ring-inset"
                >
                  <span className="wuxia-new-card-mark mb-6 flex h-16 w-16 items-center justify-center rounded-full">
                    <Plus className="h-7 w-7 transition-transform duration-300 group-hover:rotate-90" />
                  </span>
                  <span className="wuxia-kicker">An unbound manual</span>
                  <span className="font-display mt-3 text-2xl text-[#263b34] dark:text-[#e8d7b4]">
                    Create a new character
                  </span>
                  <span className="mt-3 max-w-[15rem] text-sm leading-6 text-[#6c6c64] dark:text-[#b5a78b]">
                    Begin a new spiritual journey and shape the path ahead.
                  </span>
                  <span className="mt-6 inline-flex items-center text-sm font-semibold text-[#356454] dark:text-[#c5a66f]">
                    Bind the first page
                    <Feather className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </button>
              </article>
            </div>
          )}
        </section>
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
