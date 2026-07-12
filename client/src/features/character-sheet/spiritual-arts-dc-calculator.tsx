import { useEffect, useState } from "react";
import { Calculator, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CampaignDialogBody,
  CampaignDialogContent,
  CampaignDialogFooter,
  CampaignDialogHeader,
} from "@/components/campaign-dialog";

interface SpiritualArtsDcCalculatorProps {
  level: number;
  highestAbilityScore: number | null;
  onSave: (highestAbilityScore: number) => Promise<unknown>;
}

export function SpiritualArtsDcCalculator({
  level,
  highestAbilityScore,
  onSave,
}: SpiritualArtsDcCalculatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [scoreInput, setScoreInput] = useState("");
  const [abilityScore, setAbilityScore] = useState<number | null>(highestAbilityScore);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setAbilityScore(highestAbilityScore);
  }, [highestAbilityScore]);

  const abilityModifier = abilityScore === null ? null : Math.floor((abilityScore - 10) / 2);
  const proficiencyBonus = 2 + Math.floor((level - 1) / 4);
  const dc = abilityModifier === null ? null : 8 + proficiencyBonus + abilityModifier;
  const parsedScore = Number(scoreInput);
  const isValidScore = Number.isInteger(parsedScore) && parsedScore >= 1 && parsedScore <= 30;

  const calculate = async () => {
    if (!isValidScore || isSaving) return;
    setIsSaving(true);
    try {
      await onSave(parsedScore);
      setAbilityScore(parsedScore);
      setIsOpen(false);
    } catch {
      // The character mutation reports the failure and the dialog stays open for retrying.
    } finally {
      setIsSaving(false);
    }
  };

  const formatBonus = (value: number) => (value >= 0 ? `+${value}` : String(value));

  return (
    <>
      <button
        type="button"
        className="spiritual-dc-card group w-full text-left sm:w-52 lg:w-60"
        onClick={() => {
          setScoreInput(abilityScore?.toString() ?? "");
          setIsOpen(true);
        }}
        aria-label={dc === null ? "Calculate Spiritual Arts difficulty class" : `Spiritual Arts difficulty class ${dc}. Recalculate`}
      >
        <span className="spiritual-dc-card-inner flex min-h-40 flex-col items-center justify-center px-5 py-5 text-center">
          <span className="wuxia-new-card-mark mb-3 flex h-11 w-11 items-center justify-center rounded-full">
            {dc === null ? <Calculator className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
          </span>
          <span className="wuxia-kicker">Spiritual Arts</span>
          {dc === null ? (
            <>
              <span className="font-display mt-1.5 text-xl text-[#263b34] dark:text-[#e8d7b4]">Calculate your DC</span>
              <span className="mt-2 text-xs leading-5 text-[#686c65] dark:text-[#b5a78b]">Use your highest ability score</span>
            </>
          ) : (
            <>
              <span className="font-display mt-1 text-4xl leading-none text-[#263b34] dark:text-[#f0dfbd]">DC {dc}</span>
              <span className="mt-2 text-xs font-semibold text-[#5c675f] dark:text-[#b5a78b]">
                8 {formatBonus(proficiencyBonus)} proficiency {formatBonus(abilityModifier!)} ability
              </span>
              <span className="mt-2 text-[0.65rem] uppercase tracking-[0.12em] text-[#477061] dark:text-[#c5a66f]">Click to recalculate</span>
            </>
          )}
        </span>
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <CampaignDialogContent className="sm:max-w-md">
          <CampaignDialogHeader
            icon={Calculator}
            eyebrow="Spiritual Arts"
            title="Calculate your DC"
            description={`At level ${level}, your proficiency bonus is +${proficiencyBonus}.`}
          />
          <CampaignDialogBody className="space-y-4">
            <div>
              <Label htmlFor="highest-ability-score" className="wuxia-dialog-label">Highest ability score</Label>
              <Input
                id="highest-ability-score"
                type="number"
                min={1}
                max={30}
                step={1}
                autoFocus
                value={scoreInput}
                onChange={(event) => setScoreInput(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void calculate()}
                placeholder="Enter a score from 1 to 30"
                className="wuxia-dialog-control"
                aria-describedby="ability-score-help"
              />
              <p id="ability-score-help" className="mt-2 text-xs text-[#686c65] dark:text-[#aa9c83]">
                Your DC is 8 + proficiency bonus + ability modifier.
              </p>
              {scoreInput !== "" && !isValidScore && (
                <p className="mt-2 text-sm text-red-700 dark:text-red-300" role="alert">Enter a whole number between 1 and 30.</p>
              )}
            </div>
          </CampaignDialogBody>
          <CampaignDialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="wuxia-secondary-action w-full sm:w-auto">Cancel</Button>
            <Button type="button" onClick={() => void calculate()} disabled={!isValidScore || isSaving} className="wuxia-primary-action w-full sm:w-auto">
              {isSaving ? "Saving…" : "Calculate DC"}
            </Button>
          </CampaignDialogFooter>
        </CampaignDialogContent>
      </Dialog>
    </>
  );
}
