import { useState } from "react";
import { Check, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DIE_SIZES, type DieSize } from "@shared/spirit-dice";

interface SpiritDieProps {
  size: DieSize;
  isActive: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
  isManualMode?: boolean;
  onWheelAdjust?: (newValue: DieSize) => void;
  maxValue?: DieSize;
}

export default function SpiritDie({
  size,
  isActive,
  isSelected = false,
  onClick,
  className,
  isManualMode = false,
  onWheelAdjust,
  maxValue,
}: SpiritDieProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const maximumIndex = maxValue ? DIE_SIZES.indexOf(maxValue) : DIE_SIZES.length - 1;
  const availableDice = DIE_SIZES.slice(0, maximumIndex + 1);

  const handleClick = () => {
    if (isManualMode) {
      setShowDropdown(true);
      return;
    }
    onClick?.();
  };

  const handleDropdownSelect = (newValue: DieSize) => {
    onWheelAdjust?.(newValue);
    setShowDropdown(false);
  };

  return (
    <div className={cn("relative group", className)}>
      <button
        type="button"
        className={cn(
          "flex h-14 w-14 cursor-pointer select-none items-center justify-center rounded-lg border-2 text-lg font-bold shadow-lg transition-all duration-200",
          isActive
            ? cn(
                "border-spiritual-300 bg-gradient-to-br from-spiritual-400 to-spiritual-600 text-white",
                "hover:scale-105 hover:shadow-xl dark:border-spiritual-400 dark:from-spiritual-500 dark:to-spiritual-700",
                "[text-shadow:_0_1px_2px_rgb(0_0_0_/_0.8)]",
              )
            : "border-gray-400 bg-gradient-to-br from-gray-300 to-gray-500 text-gray-100 dark:border-gray-500 dark:from-gray-600 dark:to-gray-800 dark:text-gray-300",
          isSelected &&
            (isManualMode
              ? "scale-105 ring-4 ring-blue-400 ring-opacity-60"
              : "scale-105 ring-4 ring-spiritual-400 ring-opacity-60"),
        )}
        onClick={handleClick}
        aria-label={`${isManualMode ? "Change" : "Select"} ${size} spirit die`}
        aria-pressed={isSelected}
        data-testid={`spirit-die-${size}`}
      >
        {size}
      </button>

      {isSelected && (
        <span
          className={cn(
            "absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full shadow-lg",
            isManualMode ? "bg-blue-500 dark:bg-blue-400" : "bg-emerald-500 dark:bg-emerald-400",
          )}
          aria-hidden="true"
        >
          {isManualMode ? (
            <Settings className="h-3 w-3 text-white" />
          ) : (
            <Check className="h-3 w-3 text-white" />
          )}
        </span>
      )}

      {isManualMode && showDropdown && (
        <div className="absolute left-1/2 top-16 z-50 -translate-x-1/2">
          <Select
            value={size}
            onValueChange={handleDropdownSelect}
            open
            onOpenChange={setShowDropdown}
          >
            <SelectTrigger className="w-20" aria-label="Spirit die size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableDice.map((dieValue) => (
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
