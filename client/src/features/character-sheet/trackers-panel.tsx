import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import TrackerComponent from "@/components/tracker";
import type { Tracker } from "@shared/schema";

interface TrackersPanelProps {
  trackers: Tracker[];
  onAdd: () => void;
  onDelete: (trackerId: string) => void;
}

export function TrackersPanel({ trackers, onAdd, onDelete }: TrackersPanelProps) {
  return (
    <section className="mt-6" aria-labelledby="trackers-heading">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="trackers-heading" className="text-lg font-medium text-gray-700 dark:text-gray-300">
          Trackers
        </h2>
        <Button
          size="sm"
          onClick={onAdd}
          className="bg-spiritual-600 text-white hover:bg-spiritual-700"
          aria-label="Add tracker"
          data-testid="button-add-tracker"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-2">
        {trackers.map((tracker) => (
          <TrackerComponent key={tracker.id} tracker={tracker} onDelete={onDelete} />
        ))}
        {trackers.length === 0 && (
          <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
            No trackers yet. Use the add button to create one.
          </p>
        )}
      </div>
    </section>
  );
}
