import { useEffect } from "react";
import { cn } from "@/lib/utils";
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
  
  // Define die progression for manual adjustments
  const dieProgression: DieSize[] = ["d4", "d6", "d8", "d10", "d12"];
  
  // Get max die index based on maxValue
  const getMaxDieIndex = (): number => {
    if (!maxValue) return dieProgression.length - 1;
    const maxIndex = dieProgression.indexOf(maxValue);
    return maxIndex !== -1 ? maxIndex : dieProgression.length - 1;
  };
  
  // Handle mouse wheel adjustment
  const handleWheel = (e: WheelEvent) => {
    if (!isManualMode || !isSelected || !onWheelAdjust) return;
    
    e.preventDefault();
    
    const currentIndex = dieProgression.indexOf(size);
    if (currentIndex === -1) return;
    
    const maxIndex = getMaxDieIndex();
    let newIndex;
    
    if (e.deltaY < 0) {
      // Scrolling up - increase die size
      newIndex = Math.min(currentIndex + 1, maxIndex);
    } else {
      // Scrolling down - decrease die size  
      newIndex = Math.max(currentIndex - 1, 0);
    }
    
    if (newIndex !== currentIndex) {
      onWheelAdjust(dieProgression[newIndex]);
    }
  };
  
  // Add wheel event listener when in manual mode and selected
  useEffect(() => {
    if (isManualMode && isSelected && onWheelAdjust) {
      const handleWheelEvent = (e: WheelEvent) => handleWheel(e);
      
      // Add to document instead of specific element to capture wheel events
      document.addEventListener('wheel', handleWheelEvent, { passive: false });
      
      return () => document.removeEventListener('wheel', handleWheelEvent);
    }
  }, [isManualMode, isSelected, size, onWheelAdjust, maxValue]);
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
        onClick={onClick}
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
      
      {isManualMode && isSelected && (
        <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
          Scroll to adjust
        </div>
      )}
    </div>
  );
}
