import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RotateCcw, Settings } from "lucide-react";
import SpiritDie from "./spirit-die";
import AnimatedDie from "./animated-die";
import type { SpiritDiePool, DieSize } from "@shared/schema";

interface SpiritDiePoolProps {
  currentDice: Array<DieSize | null>;
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
  maxDiceForLevel: DieSize[];
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
  maxDiceForLevel
}: SpiritDiePoolProps) {
  const hasActiveDice = currentDice.some((die) => Boolean(die));

  return (
    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
      <div className="text-center mb-4">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Spirit Die Pool</h3>
      </div>
      
      {/* Manual Tracking Switch */}
      <div className="flex items-center justify-center space-x-3 mb-4" data-testid="manual-tracking-toggle">
        <Settings className="w-4 h-4 text-gray-500 dark:text-gray-400" />
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
      
      <div className="flex items-start justify-center space-x-4 mt-4">
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
                      maxValue={maxDiceForLevel[index]}
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
        
        {!hasActiveDice && (
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
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-end">
          <Button
            onClick={onRestoreAll}
            variant="outline"
            size="sm"
            className="border-spiritual-600 text-spiritual-600 hover:bg-spiritual-50 dark:border-spiritual-400 dark:text-spiritual-400 dark:hover:bg-spiritual-900"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Long Rest
          </Button>
        </div>
      </div>
    </div>
  );
}
