import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { DieSize } from "@shared/schema";

interface AnimatedDieProps {
  size: DieSize;
  isRolling: boolean;
  finalResult?: number;
  success?: boolean;
  onRollComplete?: (result: number) => void;
  className?: string;
}

export default function AnimatedDie({ 
  size, 
  isRolling, 
  finalResult, 
  success,
  onRollComplete, 
  className 
}: AnimatedDieProps) {
  const [currentValue, setCurrentValue] = useState<number>(1);
  const [animationClass, setAnimationClass] = useState("");
  const [pulseClass, setPulseClass] = useState("");
  const rollCompleteRef = useRef(false);
  const finalResultRef = useRef<number | undefined>(undefined);
  const successRef = useRef<boolean | undefined>(undefined);
  const onRollCompleteRef = useRef<((result: number) => void) | undefined>(undefined);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    finalResultRef.current = finalResult;
  }, [finalResult]);

  useEffect(() => {
    successRef.current = success;
  }, [success]);

  useEffect(() => {
    onRollCompleteRef.current = onRollComplete;
  }, [onRollComplete]);

  // Get the maximum value for the die
  const getMaxValue = (dieSize: DieSize): number => {
    return parseInt(dieSize.substring(1)); // Remove 'd' and convert to number
  };

  // Generate random values during rolling animation
  useEffect(() => {
    if (!isRolling) return;

    setAnimationClass("");
    setPulseClass("");
    rollCompleteRef.current = false;
    const maxValue = getMaxValue(size);
    
    // Show random values during rolling
    const rollInterval = setInterval(() => {
      setCurrentValue(Math.floor(Math.random() * maxValue) + 1);
    }, 60);

    // Stop rolling after 0.5 seconds and show final result
    let pulseTimeout: ReturnType<typeof setTimeout> | undefined;
    let retryCount = 0;

    const resolveFinalResult = () => {
      const resolved = finalResultRef.current;
      const resolvedSuccess = successRef.current;
      if ((resolved === undefined || resolvedSuccess === undefined) && retryCount < 10) {
        retryCount += 1;
        retryTimeoutRef.current = setTimeout(resolveFinalResult, 50);
        return;
      }

      if (resolved === undefined) {
        rollCompleteRef.current = true;
        onRollCompleteRef.current?.(currentValue);
        return;
      }

      setCurrentValue(resolved);
      setPulseClass(
        resolvedSuccess === undefined
          ? ""
          : resolvedSuccess
            ? "ring-4 ring-amber-200/90 shadow-[0_0_45px_rgba(215,172,91,0.9)] animate-pulse [animation-duration:1.5s]"
            : "ring-4 ring-red-300/90 shadow-[0_0_45px_rgba(255,70,70,0.95)] animate-pulse [animation-duration:1.5s]"
      );

      pulseTimeout = setTimeout(() => {
        if (rollCompleteRef.current) return;
        rollCompleteRef.current = true;
        setPulseClass("");
        onRollCompleteRef.current?.(resolved);
      }, 900);
    };

    const rollTimeout = setTimeout(() => {
      clearInterval(rollInterval);
      setAnimationClass("");
      resolveFinalResult();
    }, 500);

    return () => {
      clearInterval(rollInterval);
      clearTimeout(rollTimeout);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (pulseTimeout) {
        clearTimeout(pulseTimeout);
      }
    };
  }, [isRolling, size]);

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
          pulseClass,
          isRolling 
            ? cn(
                "border-[#b58a55] bg-gradient-to-br from-[#a75a43] to-[#663329] text-[#fff5df]",
                "dark:border-[#c09a62] dark:from-[#914b39] dark:to-[#4d2923]",
                "shadow-xl scale-110",
                "[text-shadow:_0_1px_2px_rgb(0_0_0_/_0.8)]",
                animationClass
              )
            : cn(
                "border-[#b58a55] bg-gradient-to-br from-[#a75a43] to-[#663329] text-[#fff5df]",
                "dark:border-[#c09a62] dark:from-[#914b39] dark:to-[#4d2923]",
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
      
      {/* Rolling indicator bar removed to keep dice color consistent */}
    </div>
  );
}
