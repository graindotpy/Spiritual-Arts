import { useEffect, useState } from "react";
import { ArrowUpRight, Camera, ScrollText, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Character } from "@shared/schema";

interface CharacterCardProps {
  character: Character;
  onSelect: (character: Character) => void;
  onEditPortrait: (characterId: string) => void;
  onDelete?: (character: Character) => void;
  isDeleting?: boolean;
  revealDelayMs?: number;
}

function PortraitFallback() {
  return (
    <div className="relative flex h-full w-full items-center justify-center" aria-hidden="true">
      <svg
        viewBox="0 0 520 260"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
      >
        <circle cx="390" cy="72" r="40" fill="currentColor" opacity="0.12" />
        <path
          d="M-20 228 96 115l53 61 72-102 63 94 70-66 82 102 56-58 61 82v42H-20Z"
          fill="currentColor"
          opacity="0.08"
        />
        <path
          d="M-20 247 90 169l60 48 83-73 73 65 76-94 75 105 63-43 73 70v23H-20Z"
          fill="currentColor"
          opacity="0.12"
        />
      </svg>
      <span className="relative flex h-20 w-20 items-center justify-center rounded-full border border-current/15 bg-white/25 shadow-inner backdrop-blur-sm dark:bg-black/10">
        <User className="h-9 w-9 opacity-55" />
      </span>
    </div>
  );
}

export function CharacterCard({
  character,
  onSelect,
  onEditPortrait,
  onDelete,
  isDeleting = false,
  revealDelayMs = 0,
}: CharacterCardProps) {
  const [portraitFailed, setPortraitFailed] = useState(false);

  useEffect(() => setPortraitFailed(false), [character.portraitUrl]);

  return (
    <article
      className="wuxia-card wuxia-card-reveal group relative overflow-hidden"
      style={{ animationDelay: `${revealDelayMs}ms` }}
    >
      <button
        type="button"
        onClick={() => onSelect(character)}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#557d6f] focus-visible:ring-inset"
        aria-label={`Open ${character.name}'s character sheet`}
      >
        <div className="relative h-48 overflow-hidden bg-[#dce0d3] text-[#31594d] dark:bg-[#22352f] dark:text-[#8eafa3]">
          {character.portraitUrl && !portraitFailed ? (
            <img
              src={character.portraitUrl}
              alt=""
              className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
              onError={() => setPortraitFailed(true)}
            />
          ) : (
            <PortraitFallback />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1d2c27]/75 via-transparent to-black/5" />
          <div className="wuxia-level-seal absolute bottom-4 right-4 flex h-[3.55rem] w-[3.55rem] rotate-3 flex-col items-center justify-center rounded-full text-[#fff9ed] transition-transform duration-300 group-hover:rotate-0 group-hover:scale-105">
            <span className="text-[0.5rem] font-bold uppercase leading-none tracking-[0.15em] opacity-80">
              Level
            </span>
            <span className="mt-0.5 text-lg font-semibold leading-none tabular-nums">
              {character.level}
            </span>
          </div>
        </div>

        <div className="relative min-h-[146px] px-6 pb-5 pt-5">
          <div className="flex items-center gap-2 text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[#56756a] dark:text-[#8eaea2]">
            <ScrollText className="h-3.5 w-3.5" />
            <span className="truncate">{character.path}</span>
          </div>
          <h3 className="font-display mt-3 truncate text-[1.7rem] leading-tight text-[#20332c] dark:text-[#f0e8da]">
            {character.name}
          </h3>
          <div className="mt-5 flex items-center justify-between border-t border-[#cfc3ad]/70 pt-4 text-sm font-semibold text-[#52635c] dark:border-white/10 dark:text-[#aeb8b2]">
            <span>Open path manual</span>
            <ArrowUpRight className="h-4 w-4 text-[#3f6d5d] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 dark:text-[#99bcaf]" />
          </div>
        </div>
      </button>

      <Button
        type="button"
        size="icon"
        variant="outline"
        className="wuxia-card-action absolute right-3 top-3 z-20 h-9 w-9 rounded-full border-white/45 bg-[#16251f]/65 text-white opacity-100 shadow-sm backdrop-blur transition-all hover:scale-105 hover:bg-[#16251f]/85 hover:text-white sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
        onClick={() => onEditPortrait(character.id)}
        aria-label={`Change ${character.name}'s portrait`}
      >
        <Camera className="h-4 w-4" />
      </Button>
      {onDelete && (
        <Button
          type="button"
          size="icon"
          variant="destructive"
          className="wuxia-card-action absolute right-14 top-3 z-20 h-9 w-9 rounded-full border border-white/30 shadow-sm opacity-100 transition-all hover:scale-105 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          onClick={() => onDelete(character)}
          disabled={isDeleting}
          aria-label={`Delete ${character.name}`}
          data-testid={`button-delete-character-${character.id}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </article>
  );
}
