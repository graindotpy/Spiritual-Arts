import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Tracker } from "@shared/schema";

interface TrackerProps {
  tracker: Tracker;
  onDelete: (id: string) => void;
}

export default function TrackerComponent({ tracker, onDelete }: TrackerProps) {
  const [currentValue, setCurrentValue] = useState(tracker.currentValue || 0);
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (value: number) => {
      const response = await apiRequest('PUT', `/api/trackers/${tracker.id}`, {
        currentValue: value
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/character', tracker.characterId, 'trackers']
      });
    }
  });

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    setCurrentValue(value);
    updateMutation.mutate(value);
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
          {tracker.name}
        </h4>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDelete(tracker.id)}
          className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
      
      <Input
        type="number"
        value={currentValue}
        onChange={handleValueChange}
        className="w-full text-center font-medium"
        data-testid={`input-tracker-${tracker.name.toLowerCase().replace(/\s+/g, '-')}`}
      />
      
      {tracker.target && (
        <div className="mt-1 text-center text-xs text-gray-500 dark:text-gray-400">
          Target: {tracker.target}
        </div>
      )}
    </div>
  );
}