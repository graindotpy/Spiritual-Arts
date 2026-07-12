import { useId, useState } from "react";
import { BookOpen, Dice6, RotateCcw, TrendingUp, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpiritualArtsDcCalculator } from "./spiritual-arts-dc-calculator";
import type { Character } from "@shared/schema";

interface CharacterSheetHeroProps {
  character: Character;
  techniqueCount: number;
  spiritDieCount: number;
  onEditLevel: () => void;
  onLongRest: () => void;
  onSaveHighestAbilityScore: (score: number) => Promise<unknown>;
}

export function CharacterSheetHero({
  character,
  techniqueCount,
  spiritDieCount,
  onEditLevel,
  onLongRest,
  onSaveHighestAbilityScore,
}: CharacterSheetHeroProps) {
  const headingId = useId();
  const portraitUrl = character.portraitUrl?.trim() || null;
  const [failedPortraitUrl, setFailedPortraitUrl] = useState<string | null>(null);
  const showPortrait = portraitUrl !== null && failedPortraitUrl !== portraitUrl;

  return (
    <section
      className="character-hero relative border-b border-[#cdbfa7]/70 pb-7 sm:pb-8 dark:border-[#806b48]/55"
      aria-labelledby={headingId}
    >
      <div className="character-hero-layout flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8 lg:gap-10">
        <div className="character-portrait-medallion relative h-32 w-32 shrink-0 rounded-full border border-[#a48c62]/65 bg-[#e3d7be] p-1.5 shadow-[0_14px_34px_rgba(71,51,28,0.16)] sm:h-40 sm:w-40 lg:h-[12.5rem] lg:w-[12.5rem] dark:border-[#b3915c]/55 dark:bg-[#403622] dark:shadow-[0_16px_38px_rgba(0,0,0,0.3)]">
          <div className="character-portrait-inner h-full w-full overflow-hidden rounded-full border border-[#fffaf0]/80 bg-[#d5dacd] text-[#45695c] ring-1 ring-[#80683f]/25 dark:border-[#665438] dark:bg-[#2e342b] dark:text-[#c4a873] dark:ring-[#d1ae70]/20">
            {showPortrait ? (
              <img
                src={portraitUrl}
                alt={`${character.name}'s portrait`}
                width={200}
                height={200}
                className="character-portrait-image h-full w-full rounded-full object-cover"
                decoding="async"
                onError={() => setFailedPortraitUrl(portraitUrl)}
              />
            ) : (
              <div
                className="character-portrait-fallback flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_38%_30%,rgba(255,255,255,0.55),transparent_38%),linear-gradient(145deg,rgba(65,105,91,0.12),rgba(138,105,61,0.14))]"
                aria-hidden="true"
              >
                <User className="h-12 w-12 opacity-55 sm:h-14 sm:w-14 lg:h-16 lg:w-16" />
              </div>
            )}
          </div>
        </div>

        <div className="character-hero-copy min-w-0 flex-1 text-center sm:text-left">
          <p className="character-hero-kicker wuxia-kicker mb-2">Character manual</p>
          <h1
            id={headingId}
            className="character-hero-name font-display break-words text-4xl leading-[0.95] tracking-[-0.025em] text-[#20352e] sm:text-5xl lg:text-6xl dark:text-[#f1e7d4]"
          >
            {character.name}
          </h1>

          <div className="character-hero-meta mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 sm:justify-start">
            <p className="character-hero-path font-display text-lg italic text-[#557066] sm:text-xl dark:text-[#c3aa7b]">
              {character.path}
            </p>
            <span
              className="character-hero-divider hidden h-4 w-px bg-[#b8a98d] sm:block dark:bg-[#806b48]"
              aria-hidden="true"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onEditLevel}
              className="character-level-button h-8 rounded-full border border-[#b8a98d]/65 bg-[#fffaf0]/45 px-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#4d645b] hover:border-[#668678] hover:bg-[#fffaf0] hover:text-[#285848] dark:border-[#92784f]/55 dark:bg-[#504329]/30 dark:text-[#d4bd92] dark:hover:border-[#b69560] dark:hover:bg-[#5c482b]/55 dark:hover:text-[#f0dcba]"
              aria-label={`Edit ${character.name}'s level. Current level ${character.level}`}
            >
              <TrendingUp className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Level {character.level}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onLongRest}
              className="h-8 px-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#5e675f] hover:bg-transparent hover:text-[#8b473b] dark:text-[#c6b38e] dark:hover:bg-transparent dark:hover:text-[#e4c58d]"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Long Rest
            </Button>
          </div>

          <dl className="character-hero-counts mt-6 flex items-stretch justify-center sm:justify-start">
            <div className="character-hero-count flex min-w-28 items-center gap-3 border-r border-[#c9bba3]/75 pr-5 text-left dark:border-[#806b48]/55">
              <BookOpen
                className="h-5 w-5 shrink-0 text-[#547568] dark:text-[#b89b69]"
                aria-hidden="true"
              />
              <div className="flex flex-col-reverse">
                <dt className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.13em] text-[#59635e] dark:text-[#a99c83]">
                  {techniqueCount === 1 ? "Technique" : "Techniques"}
                </dt>
                <dd className="font-display text-2xl leading-none text-[#263d35] dark:text-[#eee3ce]">
                  {techniqueCount}
                </dd>
              </div>
            </div>
            <div className="character-hero-count flex min-w-28 items-center gap-3 pl-5 text-left">
              <Dice6
                className="h-5 w-5 shrink-0 text-[#547568] dark:text-[#b89b69]"
                aria-hidden="true"
              />
              <div className="flex flex-col-reverse">
                <dt className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.13em] text-[#59635e] dark:text-[#a99c83]">
                  {spiritDieCount === 1 ? "Spirit die" : "Spirit dice"}
                </dt>
                <dd className="font-display text-2xl leading-none text-[#263d35] dark:text-[#eee3ce]">
                  {spiritDieCount}
                </dd>
              </div>
            </div>
          </dl>
        </div>

        <div className="character-hero-dc w-full shrink-0 sm:w-auto">
          <SpiritualArtsDcCalculator
            level={character.level}
            highestAbilityScore={character.highestAbilityScore}
            onSave={onSaveHighestAbilityScore}
          />
        </div>
      </div>
    </section>
  );
}
