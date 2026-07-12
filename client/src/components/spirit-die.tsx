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
          "mx-auto flex h-16 w-16 cursor-pointer select-none items-center justify-center rounded-lg border-2 text-lg font-bold shadow-lg transition-all duration-200",
          isActive
            ? cn(
                "border-[#b58a55] bg-gradient-to-br from-[#a75a43] to-[#663329] text-[#fff5df]",
                "hover:scale-105 hover:shadow-xl dark:border-[#c09a62] dark:from-[#914b39] dark:to-[#4d2923]",
                "[text-shadow:_0_1px_2px_rgb(0_0_0_/_0.8)]",
              )
            : "border-[#a99a81] bg-gradient-to-br from-[#c7bba4] to-[#8e806a] text-[#f7efe1] dark:border-[#766349] dark:from-[#5d5040] dark:to-[#342d24] dark:text-[#c7baa1]",
          isSelected &&
            (isManualMode
              ? "scale-105 ring-4 ring-[#b77960]/60"
              : "scale-105 ring-4 ring-[#c19a60]/55"),
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
            isManualMode ? "bg-[#9b5141]" : "bg-[#c29a58]",
          )}
          aria-hidden="true"
        >
          {isManualMode ? (
            <Settings className="h-3 w-3 text-white" />
          ) : (
            <Check className="h-3 w-3 text-[#2f271b]" />
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
            <SelectTrigger
              className="w-20 rounded-sm border-[#a89470] bg-[#fffaf0] text-[#344f45] shadow-lg focus:ring-[#557d6f] dark:border-[#8d744b] dark:bg-[#30281d] dark:text-[#e5d3b2] dark:focus:ring-[#b48b52]"
              aria-label="Spirit die size"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="wuxia-select-content">
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
