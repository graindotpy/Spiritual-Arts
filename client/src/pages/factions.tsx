import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Faction = {
  id: string;
  name: string;
  isDm: boolean;
};

type PersistedCardGameState = {
  phase: string;
  round: number;
  activeBattlefieldId: string;
  battlefields: Array<{
    id: string;
    name: string;
    description: string;
    factionIds: string[];
  }>;
  cards: Array<{
    id: string;
    ownerFactionId: string;
    location: { type: string; battlefieldId?: string; lane?: number };
  }>;
  redeployIds: string[];
  factions: Faction[];
  updatedAt: number;
};

const createEmptyState = (): PersistedCardGameState => ({
  phase: "deploy_spies",
  round: 1,
  activeBattlefieldId: "",
  battlefields: [],
  cards: [],
  redeployIds: [],
  factions: [],
  updatedAt: Date.now(),
});

export default function FactionsPage() {
  const [, setLocation] = useLocation();
  const [cardState, setCardState] = useState<PersistedCardGameState>(createEmptyState);
  const [isLoaded, setIsLoaded] = useState(false);
  const [newFactionName, setNewFactionName] = useState("");
  const [newFactionIsDm, setNewFactionIsDm] = useState(false);
  const [error, setError] = useState("");

  const factions = cardState.factions;

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      try {
        const response = await fetch("/api/card-game/state");
        if (!response.ok) return;
        const data = await response.json();
        if (!isActive) return;
        const state = data?.state as PersistedCardGameState | null;
        if (!state) {
          setCardState(createEmptyState());
          setIsLoaded(true);
          return;
        }
        setCardState({
          ...state,
          factions: Array.isArray(state.factions) ? state.factions : [],
          battlefields: Array.isArray(state.battlefields) ? state.battlefields : [],
          cards: Array.isArray(state.cards) ? state.cards : [],
          updatedAt: typeof state.updatedAt === "number" ? state.updatedAt : Date.now(),
        });
        setIsLoaded(true);
      } catch (err) {
        console.error("Failed to load card game state", err);
        setError("Failed to load factions.");
      }
    };

    load();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const handle = window.setTimeout(() => {
      fetch("/api/card-game/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: cardState }),
      }).catch((err) => {
        console.error("Failed to save factions", err);
        setError("Failed to save factions.");
      });
    }, 300);

    return () => window.clearTimeout(handle);
  }, [cardState, isLoaded]);

  const addFaction = () => {
    const name = newFactionName.trim();
    if (!name) return;
    const id = `faction-${Date.now().toString(36)}`;
    const next: Faction = { id, name, isDm: newFactionIsDm };
    setCardState((prev) => ({
      ...prev,
      factions: [next, ...prev.factions],
      updatedAt: Date.now(),
    }));
    setNewFactionName("");
    setNewFactionIsDm(false);
    setError("");
  };

  const updateFaction = (id: string, update: Partial<Faction>) => {
    setCardState((prev) => ({
      ...prev,
      factions: prev.factions.map((faction) =>
        faction.id === id ? { ...faction, ...update } : faction
      ),
      updatedAt: Date.now(),
    }));
  };

  const deleteFaction = (id: string) => {
    setCardState((prev) => ({
      ...prev,
      factions: prev.factions.filter((faction) => faction.id !== id),
      battlefields: prev.battlefields.map((battlefield) => ({
        ...battlefield,
        factionIds: battlefield.factionIds.filter((factionId) => factionId !== id),
      })),
      cards: prev.cards.filter((card) => card.ownerFactionId !== id),
      updatedAt: Date.now(),
    }));
  };

  const dmCount = useMemo(
    () => factions.filter((faction) => faction.isDm).length,
    [factions]
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="border-b border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Factions</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Create and manage factions for the card game.
            </p>
          </div>
          <Button variant="outline" onClick={() => setLocation("/")}>
            Back to Menu
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-900/20 dark:text-rose-200">
            {error}
          </div>
        )}

        <Card className="border-gray-200 dark:border-gray-700">
          <CardContent className="space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Create Faction
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  DM factions will require code access on entry.
                </p>
              </div>
              <Button onClick={addFaction}>Add Faction</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <Input
                value={newFactionName}
                onChange={(event) => setNewFactionName(event.target.value)}
                placeholder="Faction name"
              />
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={newFactionIsDm}
                  onChange={(event) => setNewFactionIsDm(event.target.checked)}
                />
                DM Faction
              </label>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {factions.map((faction) => (
            <Card key={faction.id} className="border-gray-200 dark:border-gray-700">
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1 space-y-2">
                  <Input
                    value={faction.name}
                    onChange={(event) => updateFaction(faction.id, { name: event.target.value })}
                  />
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                    <input
                      type="checkbox"
                      checked={faction.isDm}
                      onChange={(event) =>
                        updateFaction(faction.id, { isDm: event.target.checked })
                      }
                    />
                    DM Faction
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                    {faction.isDm ? "DM" : "Player"}
                  </span>
                  <Button
                    variant="destructive"
                    onClick={() => deleteFaction(faction.id)}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {!factions.length && (
            <Card className="border-dashed border-gray-300 dark:border-gray-700">
              <CardContent className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                No factions yet. Add your first faction above.
              </CardContent>
            </Card>
          )}
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400">
          DM factions: {dmCount} · Total factions: {factions.length}
        </div>
      </main>
    </div>
  );
}
