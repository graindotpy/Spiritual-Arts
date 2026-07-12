import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { requestJson } from "@/lib/api";
import { characterKeys } from "@/lib/query-keys";
import { useToast } from "@/hooks/use-toast";
import type { Tracker } from "@shared/schema";

interface TrackerProps {
  tracker: Tracker;
  onDelete: (id: string) => void;
}

export default function TrackerComponent({ tracker, onDelete }: TrackerProps) {
  const [currentValue, setCurrentValue] = useState(tracker.currentValue || 0);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    setCurrentValue(tracker.currentValue);
  }, [tracker.currentValue]);

  const updateMutation = useMutation({
    mutationFn: async (value: number) => {
      return requestJson<Tracker>("PUT", `/api/trackers/${tracker.id}`, {
        currentValue: value,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: characterKeys.trackers(tracker.characterId),
      });
    },
    onError: () => {
      setCurrentValue(tracker.currentValue);
      toast({ title: "Tracker update failed", variant: "destructive" });
    },
  });

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    setCurrentValue(value);
  };

  const saveValue = () => {
    if (currentValue !== tracker.currentValue && !updateMutation.isPending) {
      updateMutation.mutate(currentValue);
    }
  };

  return (
    <div className="character-tracker-row flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <h4 className="truncate text-sm font-semibold text-[#33473f] dark:text-[#e7dcc7]">
          {tracker.name}
        </h4>
        {tracker.target && (
          <p className="mt-0.5 truncate text-xs text-[#77786f] dark:text-[#a99c83]">
            Target {tracker.target}
          </p>
        )}
      </div>

      <Input
        type="number"
        value={currentValue}
        onChange={handleValueChange}
        onBlur={saveValue}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setCurrentValue(tracker.currentValue);
            event.currentTarget.blur();
          }
        }}
        aria-label={`${tracker.name} current value`}
        className="h-9 w-20 shrink-0 rounded-sm border-[#b9aa8f] bg-[#fffaf0]/40 px-2 text-center font-semibold text-[#33473f] dark:border-[#806b48] dark:bg-[#211c15]/45 dark:text-[#eee3ce]"
        data-testid={`input-tracker-${tracker.name.toLowerCase().replace(/\s+/g, '-')}`}
      />

      <Button
        size="sm"
        variant="ghost"
        onClick={() => onDelete(tracker.id)}
        aria-label={`Delete ${tracker.name} tracker`}
        className="h-9 w-9 shrink-0 p-0 text-[#8a8478] hover:bg-[#f2ded8] hover:text-[#9b4437] dark:text-[#9d8f78] dark:hover:bg-[#712f27]/25 dark:hover:text-[#e5a89d]"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
