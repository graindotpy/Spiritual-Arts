import type { GameCard, Phase, SpyOutcome } from "./types";

export function deriveSpyOutcomeFromTransition(
  previousPhase: Phase,
  previousCards: GameCard[],
  nextPhase: Phase,
  nextCards: GameCard[],
  viewerFactionId: string | null,
): SpyOutcome | null {
  if (!viewerFactionId) return null;
  if (previousPhase !== "deploy_spies" || nextPhase === "deploy_spies") return null;

  const nextById = new Map(nextCards.map((card) => [card.id, card]));
  const neutralizedOwnSpyNames = new Set<string>();
  const successfulOwnSpyNames = new Set<string>();
  const enemyMovedLaneKeys = new Set<string>();
  let neutralizedEnemyCount = 0;

  for (const previousCard of previousCards) {
    if (previousCard.type !== "spy") continue;
    if (previousCard.location.type !== "slot" || previousCard.location.row !== "spy") continue;
    const nextCard = nextById.get(previousCard.id);
    const movedToHand = Boolean(nextCard && nextCard.location.type === "hand");
    const laneKey = `${previousCard.location.battlefieldId}::${previousCard.location.lane}`;

    if (previousCard.ownerFactionId === viewerFactionId) {
      if (movedToHand) neutralizedOwnSpyNames.add(previousCard.name || "Unnamed Spy");
      continue;
    }

    if (movedToHand) {
      enemyMovedLaneKeys.add(laneKey);
      neutralizedEnemyCount += 1;
    }
  }

  if (enemyMovedLaneKeys.size) {
    for (const previousCard of previousCards) {
      if (previousCard.type !== "spy") continue;
      if (previousCard.ownerFactionId !== viewerFactionId) continue;
      if (previousCard.location.type !== "slot" || previousCard.location.row !== "spy") continue;
      const laneKey = `${previousCard.location.battlefieldId}::${previousCard.location.lane}`;
      if (!enemyMovedLaneKeys.has(laneKey)) continue;
      const nextCard = nextById.get(previousCard.id);
      const movedToHand = Boolean(nextCard && nextCard.location.type === "hand");
      if (!movedToHand) {
        successfulOwnSpyNames.add(previousCard.name || "Unnamed Spy");
      }
    }
  }

  if (!neutralizedOwnSpyNames.size && !successfulOwnSpyNames.size && !neutralizedEnemyCount) {
    return null;
  }

  return {
    neutralizedSpyNames: [...neutralizedOwnSpyNames],
    successfulSpyNames: [...successfulOwnSpyNames],
    neutralizedEnemyCount,
  };
}
