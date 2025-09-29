import { useState } from "react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DieSize } from "@shared/schema";

interface SpiritDieProps {
  size: DieSize;
  isActive: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
  // Manual mode props
  isManualMode?: boolean;
  onWheelAdjust?: (newValue: DieSize) => void;
  maxValue?: DieSize;
}

export default function SpiritDie({ size, isActive, isSelected, onClick, className, isManualMode = false, onWheelAdjust, maxValue }: SpiritDieProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Define die progression for manual adjustments
  const dieProgression: DieSize[] = ["d4", "d6", "d8", "d10", "d12"];
  
  // Get available dice based on maxValue
  const getAvailableDice = (): DieSize[] => {
    if (!maxValue) return dieProgression;
    const maxIndex = dieProgression.indexOf(maxValue);
    return maxIndex !== -1 ? dieProgression.slice(0, maxIndex + 1) : dieProgression;
  };
  
  // Handle die click in manual mode
  const handleClick = () => {
    if (isManualMode) {
      setShowDropdown(true);
    } else if (onClick) {
      onClick();
    }
  };
  
  // Handle dropdown selection
  const handleDropdownSelect = (newValue: DieSize) => {
    if (onWheelAdjust) {
      onWheelAdjust(newValue);
    }
    setShowDropdown(false);
  };
  return (
    <div className={cn("relative group", className)}>
      <div 
        className={cn(
          "w-14 h-14 rounded-lg flex items-center justify-center font-bold text-lg shadow-lg transform transition-all duration-200 border-2",
          "cursor-pointer select-none",
          isActive 
            ? cn(
                "bg-gradient-to-br from-spiritual-400 to-spiritual-600 text-white border-spiritual-300",
                "dark:from-spiritual-500 dark:to-spiritual-700 dark:border-spiritual-400 dark:text-white",
                "hover:scale-105 hover:shadow-xl",
                "[text-shadow:_0_1px_2px_rgb(0_0_0_/_0.8)]"
              )
            : cn(
                "bg-gradient-to-br from-gray-300 to-gray-500 text-gray-100 border-gray-400",
                "dark:from-gray-600 dark:to-gray-800 dark:text-gray-300 dark:border-gray-500"
              ),
          isSelected && (isManualMode 
            ? "ring-4 ring-blue-400 ring-opacity-60 scale-105" 
            : "ring-4 ring-spiritual-400 ring-opacity-60 scale-105")
        )}
        onClick={handleClick}
        data-testid={`spirit-die-${size}`}
      >
        {size}
      </div>
      
      {isSelected && (
        <div className={cn(
          "absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-lg",
          isManualMode 
            ? "bg-blue-500 dark:bg-blue-400" 
            : "bg-emerald-500 dark:bg-emerald-400"
        )}>
          <span className="text-xs text-white font-bold">
            {isManualMode ? "⚙" : "✓"}
          </span>
        </div>
      )}
      
      {isManualMode && showDropdown && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50">
          <Select value={size} onValueChange={handleDropdownSelect} open={true} onOpenChange={setShowDropdown}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getAvailableDice().map((dieValue) => (
                <SelectItem key={dieValue} value={dieValue}>
                  {dieValue}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
