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
    <section className="mt-6 border-t border-[#d1c5af]/70 pt-5 dark:border-white/10" aria-labelledby="trackers-heading">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="trackers-heading" className="font-display text-xl text-[#2b4139] dark:text-[#e9e2d5]">
          Trackers
        </h2>
        <Button
          size="sm"
          onClick={onAdd}
          className="h-10 w-10 rounded-full bg-spiritual-600 text-white hover:bg-spiritual-700"
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
