import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { DieSize } from "@shared/schema";

interface AnimatedDieProps {
  size: DieSize;
  isRolling: boolean;
  finalResult?: number;
  onRollComplete?: (result: number) => void;
  className?: string;
}

export default function AnimatedDie({ 
  size, 
  isRolling, 
  finalResult, 
  onRollComplete, 
  className 
}: AnimatedDieProps) {
  const [currentValue, setCurrentValue] = useState<number>(1);
  const [animationClass, setAnimationClass] = useState("");

  // Get the maximum value for the die
  const getMaxValue = (dieSize: DieSize): number => {
    return parseInt(dieSize.substring(1)); // Remove 'd' and convert to number
  };

  // Generate random values during rolling animation
  useEffect(() => {
    if (!isRolling) return;

    setAnimationClass("");
    const maxValue = getMaxValue(size);
    
    // Show random values during rolling
    const rollInterval = setInterval(() => {
      setCurrentValue(Math.floor(Math.random() * maxValue) + 1);
    }, 150);

    // Stop rolling after 1.5 seconds and show final result
    const rollTimeout = setTimeout(() => {
      clearInterval(rollInterval);
      setAnimationClass("");
      
      if (finalResult !== undefined) {
        setCurrentValue(finalResult);
        onRollComplete?.(finalResult);
      }
    }, 1500);

    return () => {
      clearInterval(rollInterval);
      clearTimeout(rollTimeout);
    };
  }, [isRolling, finalResult, size, onRollComplete]);

  // Update current value when not rolling
  useEffect(() => {
    if (!isRolling && finalResult !== undefined) {
      setCurrentValue(finalResult);
    }
  }, [finalResult, isRolling]);

  return (
    <div className={cn("relative group", className)}>
      <div 
        className={cn(
          "w-16 h-16 rounded-lg flex items-center justify-center font-bold text-xl shadow-lg transform transition-all duration-200 border-2",
          "select-none",
          isRolling 
            ? cn(
                "bg-gradient-to-br from-amber-400 to-orange-600 text-white border-amber-300",
                "dark:from-amber-500 dark:to-orange-700 dark:border-amber-400 dark:text-white",
                "shadow-xl scale-110",
                "[text-shadow:_0_1px_2px_rgb(0_0_0_/_0.8)]",
                animationClass
              )
            : cn(
                "bg-gradient-to-br from-spiritual-400 to-spiritual-600 text-white border-spiritual-300",
                "dark:from-spiritual-500 dark:to-spiritual-700 dark:border-spiritual-400 dark:text-white",
                "hover:scale-105 hover:shadow-xl",
                "[text-shadow:_0_1px_2px_rgb(0_0_0_/_0.8)]"
              )
        )}
      >
        {currentValue}
      </div>
      
      {/* Die type indicator */}
      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-gray-600 dark:text-gray-400">
        {size}
      </div>
      
      {/* Rolling indicator bar */}
      {isRolling && (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 w-20 h-6 bg-amber-100 dark:bg-amber-900 rounded-md border border-amber-300 dark:border-amber-700 flex items-center justify-center animate-pulse">
          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
            Rolling...
          </span>
        </div>
      )}
    </div>
  );
}