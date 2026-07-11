export type CardType = "fighter" | "spy" | "support";

export type RowType = "fighter" | "spy";

export type Phase =
  | "deploy_spies"
  | "deploy_fighters"
  | "redeploy"
  | "results";

export type RedeployStage = "select" | "place";

export type CardLocation =
  | { type: "hand"; ownerFactionId: string }
  | {
      type: "slot";
      battlefieldId: string;
      lane: 0 | 1;
      row: RowType;
      index: number;
    }
  | { type: "attached"; hostId: string };

export type CardArtPlacement = {
  offsetX: number;
  offsetY: number;
  scale: number;
  cropLeft: number;
  cropTop: number;
  cropRight: number;
  cropBottom: number;
};

export type GameCard = {
  id: string;
  name: string;
  type: CardType;
  score: number;
  descriptor: string;
  abilityName: string;
  abilityDescription: string;
  ownerFactionId: string;
  imageUrl?: string;
  artUrl?: string;
  artAspectRatio?: number;
  artPlacement?: CardArtPlacement;
  location: CardLocation;
};

export type TemplateFieldKey =
  | "name"
  | "descriptor"
  | "abilityName"
  | "abilityDescription"
  | "score";

export type FontVariant = "normal" | "bold" | "italic" | "boldItalic";

export type TemplateTextField = {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  minFontSize: number;
  variant: FontVariant;
  align: "left" | "center" | "right";
};

export type CardTemplateLayout = {
  templateUrl?: string;
  fields: Record<TemplateFieldKey, TemplateTextField>;
};

export type EditorCardData = {
  name: string;
  type: CardType;
  score: number;
  descriptor: string;
  abilityName: string;
  abilityDescription: string;
  ownerFactionId: string;
  imageUrl: string;
  artUrl: string;
  artAspectRatio: number;
  artPlacement: CardArtPlacement;
};

export type Faction = {
  id: string;
  name: string;
  isDm: boolean;
  color: string;
};

export type Battlefield = {
  id: string;
  name: string;
  description: string;
  factionIds: string[];
};

export type SpyOutcome = {
  neutralizedSpyNames: string[];
  successfulSpyNames: string[];
  neutralizedEnemyCount: number;
};

export type SpyReportEvent = {
  id: string;
  outcomes: Record<string, SpyOutcome>;
};

export type MatchLogEntry = {
  id: string;
  round: number;
  message: string;
  createdAt: number;
  eventKey?: string;
};

export type PersistedCardGameState = {
  phase: Phase;
  redeployStage?: RedeployStage;
  redeployStages?: Record<string, RedeployStage>;
  nextPhaseVotes?: Record<string, boolean>;
  phaseVoteDirection?: "next" | "prev" | null;
  recentRedeployIds?: string[];
  round: number;
  activeBattlefieldId: string;
  battlefields: Battlefield[];
  cards: GameCard[];
  cardTemplates?: Record<CardType, CardTemplateLayout>;
  redeployIds: string[];
  redeploySelections?: Record<string, string[]>;
  factions: Faction[];
  spyReportEvent?: SpyReportEvent | null;
  matchLog?: MatchLogEntry[];
  updatedAt: number;
};

export type CardGameStateResponse = {
  state?: PersistedCardGameState | null;
  updatedAt?: unknown;
};

export type ResultsAnnouncement = {
  round: number;
  winnerFactionId: string | null;
  winnerScore: number;
  runnerUpScore: number;
};
