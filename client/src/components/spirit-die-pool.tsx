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
      <div className="mb-5 text-center">
        <p className="wuxia-kicker mb-1.5">Spirit Die Tracking</p>
        <h2 className="font-display text-2xl text-[#20352e] dark:text-[#f1eadc]">
          Spirit Die Pool
        </h2>
      </div>
      
      <div className="campaign-inner-surface mb-5 flex flex-wrap items-center justify-center gap-3 p-3">
        <div className="flex items-center gap-2" data-testid="manual-tracking-toggle">
          <Settings className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <Label htmlFor="manual-tracking" className="text-sm text-gray-700 dark:text-gray-300">
            Manual Tracking
          </Label>
          <Switch
            id="manual-tracking"
            checked={isManualTracking}
            onCheckedChange={onManualTrackingToggle}
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
          <Button type="button" variant="ghost" size="sm" onClick={onResetToLevel}>
            Reset to Level
          </Button>
        )}
      </div>
      
      <div className="mt-4 flex flex-wrap items-start justify-center gap-x-4 gap-y-2">
        {/* Show all dice positions based on original dice */}
        {originalDice.map((originalDie, index) => {
          const currentDie = currentDice[index];
          const canRestore = currentDie !== originalDie;
          const isRollingDie = isRolling && rollingDieIndex === index;
          
          return (
            <div key={index} className="flex flex-col items-center w-20">
              <div className="h-16 w-16 flex items-center justify-center">
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
                  <div className="w-12 h-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center">
                    <span className="text-xs text-gray-400">
                      {originalDie}
                    </span>
                  </div>
                )}
              </div>
              {/* Restore button positioned below the die - fixed height container to prevent shifting */}
              <div className="h-10 mt-2 flex items-start justify-center">
                {!isManualTracking && canRestore && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDieRestore(index)}
                    className="h-6 px-2 text-xs text-gray-500 hover:text-spiritual-600 dark:text-gray-400 dark:hover:text-spiritual-400"
                    title={!currentDie ? "Restore to d4" : "Increase die size by one step"}
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Restore
                  </Button>
                )}
                {isManualTracking && (
                  <div className="text-xs text-center text-gray-500 dark:text-gray-400">
                    Click to change
                  </div>
                )}
              </div>
            </div>
          );
        })}
        
        {currentDice.every((die) => die === null) && (
          <div className="text-center py-8 flex flex-col items-center">
            <p className="text-gray-500 dark:text-gray-400 mb-4">No active dice remaining</p>
            {originalDice.length > 0 && (
              <Button
                onClick={onRestoreAll}
                variant="outline"
                size="sm"
                className="bg-spiritual-50 border-spiritual-200 text-spiritual-700 hover:bg-spiritual-100 dark:bg-spiritual-900 dark:border-spiritual-700 dark:text-spiritual-300 dark:hover:bg-spiritual-800"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Restore All Dice ({originalDice.join(', ')})
              </Button>
            )}
          </div>
        )}

      </div>

      {/* Long Rest Button */}
      <div className="mt-4 border-t border-[#d1c5af]/70 pt-4 dark:border-white/10">
        <div className="flex justify-end">
          <Button
            onClick={onRestoreAll}
            variant="outline"
            size="sm"
            className="campaign-toolbar-button"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Long Rest
          </Button>
        </div>
      </div>
    </div>
  );
}
