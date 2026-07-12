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
    <section className="mt-6 border-t border-[#cdbfa7]/70 pt-5 dark:border-[#806b48]/55" aria-labelledby="trackers-heading">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <p className="wuxia-kicker mb-1">Live notes</p>
          <h2 id="trackers-heading" className="font-display text-2xl text-[#2b4139] dark:text-[#e9e2d5]">
            Trackers
          </h2>
        </div>
        <Button
          size="sm"
          onClick={onAdd}
          className="wuxia-primary-action h-9 w-9 rounded-sm p-0"
          aria-label="Add tracker"
          data-testid="button-add-tracker"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="divide-y divide-[#cdbfa7]/65 border-t border-[#cdbfa7]/65 dark:divide-[#806b48]/45 dark:border-[#806b48]/45">
        {trackers.map((tracker) => (
          <TrackerComponent key={tracker.id} tracker={tracker} onDelete={onDelete} />
        ))}
        {trackers.length === 0 && (
          <p className="py-5 text-center text-sm text-[#5f665f] dark:text-[#a99c83]">
            No trackers yet. Use the add button to create one.
          </p>
        )}
      </div>
    </section>
  );
}
