import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Gem, LoaderCircle, X } from "lucide-react";
import {
  EnhancedContentDialog,
  type EnhancedContentSaveData,
} from "@/components/enhanced-content-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { requestJson } from "@/lib/api";
import type { Character, SpiritualInstrumentWithAssignments } from "@shared/schema";

interface InstrumentsPanelProps {
  character: Character;
  instruments: SpiritualInstrumentWithAssignments[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

export function InstrumentsPanel({
  character,
  instruments,
  isLoading,
  isError,
  onRetry,
}: InstrumentsPanelProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isDmMode = localStorage.getItem("dmMode") === "true";
  const [expandedInstrument, setExpandedInstrument] =
    useState<SpiritualInstrumentWithAssignments | null>(null);

  const assignment = useMutation({
    mutationFn: ({ instrument, assigned }: { instrument: SpiritualInstrumentWithAssignments; assigned: boolean }) =>
      requestJson<SpiritualInstrumentWithAssignments>(
        "PUT",
        `/api/instruments/${instrument.id}/assignments`,
        {
          characterIds: assigned
            ? [...new Set([...instrument.characterIds, character.id])]
            : instrument.characterIds.filter((id) => id !== character.id),
        },
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/instruments"] });
    },
    onError: () => toast({ title: "Instrument assignment failed", variant: "destructive" }),
  });

  const saveEnhancedContent = useMutation({
    mutationFn: ({
      instrumentId,
      data,
    }: {
      instrumentId: string;
      data: EnhancedContentSaveData;
    }) =>
      requestJson<SpiritualInstrumentWithAssignments>(
        "PUT",
        `/api/instruments/${instrumentId}`,
        {
          description: data.summary,
          expandedContent: data.expandedContent,
          hasExpandedContent: data.hasExpandedContent,
        },
      ),
    onSuccess: async (instrument) => {
      setExpandedInstrument(instrument);
      await queryClient.invalidateQueries({ queryKey: ["/api/instruments"] });
      toast({ title: "Instrument details saved" });
    },
    onError: () =>
      toast({ title: "Instrument details could not be saved", variant: "destructive" }),
  });

  return (
    <>
    <section className="mt-7 border-t border-[#cdbfa7]/70 pt-6 dark:border-[#806b48]/55">
      <div className="mb-3 flex items-center gap-2">
        <Gem className="h-4 w-4 text-[#85683f] dark:text-[#d0ad70]" />
        <div>
          <p className="wuxia-kicker">Spiritual Instruments</p>
          <h2 className="font-display text-xl text-[#283f37] dark:text-[#eee3ce]">Assigned to {character.name}</h2>
        </div>
      </div>
      {isLoading ? (
        <LoaderCircle className="mx-auto my-5 h-5 w-5 animate-spin text-muted-foreground" />
      ) : isError ? (
        <div className="py-2" role="alert">
          <p className="text-sm leading-6 text-muted-foreground">
            Spiritual Instruments could not be loaded.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="wuxia-secondary-action mt-2"
            onClick={onRetry}
          >
            Try again
          </Button>
        </div>
      ) : instruments.length === 0 ? (
        <p className="text-sm leading-6 text-muted-foreground">No spiritual instruments are assigned to this character.</p>
      ) : (
        <div className="space-y-2">
          {instruments.map((instrument) => {
            const pending = assignment.isPending && assignment.variables?.instrument.id === instrument.id;
            return (
              <div
                key={instrument.id}
                className="flex items-center gap-2 rounded-md border border-[#cdbfa7]/70 bg-white/35 p-1.5 text-sm dark:border-[#806b48]/55 dark:bg-white/[0.03]"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 rounded-sm px-2 py-2 text-left font-semibold text-[#314a41] transition-colors hover:bg-white/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#668678] dark:text-[#e4d6bc] dark:hover:bg-white/[0.06]"
                  onClick={() => setExpandedInstrument(instrument)}
                  aria-label={`Open details for ${instrument.name}`}
                >
                  <span className="block truncate">{instrument.name}</span>
                </button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="wuxia-icon-action h-10 w-10 shrink-0"
                  disabled={pending}
                  onClick={() => assignment.mutate({ instrument, assigned: false })}
                  aria-label={`Unassign ${instrument.name} from ${character.name}`}
                  title={`Unassign ${instrument.name}`}
                >
                  {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </section>
    {expandedInstrument && (
      <EnhancedContentDialog
        open
        onClose={() => setExpandedInstrument(null)}
        recordKey={expandedInstrument.id}
        title={expandedInstrument.name}
        eyebrow="Spiritual Instrument"
        description="The complete record of this instrument and its bound Impression."
        summaryTitle="How it works"
        summary={expandedInstrument.description}
        expandedContent={expandedInstrument.expandedContent}
        icon={Gem}
        canEdit={isDmMode}
        onSave={(data) =>
          saveEnhancedContent.mutateAsync({
            instrumentId: expandedInstrument.id,
            data,
          })
        }
      />
    )}
    </>
  );
}
