import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RotateCcw, Settings, SlidersHorizontal } from "lucide-react";
import SpiritDie from "./spirit-die";
import AnimatedDie from "./animated-die";
import type { DieSize, SpiritDieSlot } from "@shared/spirit-dice";

interface SpiritDiePoolProps {
  currentDice: SpiritDieSlot[];
  originalDice: DieSize[];
  selectedDieIndex: number | null;
  onDieSelect: (index: number) => void;
  onDieRestore: (index: number) => void;
  onRestoreAll: () => void;
  isUsingOverride: boolean;
  onOverride: () => void;
  onResetToLevel: () => void;
  isRolling?: boolean;
  rollResult?: number | null;
  rollSuccess?: boolean;
  rollingDieIndex?: number | null;
  rollToken?: number;
  onRollComplete?: (token: number) => void;
  // Manual tracking props
  isManualTracking: boolean;
  onManualTrackingToggle: () => void;
  onManualDieAdjust: (index: number, newValue: DieSize) => void;
}

export default function SpiritDiePoolComponent({ 
  currentDice, 
  originalDice,
  selectedDieIndex, 
  onDieSelect,
  onDieRestore,
  onRestoreAll,
  isUsingOverride,
  onOverride,
  onResetToLevel,
  isRolling = false,
  rollResult = null,
  rollSuccess,
  rollingDieIndex = null,
  rollToken = 0,
  onRollComplete,
  // Manual tracking props
  isManualTracking,
  onManualTrackingToggle,
  onManualDieAdjust,
}: SpiritDiePoolProps) {
  return (
    <div>
      <div className="mb-5 text-center lg:text-left">
        <p className="wuxia-kicker mb-1.5">Spirit Die Tracking</p>
        <h2 className="font-display text-3xl text-[#20352e] dark:text-[#f1eadc]">
          Spirit Die Pool
        </h2>
      </div>
      
      <div className="character-dice-toolbar mb-5 flex flex-wrap items-center justify-center gap-3 border-y border-[#cdbfa7]/70 py-3 dark:border-[#806b48]/55">
        <div className="flex items-center gap-2" data-testid="manual-tracking-toggle">
          <Settings className="h-4 w-4 text-[#67746d] dark:text-[#b09e7f]" />
          <Label htmlFor="manual-tracking" className="text-sm text-[#565f59] dark:text-[#c6b89d]">
            Manual Tracking
          </Label>
          <Switch
            id="manual-tracking"
            checked={isManualTracking}
            onCheckedChange={onManualTrackingToggle}
            className="data-[state=checked]:bg-[#3f6c5c] data-[state=unchecked]:bg-[#b7ad99] dark:data-[state=checked]:bg-[#8e593f] dark:data-[state=unchecked]:bg-[#665943]"
            data-testid="switch-manual-tracking"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOverride}
          className="campaign-toolbar-button"
        >
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Override Pool
        </Button>
        {isUsingOverride && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onResetToLevel}
            className="campaign-toolbar-button"
          >
            Reset to Level
          </Button>
        )}
      </div>
      
      <div className="mx-auto mt-4 flex min-h-[7.5rem] w-full flex-wrap items-center justify-center gap-x-3 gap-y-2">
        {/* Show all dice positions based on original dice */}
        {originalDice.map((originalDie, index) => {
          const currentDie = currentDice[index];
          const canRestore = currentDie !== originalDie;
          const isRollingDie = isRolling && rollingDieIndex === index;
          
          return (
            <div key={index} className="flex w-20 flex-col items-center">
              <div className="flex h-16 w-16 items-center justify-center">
                {currentDie ? (
                  isRollingDie ? (
                    <AnimatedDie
                      size={currentDie}
                      isRolling={isRolling}
                      finalResult={rollResult ?? undefined}
                      success={rollSuccess ?? undefined}
                      onRollComplete={() => onRollComplete?.(rollToken)}
                    />
                  ) : (
                    <SpiritDie
                      size={currentDie}
                      isActive={true}
                      isSelected={!isManualTracking && selectedDieIndex === index}
                      onClick={!isManualTracking ? () => onDieSelect(index) : undefined}
                      isManualMode={isManualTracking}
                      onWheelAdjust={isManualTracking ? (newValue) => onManualDieAdjust(index, newValue) : undefined}
                      maxValue={originalDie}
                    />
                  )
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-sm border-2 border-dashed border-[#aa9b80] bg-[#f4ecdc]/35 dark:border-[#806b48] dark:bg-[#4d3e29]/20">
                    <span className="text-xs text-[#817d71] dark:text-[#a99c83]">
                      {originalDie}
                    </span>
                  </div>
                )}
              </div>
              {(canRestore || isManualTracking) && (
                <div className="mt-2 flex h-10 items-start justify-center">
                  {!isManualTracking && canRestore && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDieRestore(index)}
                      className="h-6 px-2 text-xs text-[#6a756e] hover:bg-[#e4eadf] hover:text-[#31594d] dark:text-[#a99c83] dark:hover:bg-[#594326]/30 dark:hover:text-[#ddc69c]"
                      title={!currentDie ? "Restore to d4" : "Increase die size by one step"}
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />
                      Restore
                    </Button>
                  )}
                  {isManualTracking && (
                    <div className="text-center text-xs text-[#5f665f] dark:text-[#a99c83]">
                      Click to change
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        
        {currentDice.every((die) => die === null) && (
          <div className="text-center py-8 flex flex-col items-center">
            <p className="mb-4 text-[#5f665f] dark:text-[#a99c83]">No active dice remaining</p>
            {originalDice.length > 0 && (
              <Button
                onClick={onRestoreAll}
                variant="outline"
                size="sm"
                className="wuxia-secondary-action"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Restore All Dice ({originalDice.join(', ')})
              </Button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
