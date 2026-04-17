import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Repeat2,
  RotateCcw,
  Shield,
  Swords,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type CardType = "fighter" | "spy" | "support";
type RowType = "fighter" | "spy";
type Phase =
  | "deploy_spies"
  | "deploy_fighters"
  | "redeploy"
  | "results";
type RedeployStage = "select" | "place";

type CardLocation =
  | { type: "hand"; ownerFactionId: string }
  | {
      type: "slot";
      battlefieldId: string;
      lane: 0 | 1;
      row: RowType;
      index: number;
    }
  | { type: "attached"; hostId: string };

type GameCard = {
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

type TemplateFieldKey =
  | "name"
  | "descriptor"
  | "abilityName"
  | "abilityDescription"
  | "score";
type FontVariant = "normal" | "bold" | "italic" | "boldItalic";

type TemplateTextField = {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  minFontSize: number;
  variant: FontVariant;
  align: "left" | "center" | "right";
};

type CardArtPlacement = {
  offsetX: number;
  offsetY: number;
  scale: number;
  cropLeft: number;
  cropTop: number;
  cropRight: number;
  cropBottom: number;
};

type CardTemplateLayout = {
  templateUrl?: string;
  fields: Record<TemplateFieldKey, TemplateTextField>;
};

type EditorCardData = {
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

type CardArtHandle = "n" | "e" | "s" | "w" | "nw" | "ne" | "sw" | "se";

type CardArtInteraction =
  | {
      kind: "move";
      pointerId: number;
      startX: number;
      startY: number;
      originX: number;
      originY: number;
      width: number;
      height: number;
    }
  | {
      kind: "scale";
      pointerId: number;
      startX: number;
      startY: number;
      originPlacement: CardArtPlacement;
      originAspectRatio: number;
      handle: CardArtHandle;
      width: number;
      height: number;
    }
  | {
      kind: "crop";
      pointerId: number;
      startX: number;
      startY: number;
      originPlacement: CardArtPlacement;
      handle: CardArtHandle;
      width: number;
      height: number;
    };

type Faction = {
  id: string;
  name: string;
  isDm: boolean;
  color: string;
};

type Battlefield = {
  id: string;
  name: string;
  description: string;
  factionIds: string[];
};

type DragState = {
  cardId: string;
  offsetX: number;
  offsetY: number;
  x: number;
  y: number;
  origin: CardLocation;
};

type PersistedCardGameState = {
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

type SpyOutcome = {
  neutralizedSpyNames: string[];
  successfulSpyNames: string[];
  neutralizedEnemyCount: number;
};

type SpyReportEvent = {
  id: string;
  outcomes: Record<string, SpyOutcome>;
};

type ResultsAnnouncement = {
  round: number;
  winnerFactionId: string | null;
  winnerScore: number;
  runnerUpScore: number;
};

type MatchLogEntry = {
  id: string;
  round: number;
  message: string;
  createdAt: number;
  eventKey?: string;
};

const initialFactions: Faction[] = [
  { id: "faction-a", name: "Faction A", isDm: false, color: "#10b981" },
  { id: "faction-b", name: "Faction B", isDm: false, color: "#f43f5e" },
];

const initialBattlefields: Battlefield[] = [
  {
    id: "emberfall",
    name: "Emberfall Ridge",
    description: "Ash winds and molten threats.",
    factionIds: ["faction-a", "faction-b"],
  },
  {
    id: "thornbridge",
    name: "Thornbridge",
    description: "Dense wards and narrow bridges.",
    factionIds: ["faction-a", "faction-b"],
  },
  {
    id: "sunvale",
    name: "Sunvale Expanse",
    description: "Open sightlines and sudden storms.",
    factionIds: ["faction-a", "faction-b"],
  },
];

const rowConfig: { row: RowType; label: string; slots: number }[] = [
  { row: "fighter", label: "Fighter Line", slots: 4 },
  { row: "spy", label: "Spy Line", slots: 3 },
];

const createStarterDeck = (factionId: string): GameCard[] => [
  {
    id: `card-${factionId}-test1`,
    name: "Test Card",
    type: "fighter",
    score: 7,
    descriptor: "Test Descriptor",
    abilityName: "Test Ability",
    abilityDescription: "Test ability text.",
    ownerFactionId: factionId,
    location: { type: "hand", ownerFactionId: factionId },
  },
];

const TEMPLATE_FIELD_LABELS: Record<TemplateFieldKey, string> = {
  name: "Name",
  descriptor: "Descriptor",
  abilityName: "Ability Name",
  abilityDescription: "Ability Description",
  score: "Score",
};

const buildDefaultTemplateFields = (): Record<TemplateFieldKey, TemplateTextField> => ({
  name: {
    x: 11,
    y: 6.2,
    width: 58,
    height: 6.2,
    fontSize: 34,
    minFontSize: 14,
    variant: "normal",
    align: "center",
  },
  descriptor: {
    x: 10,
    y: 61.8,
    width: 80,
    height: 6.2,
    fontSize: 33,
    minFontSize: 14,
    variant: "normal",
    align: "center",
  },
  abilityName: {
    x: 16,
    y: 68.8,
    width: 68,
    height: 6.2,
    fontSize: 28,
    minFontSize: 12,
    variant: "italic",
    align: "center",
  },
  abilityDescription: {
    x: 10,
    y: 74.6,
    width: 80,
    height: 13,
    fontSize: 25,
    minFontSize: 10,
    variant: "normal",
    align: "left",
  },
  score: {
    x: 30,
    y: 90.8,
    width: 40,
    height: 5.2,
    fontSize: 30,
    minFontSize: 12,
    variant: "normal",
    align: "center",
  },
});

const createDefaultCardTemplates = (): Record<CardType, CardTemplateLayout> => ({
  fighter: { templateUrl: undefined, fields: buildDefaultTemplateFields() },
  spy: { templateUrl: undefined, fields: buildDefaultTemplateFields() },
  support: { templateUrl: undefined, fields: buildDefaultTemplateFields() },
});

const slotKey = (battlefieldId: string, lane: 0 | 1, row: RowType, index: number) =>
  `${battlefieldId}::${lane}::${row}::${index}`;

const canPlaceOnRow = (card: GameCard, row: RowType) =>
  (card.type === "fighter" && row === "fighter") ||
  (card.type === "spy" && row === "spy");

const phaseOrder: Phase[] = [
  "deploy_spies",
  "deploy_fighters",
  "redeploy",
  "results",
];

const phaseLabels: Record<Phase, string> = {
  deploy_spies: "Deploy Spies",
  deploy_fighters: "Deploy Fighters / Supports",
  redeploy: "Intel + Redeploy Fighters",
  results: "Results",
};

const DEFAULT_FACTION_COLORS = [
  "#10b981",
  "#f43f5e",
  "#38bdf8",
  "#f59e0b",
  "#a78bfa",
  "#14b8a6",
];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const hexToRgb = (hex: string) => {
  const cleaned = hex.replace("#", "").trim();
  const full = cleaned.length === 3 ? cleaned.split("").map((c) => `${c}${c}`).join("") : cleaned;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return { r: 255, g: 255, b: 255 };
  const value = Number.parseInt(full, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

const rgbaFromHex = (hex: string, alpha: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp01(alpha)})`;
};

const normalizeHexColor = (value: unknown, fallback: string) => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const expanded = trimmed
      .slice(1)
      .split("")
      .map((char) => `${char}${char}`)
      .join("");
    return `#${expanded.toLowerCase()}`;
  }
  return fallback;
};

const parsePersistedUpdatedAt = (value: unknown) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const BOARD_BASE_WIDTH = 1760;
const BOARD_BASE_HEIGHT = 900;
const TEMPLATE_NUDGE_STEP = 0.5;

const clampTemplatePercent = (value: unknown, fallback: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, numeric));
};

const clampTemplateFont = (value: unknown, fallback: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(8, Math.min(96, numeric));
};

const DEFAULT_CARD_ART_PLACEMENT: CardArtPlacement = {
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  cropLeft: 0,
  cropTop: 0,
  cropRight: 0,
  cropBottom: 0,
};

const CARD_CANVAS_ASPECT_RATIO = 2 / 3;
const MIN_CARD_ART_VISIBLE_PERCENT = 8;

const clampCardArtOffset = (value: unknown, fallback: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(-100, Math.min(100, numeric));
};

const clampCardArtScale = (value: unknown, fallback: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0.35, Math.min(4, numeric));
};

const clampCardArtCrop = (value: unknown, fallback: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(92, numeric));
};

const normalizeCardArtPlacement = (
  raw: Partial<CardArtPlacement> | undefined,
  fallback: CardArtPlacement = DEFAULT_CARD_ART_PLACEMENT
): CardArtPlacement => {
  let cropLeft = clampCardArtCrop(raw?.cropLeft, fallback.cropLeft);
  let cropTop = clampCardArtCrop(raw?.cropTop, fallback.cropTop);
  let cropRight = clampCardArtCrop(raw?.cropRight, fallback.cropRight);
  let cropBottom = clampCardArtCrop(raw?.cropBottom, fallback.cropBottom);
  const maxCropTotal = 100 - MIN_CARD_ART_VISIBLE_PERCENT;
  const horizontalCropTotal = cropLeft + cropRight;
  if (horizontalCropTotal > maxCropTotal && horizontalCropTotal > 0) {
    const ratio = maxCropTotal / horizontalCropTotal;
    cropLeft *= ratio;
    cropRight *= ratio;
  }
  const verticalCropTotal = cropTop + cropBottom;
  if (verticalCropTotal > maxCropTotal && verticalCropTotal > 0) {
    const ratio = maxCropTotal / verticalCropTotal;
    cropTop *= ratio;
    cropBottom *= ratio;
  }
  return {
    offsetX: clampCardArtOffset(raw?.offsetX, fallback.offsetX),
    offsetY: clampCardArtOffset(raw?.offsetY, fallback.offsetY),
    scale: clampCardArtScale(raw?.scale, fallback.scale),
    cropLeft: Number(cropLeft.toFixed(3)),
    cropTop: Number(cropTop.toFixed(3)),
    cropRight: Number(cropRight.toFixed(3)),
    cropBottom: Number(cropBottom.toFixed(3)),
  };
};

const normalizeArtAspectRatio = (value: unknown, fallback = CARD_CANVAS_ASPECT_RATIO) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return numeric;
};

const getCardArtBaseSize = (aspectRatio: number) => {
  const safeAspectRatio = normalizeArtAspectRatio(aspectRatio);
  if (safeAspectRatio > CARD_CANVAS_ASPECT_RATIO) {
    return {
      width: 100,
      height: (CARD_CANVAS_ASPECT_RATIO / safeAspectRatio) * 100,
    };
  }
  return {
    width: (safeAspectRatio / CARD_CANVAS_ASPECT_RATIO) * 100,
    height: 100,
  };
};

const getCardArtBox = (placement: CardArtPlacement, aspectRatio: number) => {
  const base = getCardArtBaseSize(aspectRatio);
  const width = base.width * placement.scale;
  const height = base.height * placement.scale;
  const left = 50 - width / 2 + placement.offsetX;
  const top = 50 - height / 2 + placement.offsetY;
  return { left, top, width, height };
};

const getCardArtCropBox = (
  placement: CardArtPlacement,
  aspectRatio: number
) => {
  const artBox = getCardArtBox(placement, aspectRatio);
  const width = artBox.width * ((100 - placement.cropLeft - placement.cropRight) / 100);
  const height = artBox.height * ((100 - placement.cropTop - placement.cropBottom) / 100);
  const left = artBox.left + (artBox.width * placement.cropLeft) / 100;
  const top = artBox.top + (artBox.height * placement.cropTop) / 100;
  return { left, top, width, height };
};

const getCardArtBoxStyle = (box: { left: number; top: number; width: number; height: number }) => ({
  left: `${box.left}%`,
  top: `${box.top}%`,
  width: `${box.width}%`,
  height: `${box.height}%`,
});

const createDefaultEditorData = (ownerFactionId: string): EditorCardData => ({
  name: "",
  type: "fighter",
  score: 0,
  descriptor: "",
  abilityName: "",
  abilityDescription: "",
  ownerFactionId,
  imageUrl: "",
  artUrl: "",
  artAspectRatio: CARD_CANVAS_ASPECT_RATIO,
  artPlacement: { ...DEFAULT_CARD_ART_PLACEMENT },
});

const buildEditorDataFromCard = (card: Pick<GameCard, "name" | "type" | "score" | "descriptor" | "abilityName" | "abilityDescription" | "ownerFactionId" | "imageUrl" | "artUrl" | "artAspectRatio" | "artPlacement">): EditorCardData => ({
  name: card.name,
  type: card.type,
  score: card.score,
  descriptor: card.descriptor,
  abilityName: card.abilityName,
  abilityDescription: card.abilityDescription,
  ownerFactionId: card.ownerFactionId,
  imageUrl: card.imageUrl ?? "",
  artUrl: card.artUrl ?? "",
  artAspectRatio: normalizeArtAspectRatio(card.artAspectRatio, CARD_CANVAS_ASPECT_RATIO),
  artPlacement: normalizeCardArtPlacement(card.artPlacement, DEFAULT_CARD_ART_PLACEMENT),
});

const loadImageAspectRatio = (src: string) =>
  new Promise<number | null>((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        resolve(null);
        return;
      }
      resolve(img.naturalWidth / img.naturalHeight);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });

const normalizeTemplateField = (
  raw: Partial<TemplateTextField> | undefined,
  fallback: TemplateTextField
): TemplateTextField => {
  const fontSize = clampTemplateFont(raw?.fontSize, fallback.fontSize);
  const minFontSize = clampTemplateFont(raw?.minFontSize, fallback.minFontSize);
  return {
    x: clampTemplatePercent(raw?.x, fallback.x),
    y: clampTemplatePercent(raw?.y, fallback.y),
    width: clampTemplatePercent(raw?.width, fallback.width),
    height: clampTemplatePercent(raw?.height, fallback.height),
    fontSize,
    minFontSize: Math.min(minFontSize, fontSize),
    variant:
      raw?.variant === "bold" ||
      raw?.variant === "italic" ||
      raw?.variant === "boldItalic"
        ? raw.variant
        : "normal",
    align:
      raw?.align === "left" || raw?.align === "center" || raw?.align === "right"
        ? raw.align
        : fallback.align,
  };
};

const normalizeCardTemplates = (raw: unknown): Record<CardType, CardTemplateLayout> => {
  const defaults = createDefaultCardTemplates();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return defaults;
  }
  const value = raw as Partial<Record<CardType, CardTemplateLayout>>;
  const cardTypes: CardType[] = ["fighter", "spy", "support"];
  const normalized = {} as Record<CardType, CardTemplateLayout>;
  for (const cardType of cardTypes) {
    const rawTemplate = value[cardType];
    const fallback = defaults[cardType];
    const rawFields = (rawTemplate?.fields ??
      {}) as Partial<Record<TemplateFieldKey, Partial<TemplateTextField>>>;
    normalized[cardType] = {
      templateUrl:
        typeof rawTemplate?.templateUrl === "string" && rawTemplate.templateUrl.trim()
          ? rawTemplate.templateUrl.trim()
          : fallback.templateUrl,
      fields: {
        name: normalizeTemplateField(rawFields.name, fallback.fields.name),
        descriptor: normalizeTemplateField(rawFields.descriptor, fallback.fields.descriptor),
        abilityName: normalizeTemplateField(rawFields.abilityName, fallback.fields.abilityName),
        abilityDescription: normalizeTemplateField(
          rawFields.abilityDescription,
          fallback.fields.abilityDescription
        ),
        score: normalizeTemplateField(rawFields.score, fallback.fields.score),
      },
    };
  }
  return normalized;
};

function AutoFitText({
  text,
  field,
}: {
  text: string;
  field: TemplateTextField;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [fontSize, setFontSize] = useState(field.fontSize);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let next = field.fontSize;
    const min = Math.min(field.minFontSize, field.fontSize);
    el.style.fontSize = `${next}px`;
    while (
      next > min &&
      (el.scrollHeight > el.clientHeight + 0.5 || el.scrollWidth > el.clientWidth + 0.5)
    ) {
      next -= 0.5;
      el.style.fontSize = `${next}px`;
    }
    setFontSize(Number(next.toFixed(2)));
  }, [field.fontSize, field.minFontSize, field.width, field.height, text]);

  const style =
    field.variant === "bold"
      ? { fontWeight: 700 as const, fontStyle: "normal" as const }
      : field.variant === "italic"
      ? { fontWeight: 400 as const, fontStyle: "italic" as const }
      : field.variant === "boldItalic"
      ? { fontWeight: 700 as const, fontStyle: "italic" as const }
      : { fontWeight: 400 as const, fontStyle: "normal" as const };

  return (
    <div
      ref={ref}
      className="h-full w-full overflow-hidden whitespace-pre-wrap break-words"
      style={{
        fontFamily: "'IM Fell English', serif",
        lineHeight: 1.05,
        letterSpacing: "0.01em",
        textAlign: field.align,
        fontSize,
        ...style,
      }}
    >
      {text}
    </div>
  );
}
const orderBattlefieldFactionIds = (factionIds: string[], factions: Faction[]) => {
  if (factionIds.length !== 2) {
    return { ordered: factionIds, remap: null as Map<number, number> | null };
  }
  const factionById = new Map(factions.map((faction) => [faction.id, faction]));
  const [firstId, secondId] = factionIds;
  const firstIsDm = Boolean(factionById.get(firstId)?.isDm);
  const secondIsDm = Boolean(factionById.get(secondId)?.isDm);
  if (firstIsDm === secondIsDm) {
    return { ordered: factionIds, remap: null as Map<number, number> | null };
  }
  const ordered = firstIsDm ? [firstId, secondId] : [secondId, firstId];
  if (ordered[0] === firstId) {
    return { ordered: factionIds, remap: null as Map<number, number> | null };
  }
  return { ordered, remap: new Map([[0, 1], [1, 0]]) };
};

export default function CardGame() {
  const [, setLocation] = useLocation();
  const [uiScale, setUiScale] = useState(1);
  const [phase, setPhase] = useState<Phase>("deploy_spies");
  const [round, setRound] = useState(1);
  const [factions, setFactions] = useState<Faction[]>(initialFactions);
  const [selectedFactionId, setSelectedFactionId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem("cardGameFactionId");
  });
  const [activeFactionId, setActiveFactionId] = useState<string | null>(null);
  const [viewFactionId, setViewFactionId] = useState<string | null>(null);
  const [battlefields, setBattlefields] = useState<Battlefield[]>(initialBattlefields);
  const [activeBattlefieldId, setActiveBattlefieldId] = useState(
    initialBattlefields[0]?.id ?? ""
  );
  const [cards, setCards] = useState<GameCard[]>(
    createStarterDeck(initialFactions[0]?.id ?? "faction-a")
  );
  const [editorCardId, setEditorCardId] = useState<string | null>(null);
  const [editorData, setEditorData] = useState<EditorCardData>(() =>
    createDefaultEditorData(initialFactions[0]?.id ?? "faction-a")
  );
  const [cardTemplates, setCardTemplates] = useState<Record<CardType, CardTemplateLayout>>(
    createDefaultCardTemplates()
  );
  const [templateEditorType, setTemplateEditorType] = useState<CardType>("fighter");
  const [selectedTemplateField, setSelectedTemplateField] = useState<TemplateFieldKey>("name");
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [artEditorOpen, setArtEditorOpen] = useState(false);
  const [artEditorCropMode, setArtEditorCropMode] = useState(false);
  const [pendingTemplateCopyTarget, setPendingTemplateCopyTarget] = useState<CardType | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [librarySortKey, setLibrarySortKey] = useState<"type" | "score">("type");
  const [librarySortDir, setLibrarySortDir] = useState<"asc" | "desc">("asc");
  const [redeploySelections, setRedeploySelections] = useState<Record<string, string[]>>({});
  const [redeployStage, setRedeployStage] = useState<RedeployStage>("select");
  const [redeployStages, setRedeployStages] = useState<Record<string, RedeployStage>>({});
  const [nextPhaseVotes, setNextPhaseVotes] = useState<Record<string, boolean>>({});
  const [phaseVoteDirection, setPhaseVoteDirection] = useState<"next" | "prev" | null>(null);
  const [focusedCardIds, setFocusedCardIds] = useState<string[]>([]);
  const [newBattlefieldName, setNewBattlefieldName] = useState("");
  const [newBattlefieldDescription, setNewBattlefieldDescription] = useState("");
  const [newBattlefieldFactionIds, setNewBattlefieldFactionIds] = useState<string[]>([]);
  const [confirmCardDeleteId, setConfirmCardDeleteId] = useState<string | null>(null);
  const [confirmBattlefieldDeleteId, setConfirmBattlefieldDeleteId] = useState<string | null>(null);
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [entryCode, setEntryCode] = useState("");
  const [entryTargetFaction, setEntryTargetFaction] = useState<Faction | null>(null);
  const [entryError, setEntryError] = useState("");
  const [editingFactionId, setEditingFactionId] = useState<string | null>(null);
  const [editingFactionColor, setEditingFactionColor] = useState("#10b981");

  const slotRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const handRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const hasLoadedStateRef = useRef(false);
  const hasAppliedRemoteStateRef = useRef(false);
  const pollingRef = useRef<number | null>(null);
  const lastUpdatedAtRef = useRef(0);
  const pendingSaveRef = useRef(false);
  const saveQueuedRef = useRef(false);
  const skipNextSaveRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const queuedSaveStateRef = useRef<PersistedCardGameState | null>(null);
  const latestPersistedStateRef = useRef<PersistedCardGameState | null>(null);
  const flushQueuedSaveRef = useRef<(() => void) | null>(null);
  const latestPhaseRef = useRef<Phase>("deploy_spies");
  const latestCardsRef = useRef<GameCard[]>([]);
  const lastSeenSpyReportIdsRef = useRef<Map<string, string>>(new Map());
  const lastShownResultsRoundRef = useRef<number | null>(null);
  const cardArtInteractionRef = useRef<CardArtInteraction | null>(null);
  const dragIntentRef = useRef<{
    cardId: string;
    startX: number;
    startY: number;
    dragging: boolean;
    pointerId: number;
  } | null>(null);
  const boardDragIntentRef = useRef<{
    cardId: string;
    startX: number;
    startY: number;
    dragging: boolean;
    pointerId: number;
  } | null>(null);
  const recentBoardDragCardIdRef = useRef<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoverSlotId, setHoverSlotId] = useState<string | null>(null);
  const [hoverCardId, setHoverCardId] = useState<string | null>(null);
  const [spyOutcome, setSpyOutcome] = useState<SpyOutcome | null>(null);
  const [spyReportEvent, setSpyReportEvent] = useState<SpyReportEvent | null>(null);
  const [resultsAnnouncement, setResultsAnnouncement] = useState<ResultsAnnouncement | null>(null);
  const [recentRedeployIds, setRecentRedeployIds] = useState<string[]>([]);
  const [matchLog, setMatchLog] = useState<MatchLogEntry[]>([]);
  const [leftPanelTab, setLeftPanelTab] = useState<"battlefields" | "log">("battlefields");
  const [redeployEnemySnapshotCards, setRedeployEnemySnapshotCards] = useState<GameCard[] | null>(
    null
  );
  const [pendingRoundFinish, setPendingRoundFinish] = useState(false);

  useEffect(() => {
    const updateScale = () => {
      if (typeof window === "undefined") return;
      // Keep drag math in the same coordinate space as pointer events (viewport CSS pixels).
      const scale = Math.min(
        window.innerWidth / BOARD_BASE_WIDTH,
        window.innerHeight / BOARD_BASE_HEIGHT
      );
      setUiScale(Number.isFinite(scale) && scale > 0 ? scale : 1);
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  useEffect(() => {
    if (editorCardId) return;
    setArtEditorOpen(false);
    setArtEditorCropMode(false);
    cardArtInteractionRef.current = null;
  }, [editorCardId]);

  useEffect(() => {
    if (!editorData.artUrl) return;
    let active = true;
    loadImageAspectRatio(editorData.artUrl).then((aspectRatio) => {
      if (!active || !aspectRatio) return;
      setEditorData((prev) =>
        prev.artUrl === editorData.artUrl
          ? { ...prev, artAspectRatio: normalizeArtAspectRatio(aspectRatio, prev.artAspectRatio) }
          : prev
      );
    });
    return () => {
      active = false;
    };
  }, [editorData.artUrl]);

  const factionMap = useMemo(() => {
    const map = new Map<string, Faction>();
    for (const faction of factions) {
      map.set(faction.id, faction);
    }
    return map;
  }, [factions]);

  const getFactionName = useCallback(
    (factionId: string | null | undefined) =>
      (factionId && factionMap.get(factionId)?.name) || "Unknown Faction",
    [factionMap]
  );

  const getFactionById = useCallback(
    (factionId: string | null | undefined) =>
      factionId ? factionMap.get(factionId) ?? null : null,
    [factionMap]
  );

  const getBattlefieldById = useCallback(
    (battlefieldId: string | null | undefined) =>
      battlefields.find((battlefield) => battlefield.id === battlefieldId) ?? null,
    [battlefields]
  );

  const getBattlefieldLaneFactionId = useCallback(
    (battlefieldId: string, lane: 0 | 1) =>
      getBattlefieldById(battlefieldId)?.factionIds?.[lane] ?? null,
    [getBattlefieldById]
  );

  const boardCards = useMemo(() => {
    if (phase !== "redeploy" || !redeployEnemySnapshotCards || !viewFactionId) {
      return cards;
    }
    const snapshotById = new Map(redeployEnemySnapshotCards.map((card) => [card.id, card]));
    return cards.map((card) => {
      // During redeploy, enemy fighter movements are hidden until the phase is complete.
      if (card.ownerFactionId === viewFactionId) return card;
      if (card.type !== "fighter") return card;
      const snapshotCard = snapshotById.get(card.id);
      if (
        !snapshotCard ||
        snapshotCard.location.type !== "slot" ||
        card.location.type !== "slot"
      ) {
        return card;
      }
      return snapshotCard;
    });
  }, [cards, phase, redeployEnemySnapshotCards, viewFactionId]);

  const appendMatchLog = useCallback(
    (
      message: string,
      options?: {
        round?: number;
        eventKey?: string;
      }
    ) => {
      const entryRound = options?.round ?? round;
      setMatchLog((prev) => {
        if (options?.eventKey && prev.some((entry) => entry.eventKey === options.eventKey)) {
          return prev;
        }
        const nextEntry: MatchLogEntry = {
          id: `log-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          round: entryRound,
          message,
          createdAt: Date.now(),
          eventKey: options?.eventKey,
        };
        return [...prev, nextEntry];
      });
    },
    [round]
  );

  const slotToCards = useMemo(() => {
    const map = new Map<string, GameCard[]>();
    for (const card of boardCards) {
      if (card.location.type === "slot") {
        const key = slotKey(
          card.location.battlefieldId,
          card.location.lane,
          card.location.row,
          card.location.index
        );
        const existing = map.get(key) ?? [];
        existing.push(card);
        map.set(key, existing);
      }
    }
    return map;
  }, [boardCards]);


  const visibleBattlefields = useMemo(() => {
    if (!viewFactionId) return [];
    return battlefields.filter((battlefield) =>
      battlefield.factionIds.includes(viewFactionId)
    );
  }, [battlefields, viewFactionId]);

  const normalizeState = useCallback(
    (
      rawState: PersistedCardGameState | null | undefined,
      fallbackUpdatedAt?: number
    ): PersistedCardGameState => {
      const incomingFactions = Array.isArray(rawState?.factions)
        ? rawState?.factions
            .filter((faction) => faction && typeof faction.id === "string")
            .map((faction, index) => {
              const fallbackColor =
                DEFAULT_FACTION_COLORS[index % DEFAULT_FACTION_COLORS.length] ?? "#10b981";
              return {
                id: String(faction.id),
                name: String(faction.name ?? "Faction"),
                isDm: Boolean(faction.isDm),
                color: normalizeHexColor((faction as { color?: unknown }).color, fallbackColor),
              };
            })
        : [];
      const safeFactions = incomingFactions.length ? incomingFactions : initialFactions;
      const factionIds = new Set(safeFactions.map((faction) => faction.id));
      const fallbackFactionId = safeFactions[0]?.id ?? "faction-a";
      const secondFactionId = safeFactions[1]?.id ?? fallbackFactionId;

      const mapLegacyOwner = (owner: unknown) =>
        owner === "dm" ? secondFactionId : fallbackFactionId;

      const laneRemapByBattlefieldId = new Map<string, Map<number, number>>();
      const safeBattlefields = (Array.isArray(rawState?.battlefields)
        ? rawState?.battlefields
        : initialBattlefields
      ).map((battlefield, index) => {
        const id =
          typeof battlefield?.id === "string"
            ? battlefield.id
            : `bf-${index}-${Date.now().toString(36)}`;
        const name =
          typeof battlefield?.name === "string" ? battlefield.name : "Battlefield";
        const description =
          typeof battlefield?.description === "string" ? battlefield.description : "";
        let factionIdsForBattlefield = Array.isArray(battlefield?.factionIds)
          ? battlefield.factionIds.filter((id) => factionIds.has(id))
          : [];
        if (!factionIdsForBattlefield.length && safeFactions.length >= 2) {
          factionIdsForBattlefield = safeFactions.slice(0, 2).map((faction) => faction.id);
        }
        if (factionIdsForBattlefield.length > 2) {
          factionIdsForBattlefield = factionIdsForBattlefield.slice(0, 2);
        }
        const { ordered, remap } = orderBattlefieldFactionIds(
          factionIdsForBattlefield,
          safeFactions
        );
        if (remap) {
          laneRemapByBattlefieldId.set(id, remap);
        }
        return { id, name, description, factionIds: ordered };
      });

      const safeCardsSource: any[] = Array.isArray((rawState as { cards?: unknown } | null)?.cards)
        ? ((rawState as { cards?: unknown[] }).cards as any[])
        : createStarterDeck(fallbackFactionId);
      const safeCards = safeCardsSource.map((card, index) => {
        const legacyCard = card as any;
        const artUrl =
          typeof card?.artUrl === "string" && card.artUrl.trim() ? card.artUrl : undefined;
        const artAspectRatio = artUrl
          ? normalizeArtAspectRatio(card?.artAspectRatio, CARD_CANVAS_ASPECT_RATIO)
          : undefined;
        const ownerFactionId =
          typeof card?.ownerFactionId === "string" && factionIds.has(card.ownerFactionId)
            ? card.ownerFactionId
            : mapLegacyOwner(legacyCard?.owner);
        const baseCard: GameCard = {
          id: typeof card?.id === "string" ? card.id : `card-${ownerFactionId}-${index}`,
          name: typeof card?.name === "string" ? card.name : "Card",
          type: card?.type === "spy" || card?.type === "support" ? card.type : "fighter",
          score: Number.isFinite(card?.score) ? Number(card.score) : 0,
          descriptor: typeof card?.descriptor === "string" ? card.descriptor : "",
          abilityName: typeof card?.abilityName === "string" ? card.abilityName : "",
          abilityDescription:
            typeof card?.abilityDescription === "string"
              ? card.abilityDescription
              : typeof legacyCard?.ability === "string"
              ? legacyCard.ability
              : "",
          ownerFactionId,
          imageUrl: typeof card?.imageUrl === "string" ? card.imageUrl : undefined,
          artUrl,
          artAspectRatio,
          artPlacement: artUrl
            ? normalizeCardArtPlacement(
                card?.artPlacement as Partial<CardArtPlacement> | undefined,
                DEFAULT_CARD_ART_PLACEMENT
              )
            : undefined,
          location: { type: "hand", ownerFactionId },
        };

        if (card?.location?.type === "slot") {
          const battlefieldId =
            typeof card.location.battlefieldId === "string"
              ? card.location.battlefieldId
              : safeBattlefields[0]?.id ?? "bf-default";
          const lane =
            typeof card.location.lane === "number"
              ? card.location.lane === 1
                ? 1
                : 0
              : legacyCard.location?.side === "dm"
              ? 1
              : 0;
          const row = card.location.row === "spy" ? "spy" : "fighter";
          const slotIndex = Number.isFinite(card.location.index)
            ? Number(card.location.index)
            : 0;
          const remap = laneRemapByBattlefieldId.get(battlefieldId);
          const remappedLane = remap ? remap.get(lane) ?? lane : lane;
          const normalizedLane: 0 | 1 = remappedLane === 1 ? 1 : 0;
          baseCard.location = {
            type: "slot",
            battlefieldId,
            lane: normalizedLane,
            row,
            index: slotIndex,
          };
        } else if (card?.location?.type === "attached") {
          const hostId =
            typeof card.location.hostId === "string" ? card.location.hostId : "";
          baseCard.location = { type: "attached", hostId };
        }

        return baseCard;
      });

      const rawPhase = (rawState as { phase?: unknown } | null | undefined)?.phase;
      const normalizedPhase: Phase =
        rawPhase === "intel"
          ? "redeploy"
          : rawPhase === "deploy_spies" ||
            rawPhase === "deploy_fighters" ||
            rawPhase === "redeploy" ||
            rawPhase === "results"
          ? rawPhase
          : "deploy_spies";
      const rawRedeployStage = (rawState as { redeployStage?: unknown } | null | undefined)
        ?.redeployStage;
      const normalizedRedeployStage: RedeployStage =
        normalizedPhase !== "redeploy"
          ? "select"
          : rawRedeployStage === "place"
          ? "place"
          : rawRedeployStage === "select"
          ? "select"
          : "select";
      const rawSpyReportEvent = (rawState as { spyReportEvent?: unknown } | null | undefined)
        ?.spyReportEvent as
        | { id?: unknown; outcomes?: Record<string, unknown> }
        | null
        | undefined;
      const safeFactionIds = new Set(safeFactions.map((faction) => faction.id));
      const rawNextPhaseVotes = (
        rawState as { nextPhaseVotes?: unknown } | null | undefined
      )?.nextPhaseVotes;
      const rawRedeployStages = (
        rawState as { redeployStages?: unknown } | null | undefined
      )?.redeployStages;
      const rawPhaseVoteDirection = (
        rawState as { phaseVoteDirection?: unknown } | null | undefined
      )?.phaseVoteDirection;
      const rawRecentRedeployIds = (
        rawState as { recentRedeployIds?: unknown } | null | undefined
      )?.recentRedeployIds;
      const normalizedPhaseVoteDirection: "next" | "prev" | null =
        rawPhaseVoteDirection === "next" || rawPhaseVoteDirection === "prev"
          ? rawPhaseVoteDirection
          : null;
      const normalizedNextPhaseVotes: Record<string, boolean> =
        rawNextPhaseVotes &&
        typeof rawNextPhaseVotes === "object" &&
        !Array.isArray(rawNextPhaseVotes)
          ? Object.fromEntries(
              Object.entries(rawNextPhaseVotes).filter(
                ([factionId, ready]) => safeFactionIds.has(factionId) && typeof ready === "boolean"
              )
            )
          : {};
      const normalizedRedeployStages: Record<string, RedeployStage> =
        rawRedeployStages &&
        typeof rawRedeployStages === "object" &&
        !Array.isArray(rawRedeployStages)
          ? Object.fromEntries(
              Object.entries(rawRedeployStages)
                .filter(([factionId, stage]) => safeFactionIds.has(factionId) && typeof stage === "string")
                .map(([factionId, stage]) => [
                  factionId,
                  stage === "place" ? "place" : "select",
                ])
            )
          : {};
      let normalizedSpyReportEvent: SpyReportEvent | null = null;
      if (
        rawSpyReportEvent &&
        typeof rawSpyReportEvent.id === "string" &&
        rawSpyReportEvent.id.trim() &&
        rawSpyReportEvent.outcomes &&
        typeof rawSpyReportEvent.outcomes === "object"
      ) {
        const normalizedOutcomes: Record<string, SpyOutcome> = {};
        Object.entries(rawSpyReportEvent.outcomes).forEach(([factionId, value]) => {
          const outcome = value as Partial<SpyOutcome> | undefined;
          normalizedOutcomes[factionId] = {
            neutralizedSpyNames: Array.isArray(outcome?.neutralizedSpyNames)
              ? outcome!.neutralizedSpyNames.filter((name) => typeof name === "string")
              : [],
            successfulSpyNames: Array.isArray(outcome?.successfulSpyNames)
              ? outcome!.successfulSpyNames.filter((name) => typeof name === "string")
              : [],
            neutralizedEnemyCount: Number.isFinite(outcome?.neutralizedEnemyCount)
              ? Number(outcome!.neutralizedEnemyCount)
              : 0,
          };
        });
        normalizedSpyReportEvent = {
          id: rawSpyReportEvent.id,
          outcomes: normalizedOutcomes,
        };
      }
      const normalizedMatchLog = Array.isArray((rawState as { matchLog?: unknown })?.matchLog)
        ? ((rawState as { matchLog?: unknown }).matchLog as unknown[])
            .filter((entry) => entry && typeof entry === "object")
            .map((entry, index) => {
              const value = entry as Partial<MatchLogEntry>;
              return {
                id:
                  typeof value.id === "string" && value.id.trim()
                    ? value.id
                    : `log-${index}-${Date.now().toString(36)}`,
                round: Number.isFinite(value.round) ? Number(value.round) : 1,
                message:
                  typeof value.message === "string" && value.message.trim()
                    ? value.message
                    : "Match event",
                createdAt: Number.isFinite(value.createdAt)
                  ? Number(value.createdAt)
                  : Date.now(),
                eventKey:
                  typeof value.eventKey === "string" && value.eventKey.trim()
                    ? value.eventKey
                    : undefined,
              };
            })
        : [];
      return {
        phase: normalizedPhase,
        redeployStage: normalizedRedeployStage,
        redeployStages: normalizedRedeployStages,
        nextPhaseVotes: normalizedNextPhaseVotes,
        phaseVoteDirection: normalizedPhaseVoteDirection,
        recentRedeployIds: Array.isArray(rawRecentRedeployIds)
          ? rawRecentRedeployIds.filter((id): id is string => typeof id === "string")
          : [],
        round: typeof rawState?.round === "number" ? rawState.round : 1,
        activeBattlefieldId: safeBattlefields.some(
          (battlefield) => battlefield.id === rawState?.activeBattlefieldId
        )
          ? rawState!.activeBattlefieldId
          : safeBattlefields[0]?.id ?? "",
        battlefields: safeBattlefields,
        cards: safeCards,
        cardTemplates: normalizeCardTemplates(
          (rawState as { cardTemplates?: unknown } | null | undefined)?.cardTemplates
        ),
        redeployIds: Array.isArray(rawState?.redeployIds)
          ? rawState?.redeployIds.filter((id) => typeof id === "string")
          : [],
        redeploySelections:
          rawState?.redeploySelections &&
          typeof rawState.redeploySelections === "object" &&
          !Array.isArray(rawState.redeploySelections)
            ? Object.fromEntries(
                Object.entries(rawState.redeploySelections).map(([factionId, ids]) => [
                  factionId,
                  Array.isArray(ids)
                    ? ids.filter((id): id is string => typeof id === "string")
                    : [],
                ])
              )
            : {
                [fallbackFactionId]: Array.isArray(rawState?.redeployIds)
                  ? rawState.redeployIds.filter((id): id is string => typeof id === "string")
                  : [],
              },
        factions: safeFactions,
        spyReportEvent: normalizedSpyReportEvent,
        matchLog: normalizedMatchLog,
        updatedAt:
          typeof rawState?.updatedAt === "number"
            ? rawState.updatedAt
            : typeof fallbackUpdatedAt === "number"
            ? fallbackUpdatedAt
            : 0,
      };
    },
    []
  );

  const deriveSpyOutcomeFromTransition = useCallback(
    (
      prevPhase: Phase,
      prevCards: GameCard[],
      nextPhase: Phase,
      nextCards: GameCard[],
      viewerFactionId: string | null
    ): SpyOutcome | null => {
      if (!viewerFactionId) return null;
      if (prevPhase !== "deploy_spies" || nextPhase === "deploy_spies") return null;

      const nextById = new Map(nextCards.map((card) => [card.id, card]));
      const neutralizedOwnSpyNames = new Set<string>();
      const successfulOwnSpyNames = new Set<string>();
      const enemyMovedLaneKeys = new Set<string>();
      let neutralizedEnemyCount = 0;

      for (const prevCard of prevCards) {
        if (prevCard.type !== "spy") continue;
        if (prevCard.location.type !== "slot" || prevCard.location.row !== "spy") continue;
        const nextCard = nextById.get(prevCard.id);
        const movedToHand = Boolean(nextCard && nextCard.location.type === "hand");
        const laneKey = `${prevCard.location.battlefieldId}::${prevCard.location.lane}`;

        if (prevCard.ownerFactionId === viewerFactionId) {
          if (movedToHand) {
            neutralizedOwnSpyNames.add(prevCard.name || "Unnamed Spy");
          }
          continue;
        }

        if (movedToHand) {
          enemyMovedLaneKeys.add(laneKey);
          neutralizedEnemyCount += 1;
        }
      }

      if (enemyMovedLaneKeys.size) {
        for (const prevCard of prevCards) {
          if (prevCard.type !== "spy") continue;
          if (prevCard.ownerFactionId !== viewerFactionId) continue;
          if (prevCard.location.type !== "slot" || prevCard.location.row !== "spy") continue;
          const laneKey = `${prevCard.location.battlefieldId}::${prevCard.location.lane}`;
          if (!enemyMovedLaneKeys.has(laneKey)) continue;
          const nextCard = nextById.get(prevCard.id);
          const movedToHand = Boolean(nextCard && nextCard.location.type === "hand");
          if (!movedToHand) {
            successfulOwnSpyNames.add(prevCard.name || "Unnamed Spy");
          }
        }
      }

      if (!neutralizedOwnSpyNames.size && !successfulOwnSpyNames.size && neutralizedEnemyCount === 0) {
        return null;
      }

      return {
        neutralizedSpyNames: Array.from(neutralizedOwnSpyNames),
        successfulSpyNames: Array.from(successfulOwnSpyNames),
        neutralizedEnemyCount,
      };
    },
    []
  );

  const applyPersistedState = useCallback((state: PersistedCardGameState) => {
    const canDeriveOutcome = hasAppliedRemoteStateRef.current;
    const derivedSpyOutcome = canDeriveOutcome
      ? deriveSpyOutcomeFromTransition(
          latestPhaseRef.current,
          latestCardsRef.current,
          state.phase,
          state.cards,
          viewFactionId
        )
      : null;
    setPhase(state.phase);
    setRedeployStage(state.redeployStage ?? "select");
    setRedeployStages(state.redeployStages ?? {});
    setNextPhaseVotes(state.nextPhaseVotes ?? {});
    setPhaseVoteDirection(state.phaseVoteDirection ?? null);
    setRecentRedeployIds(state.recentRedeployIds ?? []);
    if (state.phase !== "results") {
      setPendingRoundFinish(false);
    }
    setRound(state.round);
    setBattlefields(state.battlefields);
    setCards(state.cards);
    setCardTemplates(normalizeCardTemplates(state.cardTemplates));
    setFactions(state.factions);
    setActiveBattlefieldId(state.activeBattlefieldId);
    setRedeploySelections(state.redeploySelections ?? {});
    setSpyReportEvent(state.spyReportEvent ?? null);
    setMatchLog(state.matchLog ?? []);
    if (derivedSpyOutcome) {
      setSpyOutcome(derivedSpyOutcome);
    }
    skipNextSaveRef.current = true;
    lastUpdatedAtRef.current = state.updatedAt;
    hasAppliedRemoteStateRef.current = true;
  }, [deriveSpyOutcomeFromTransition, viewFactionId]);

  const scheduleQueuedSave = useCallback((delay = 300) => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    if (!queuedSaveStateRef.current) {
      saveQueuedRef.current = false;
      return;
    }
    saveQueuedRef.current = true;
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      flushQueuedSaveRef.current?.();
    }, delay);
  }, []);

  const flushQueuedSave = useCallback(() => {
    if (pendingSaveRef.current) return;
    const queuedState = queuedSaveStateRef.current;
    if (!queuedState) {
      saveQueuedRef.current = false;
      return;
    }

    queuedSaveStateRef.current = null;
    saveQueuedRef.current = false;
    pendingSaveRef.current = true;
    const state = { ...queuedState, updatedAt: lastUpdatedAtRef.current };

    fetch("/api/card-game/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    })
      .then(async (response) => {
        if (response.status === 409) {
          const data = await response.json();
          const remoteUpdatedAt = parsePersistedUpdatedAt(data?.updatedAt);
          if (typeof remoteUpdatedAt === "number") {
            lastUpdatedAtRef.current = Math.max(lastUpdatedAtRef.current, remoteUpdatedAt);
          }
          queuedSaveStateRef.current = latestPersistedStateRef.current ?? queuedState;
          saveQueuedRef.current = true;
          return;
        }
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        const remoteUpdatedAt = parsePersistedUpdatedAt(data?.updatedAt);
        if (typeof remoteUpdatedAt === "number") {
          lastUpdatedAtRef.current = Math.max(lastUpdatedAtRef.current, remoteUpdatedAt);
        }
      })
      .catch((error) => {
        console.error("Failed to save card game state", error);
      })
      .finally(() => {
        pendingSaveRef.current = false;
        if (queuedSaveStateRef.current) {
          scheduleQueuedSave(0);
        }
      });
  }, [scheduleQueuedSave]);

  useEffect(() => {
    flushQueuedSaveRef.current = flushQueuedSave;
  }, [flushQueuedSave]);

  useEffect(
    () => () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!selectedFactionId) {
      setActiveFactionId(null);
      setViewFactionId(null);
      hasAppliedRemoteStateRef.current = false;
      return;
    }
    if (!factionMap.has(selectedFactionId)) {
      setSelectedFactionId(null);
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("cardGameFactionId");
      }
      return;
    }
    setActiveFactionId(selectedFactionId);
    setViewFactionId(selectedFactionId);
    setEditorData((prev) => ({ ...prev, ownerFactionId: selectedFactionId }));
  }, [selectedFactionId, factionMap]);

  const selectFaction = useCallback((factionId: string) => {
    setSelectedFactionId(factionId);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("cardGameFactionId", factionId);
    }
  }, []);

  const resetFactionSelection = useCallback(() => {
    setSelectedFactionId(null);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("cardGameFactionId");
    }
  }, []);

  const handleEntrySelect = useCallback(
    (faction: Faction) => {
      setEntryError("");
      if (faction.isDm) {
        setEntryTargetFaction(faction);
        setEntryCode("");
        setEntryDialogOpen(true);
        return;
      }
      selectFaction(faction.id);
    },
    [selectFaction]
  );

  const handleEntryCodeSubmit = useCallback(() => {
    if (!entryTargetFaction) return;
    if (entryCode === "3142") {
      selectFaction(entryTargetFaction.id);
      setEntryTargetFaction(null);
      setEntryDialogOpen(false);
      setEntryCode("");
      setEntryError("");
      return;
    }
    setEntryError("Invalid code. Try again.");
    setEntryCode("");
  }, [entryCode, entryTargetFaction, selectFaction]);

  const startFactionColorEdit = useCallback((faction: Faction) => {
    setEditingFactionId(faction.id);
    setEditingFactionColor(normalizeHexColor(faction.color, "#10b981"));
  }, []);

  const saveFactionColor = useCallback(() => {
    if (!editingFactionId) return;
    const nextColor = normalizeHexColor(editingFactionColor, "#10b981");
    setFactions((prev) =>
      prev.map((faction) =>
        faction.id === editingFactionId ? { ...faction, color: nextColor } : faction
      )
    );
    setEditingFactionId(null);
  }, [editingFactionColor, editingFactionId]);

  useEffect(() => {
    if (!viewFactionId) {
      setActiveBattlefieldId("");
      return;
    }
    if (!visibleBattlefields.length) {
      setActiveBattlefieldId("");
      return;
    }
    if (!visibleBattlefields.some((field) => field.id === activeBattlefieldId)) {
      setActiveBattlefieldId(visibleBattlefields[0].id);
    }
  }, [activeBattlefieldId, viewFactionId, visibleBattlefields]);

  useEffect(() => {
    let isActive = true;
    const loadState = async () => {
      try {
        const response = await fetch("/api/card-game/state");
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (!isActive) return;
        const remoteUpdatedAt = parsePersistedUpdatedAt(data?.updatedAt);
        const normalized = normalizeState(data?.state, remoteUpdatedAt);
        hasLoadedStateRef.current = true;
        applyPersistedState(normalized);
      } catch (error) {
        console.error("Failed to load card game state", error);
      }
    };

    loadState();
    return () => {
      isActive = false;
    };
  }, [applyPersistedState, normalizeState]);

  useEffect(() => {
    if (pollingRef.current) {
      window.clearInterval(pollingRef.current);
    }
    pollingRef.current = window.setInterval(async () => {
      try {
        const response = await fetch("/api/card-game/state");
        if (!response.ok) return;
        const data = await response.json();
        if (pendingSaveRef.current || saveQueuedRef.current) return;
        const remoteUpdatedAt = parsePersistedUpdatedAt(data?.updatedAt);
        const normalized = normalizeState(data?.state, remoteUpdatedAt);
        if (normalized.updatedAt > lastUpdatedAtRef.current) {
          applyPersistedState(normalized);
        }
      } catch (error) {
        console.error("Failed to poll card game state", error);
      }
    }, 2000);
    return () => {
      if (pollingRef.current) {
        window.clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [applyPersistedState, normalizeState]);

  useEffect(() => {
    const state: PersistedCardGameState = {
      phase,
      redeployStage,
      redeployStages,
      nextPhaseVotes,
      phaseVoteDirection,
      recentRedeployIds,
      round,
      activeBattlefieldId,
      battlefields,
      cards,
      cardTemplates,
      redeployIds: [],
      redeploySelections,
      factions,
      spyReportEvent,
      matchLog,
      updatedAt: lastUpdatedAtRef.current,
    };
    latestPersistedStateRef.current = state;
    if (!hasLoadedStateRef.current) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    queuedSaveStateRef.current = state;
    scheduleQueuedSave(300);
  }, [
    phase,
    redeployStage,
    redeployStages,
    nextPhaseVotes,
    phaseVoteDirection,
    recentRedeployIds,
    round,
    activeBattlefieldId,
    battlefields,
    cards,
    cardTemplates,
    redeploySelections,
    factions,
    spyReportEvent,
    matchLog,
    scheduleQueuedSave,
  ]);

  const attachedSupport = useMemo(() => {
    const map = new Map<string, GameCard[]>();
    for (const card of cards) {
      if (card.location.type === "attached") {
        const list = map.get(card.location.hostId) ?? [];
        list.push(card);
        map.set(card.location.hostId, list);
      }
    }
    return map;
  }, [cards]);

  const focusCardPreview = useCallback(
    (card: GameCard, includeAttached: boolean) => {
      const attached = includeAttached ? attachedSupport.get(card.id) ?? [] : [];
      setFocusedCardIds([card.id, ...attached.map((support) => support.id)]);
    },
    [attachedSupport]
  );

  const rowScores = useMemo(() => {
    const scores = new Map<string, number>();
    for (const card of boardCards) {
      if (card.location.type === "slot") {
        const key = `${card.location.battlefieldId}::${card.location.lane}::${card.location.row}`;
        const bonus = attachedSupport.get(card.id)?.length ?? 0;
        scores.set(key, (scores.get(key) ?? 0) + card.score + bonus);
      }
    }
    return scores;
  }, [boardCards, attachedSupport]);
  const fighterTotalsByFaction = useMemo(() => {
    const totals = new Map<string, number>();
    for (const battlefield of battlefields) {
      ([
        [0, battlefield.factionIds[0]],
        [1, battlefield.factionIds[1]],
      ] as const).forEach(([lane, factionId]) => {
        if (!factionId) return;
        const key = `${battlefield.id}::${lane}::fighter`;
        const score = rowScores.get(key) ?? 0;
        totals.set(factionId, (totals.get(factionId) ?? 0) + score);
      });
    }
    return totals;
  }, [battlefields, rowScores]);

  const currentPhaseIndex = phaseOrder.indexOf(phase);
  const phaseProgress =
    phaseOrder.length <= 1
      ? 100
      : (currentPhaseIndex / (phaseOrder.length - 1)) * 100;
  const progressionFactionIds = useMemo(() => {
    const field = battlefields.find((battlefield) => battlefield.id === activeBattlefieldId);
    const laneFactionIds = (field?.factionIds ?? []).filter((id): id is string => Boolean(id));
    if (laneFactionIds.length >= 2) return laneFactionIds;
    const nonDmFactionIds = factions
      .filter((faction) => !faction.isDm)
      .map((faction) => faction.id);
    return nonDmFactionIds.length ? nonDmFactionIds : laneFactionIds;
  }, [activeBattlefieldId, battlefields, factions]);

  useEffect(() => {
    latestPhaseRef.current = phase;
    latestCardsRef.current = cards;
  }, [cards, phase]);

  useEffect(() => {
    if (phase !== "redeploy") {
      setRedeployEnemySnapshotCards(null);
      return;
    }
    setRedeployEnemySnapshotCards((prev) => {
      if (prev) return prev;
      return cards.map((card) => ({
        ...card,
        location:
          card.location.type === "slot"
            ? { ...card.location }
            : card.location.type === "attached"
            ? { ...card.location }
            : { ...card.location },
      }));
    });
  }, [cards, phase]);

  useEffect(() => {
    if (!spyReportEvent?.id) return;
    if (!selectedFactionId || !viewFactionId) return;
    const seenForFaction = lastSeenSpyReportIdsRef.current.get(viewFactionId);
    if (seenForFaction === spyReportEvent.id) return;
    lastSeenSpyReportIdsRef.current.set(viewFactionId, spyReportEvent.id);
    const outcome = spyReportEvent.outcomes[viewFactionId];
    if (
      outcome &&
      (outcome.neutralizedSpyNames.length > 0 ||
        outcome.successfulSpyNames.length > 0 ||
        outcome.neutralizedEnemyCount > 0)
    ) {
      setSpyOutcome(outcome);
    } else {
      setSpyOutcome(null);
    }
  }, [selectedFactionId, spyReportEvent, viewFactionId]);

  useEffect(() => {
    if (!spyReportEvent?.id) return;
    Object.entries(spyReportEvent.outcomes).forEach(([factionId, outcome]) => {
      if (outcome.neutralizedSpyNames.length > 0) {
        appendMatchLog(
          `${getFactionName(factionId)} lost spies: ${outcome.neutralizedSpyNames.join(", ")}`,
          {
            round,
            eventKey: `spy-neutralized:${spyReportEvent.id}:${factionId}`,
          }
        );
      }
      if (outcome.successfulSpyNames.length > 0) {
        appendMatchLog(
          `${getFactionName(factionId)} eliminated enemy spies with: ${outcome.successfulSpyNames.join(", ")}`,
          {
            round,
            eventKey: `spy-success:${spyReportEvent.id}:${factionId}`,
          }
        );
      }
    });
  }, [appendMatchLog, getFactionName, round, spyReportEvent]);
  useEffect(() => {
    if (phase !== "results") return;
    if (lastShownResultsRoundRef.current === round) return;
    const ranked = factions
      .map((faction) => ({
        factionId: faction.id,
        score: fighterTotalsByFaction.get(faction.id) ?? 0,
      }))
      .sort((a, b) => b.score - a.score);
    if (!ranked.length) return;
    const winner = ranked[0];
    const runnerUpScore = ranked[1]?.score ?? winner.score;
    const isTie = ranked.length > 1 && winner.score === runnerUpScore;
    lastShownResultsRoundRef.current = round;
    setResultsAnnouncement({
      round,
      winnerFactionId: isTie ? null : winner.factionId,
      winnerScore: winner.score,
      runnerUpScore,
    });
    for (const battlefield of battlefields) {
      const lane0FactionId = battlefield.factionIds[0];
      const lane1FactionId = battlefield.factionIds[1];
      if (!lane0FactionId || !lane1FactionId) continue;
      const lane0Score = rowScores.get(`${battlefield.id}::0::fighter`) ?? 0;
      const lane1Score = rowScores.get(`${battlefield.id}::1::fighter`) ?? 0;
      const eventKey = `results:${round}:${battlefield.id}`;
      if (lane0Score === lane1Score) {
        appendMatchLog(
          `Round ${round}: ${battlefield.name} ended in a draw (${lane0Score}-${lane1Score}).`,
          { round, eventKey }
        );
      } else {
        const winnerFactionIdForField = lane0Score > lane1Score ? lane0FactionId : lane1FactionId;
        const winnerScoreForField = Math.max(lane0Score, lane1Score);
        const loserScoreForField = Math.min(lane0Score, lane1Score);
        appendMatchLog(
          `Round ${round}: ${getFactionName(winnerFactionIdForField)} won ${battlefield.name} (${winnerScoreForField}-${loserScoreForField}).`,
          { round, eventKey }
        );
      }
    }
  }, [phase, round, factions, fighterTotalsByFaction, battlefields, rowScores, appendMatchLog, getFactionName]);

  const factionLibraryCards = useMemo(() => {
    const typeOrder: Record<CardType, number> = {
      fighter: 0,
      spy: 1,
      support: 2,
    };
    const sorted = cards.filter(
      (card) => selectedFactionId && card.ownerFactionId === selectedFactionId
    );
    sorted.sort((a, b) => {
      let compare = 0;
      if (librarySortKey === "type") {
        compare = typeOrder[a.type] - typeOrder[b.type];
        if (compare === 0) compare = b.score - a.score;
      } else {
        compare = a.score - b.score;
        if (compare === 0) compare = typeOrder[a.type] - typeOrder[b.type];
      }
      return librarySortDir === "asc" ? compare : -compare;
    });
    return sorted;
  }, [cards, librarySortDir, librarySortKey, selectedFactionId]);

  const openEditor = (card: GameCard) => {
    setEditorCardId(card.id);
    setEditorData(buildEditorDataFromCard(card));
  };

  const addNewCard = () => {
    setEditorCardId("new");
    setEditorData({
      ...createDefaultEditorData(selectedFactionId ?? factions[0]?.id ?? "faction-a"),
      name: "New Card",
      score: 1,
    });
  };

  const persistEditorChanges = useCallback(
    (options?: { closeEditor?: boolean; closeArtEditor?: boolean }) => {
      if (!editorCardId) return;
      const closeEditor = options?.closeEditor ?? false;
      const closeArtEditor = options?.closeArtEditor ?? closeEditor;
      const nextEditorId =
        editorCardId === "new" ? `card-${Date.now().toString(36)}` : editorCardId;
      const existingCard =
        editorCardId === "new" ? null : cards.find((card) => card.id === editorCardId) ?? null;
      const normalizedArtPlacement = editorData.artUrl
        ? normalizeCardArtPlacement(editorData.artPlacement, DEFAULT_CARD_ART_PLACEMENT)
        : undefined;
      const normalizedCardData: Omit<GameCard, "id" | "location"> = {
        name: editorData.name.trim() || "New Card",
        type: editorData.type,
        score: Number.isNaN(editorData.score) ? 0 : editorData.score,
        descriptor: editorData.descriptor,
        abilityName: editorData.abilityName,
        abilityDescription: editorData.abilityDescription,
        ownerFactionId: editorData.ownerFactionId,
        imageUrl: editorData.imageUrl || undefined,
        artUrl: editorData.artUrl || undefined,
        artAspectRatio: editorData.artUrl ? editorData.artAspectRatio : undefined,
        artPlacement: normalizedArtPlacement,
      };
      saveQueuedRef.current = true;
      if (editorCardId === "new") {
        const newCard: GameCard = {
          id: nextEditorId,
          ...normalizedCardData,
          location: { type: "hand", ownerFactionId: editorData.ownerFactionId },
        };
        setCards((prev) => [newCard, ...prev.filter((card) => card.id !== newCard.id)]);
        if (!closeEditor) {
          setEditorData(buildEditorDataFromCard(newCard));
        }
      } else {
        const nextCard: GameCard = {
          ...(existingCard ?? {
            id: nextEditorId,
            location: { type: "hand", ownerFactionId: editorData.ownerFactionId } as CardLocation,
          }),
          ...normalizedCardData,
          id: nextEditorId,
          location:
            existingCard && existingCard.ownerFactionId !== editorData.ownerFactionId
              ? { type: "hand", ownerFactionId: editorData.ownerFactionId }
              : existingCard?.location ?? { type: "hand", ownerFactionId: editorData.ownerFactionId },
        };
        setCards((prev) =>
          prev.some((card) => card.id === editorCardId)
            ? prev.map((card) => (card.id === editorCardId ? nextCard : card))
            : [nextCard, ...prev]
        );
        if (!closeEditor) {
          setEditorData(buildEditorDataFromCard(nextCard));
        }
      }
      if (closeArtEditor) {
        setArtEditorOpen(false);
        setArtEditorCropMode(false);
        cardArtInteractionRef.current = null;
      }
      if (closeEditor) {
        setEditorCardId(null);
        return;
      }
      setEditorCardId(nextEditorId);
    },
    [cards, editorCardId, editorData]
  );

  const saveEditor = useCallback(() => {
    persistEditorChanges({ closeEditor: true, closeArtEditor: true });
  }, [persistEditorChanges]);

  const saveEditorInPlace = useCallback(() => {
    persistEditorChanges({ closeEditor: false, closeArtEditor: false });
  }, [persistEditorChanges]);

  const saveEditorAndCloseArtDialog = useCallback(() => {
    persistEditorChanges({ closeEditor: false, closeArtEditor: true });
  }, [persistEditorChanges]);

  const deleteCard = (cardId: string) => {
    setCards((prev) => {
      const toDelete = new Set<string>();
      toDelete.add(cardId);
      for (const card of prev) {
        if (card.location.type === "attached" && card.location.hostId === cardId) {
          toDelete.add(card.id);
        }
      }
      return prev.filter((card) => !toDelete.has(card.id));
    });
    if (dragState?.cardId === cardId) {
      setDragState(null);
      setHoverSlotId(null);
      setHoverCardId(null);
    }
    setEditorCardId(null);
  };

  const requestDeleteCard = (cardId: string) => {
    setConfirmCardDeleteId(cardId);
  };

  const handleImageUpload = async (file: File) => {
    const url = await uploadImageAsset(file);
    if (!url) return;
    setEditorData((prev) => ({ ...prev, imageUrl: url }));
  };

  const handleCharacterArtUpload = async (file: File) => {
    const [url, aspectRatio] = await Promise.all([
      uploadImageAsset(file),
      new Promise<number | null>((resolve) => {
        const objectUrl = URL.createObjectURL(file);
        loadImageAspectRatio(objectUrl)
          .then(resolve)
          .finally(() => URL.revokeObjectURL(objectUrl));
      }),
    ]);
    if (!url) return;
    setEditorData((prev) => ({
      ...prev,
      artUrl: url,
      artAspectRatio: normalizeArtAspectRatio(aspectRatio, prev.artAspectRatio),
      artPlacement: { ...DEFAULT_CARD_ART_PLACEMENT },
    }));
  };

  const clearCharacterArt = useCallback(() => {
    setEditorData((prev) => ({
      ...prev,
      artUrl: "",
      artAspectRatio: CARD_CANVAS_ASPECT_RATIO,
      artPlacement: { ...DEFAULT_CARD_ART_PLACEMENT },
    }));
  }, []);

  const clearCardImageOverride = useCallback(() => {
    setEditorData((prev) => ({ ...prev, imageUrl: "" }));
  }, []);

  const updateEditorArtPlacement = useCallback((patch: Partial<CardArtPlacement>) => {
    setEditorData((prev) => ({
      ...prev,
      artPlacement: normalizeCardArtPlacement(
        {
          ...prev.artPlacement,
          ...patch,
        },
        prev.artPlacement
      ),
    }));
  }, []);

  const resetEditorArtPlacement = useCallback(() => {
    setEditorData((prev) => ({
      ...prev,
      artPlacement: { ...DEFAULT_CARD_ART_PLACEMENT },
    }));
  }, []);

  const resetEditorArtCrop = useCallback(() => {
    setEditorData((prev) => ({
      ...prev,
      artPlacement: normalizeCardArtPlacement(
        {
          ...prev.artPlacement,
          cropLeft: 0,
          cropTop: 0,
          cropRight: 0,
          cropBottom: 0,
        },
        prev.artPlacement
      ),
    }));
  }, []);

  const startEditorArtMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!editorData.artUrl || editorData.imageUrl) return;
      const container = event.currentTarget.closest("[data-art-canvas]");
      if (!(container instanceof HTMLElement)) return;
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      container.setPointerCapture(event.pointerId);
      cardArtInteractionRef.current = {
        kind: "move",
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: editorData.artPlacement.offsetX,
        originY: editorData.artPlacement.offsetY,
        width: rect.width,
        height: rect.height,
      };
    },
    [editorData.artPlacement.offsetX, editorData.artPlacement.offsetY, editorData.artUrl, editorData.imageUrl]
  );

  const startEditorArtHandleDrag = useCallback(
    (handle: CardArtHandle, event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!editorData.artUrl || editorData.imageUrl) return;
      event.preventDefault();
      event.stopPropagation();
      const container = event.currentTarget.closest("[data-art-canvas]");
      if (!(container instanceof HTMLElement)) return;
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      container.setPointerCapture(event.pointerId);
      cardArtInteractionRef.current = artEditorCropMode
        ? {
            kind: "crop",
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originPlacement: { ...editorData.artPlacement },
            handle,
            width: rect.width,
            height: rect.height,
          }
        : {
            kind: "scale",
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originPlacement: { ...editorData.artPlacement },
            originAspectRatio: editorData.artAspectRatio,
            handle,
            width: rect.width,
            height: rect.height,
          };
    },
    [artEditorCropMode, editorData.artAspectRatio, editorData.artPlacement, editorData.artUrl, editorData.imageUrl]
  );

  const moveEditorArtInteraction = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const interaction = cardArtInteractionRef.current;
      if (!interaction || interaction.pointerId !== event.pointerId) return;
      const deltaX = ((event.clientX - interaction.startX) / interaction.width) * 100;
      const deltaY = ((event.clientY - interaction.startY) / interaction.height) * 100;
      if (interaction.kind === "move") {
        updateEditorArtPlacement({
          offsetX: interaction.originX + deltaX,
          offsetY: interaction.originY + deltaY,
        });
        return;
      }
      if (interaction.kind === "scale") {
        const originBox = getCardArtBox(interaction.originPlacement, interaction.originAspectRatio);
        const widthDelta =
          interaction.handle === "nw" || interaction.handle === "sw"
            ? -deltaX
            : interaction.handle === "ne" || interaction.handle === "se"
            ? deltaX
            : 0;
        const heightDelta =
          interaction.handle === "nw" || interaction.handle === "ne"
            ? -deltaY
            : interaction.handle === "sw" || interaction.handle === "se"
            ? deltaY
            : 0;
        const widthFactor = originBox.width > 0 ? (originBox.width + widthDelta) / originBox.width : 1;
        const heightFactor =
          originBox.height > 0 ? (originBox.height + heightDelta) / originBox.height : 1;
        const widthChange = Math.abs(widthFactor - 1);
        const heightChange = Math.abs(heightFactor - 1);
        const nextFactor =
          widthChange >= heightChange
            ? widthFactor
            : heightFactor;
        const nextScale = clampCardArtScale(
          interaction.originPlacement.scale * nextFactor,
          interaction.originPlacement.scale
        );
        const base = getCardArtBaseSize(interaction.originAspectRatio);
        const nextWidth = base.width * nextScale;
        const nextHeight = base.height * nextScale;
        const anchorLeft =
          interaction.handle === "ne" || interaction.handle === "se"
            ? originBox.left
            : originBox.left + originBox.width - nextWidth;
        const anchorTop =
          interaction.handle === "sw" || interaction.handle === "se"
            ? originBox.top
            : originBox.top + originBox.height - nextHeight;
        updateEditorArtPlacement({
          scale: nextScale,
          offsetX: anchorLeft - (50 - nextWidth / 2),
          offsetY: anchorTop - (50 - nextHeight / 2),
        });
        return;
      }
      const origin = interaction.originPlacement;
      const originBox = getCardArtBox(origin, editorData.artAspectRatio);
      const cropDeltaX = originBox.width > 0 ? (deltaX / originBox.width) * 100 : 0;
      const cropDeltaY = originBox.height > 0 ? (deltaY / originBox.height) * 100 : 0;
      updateEditorArtPlacement({
        cropLeft:
          interaction.handle === "w" || interaction.handle === "nw" || interaction.handle === "sw"
            ? origin.cropLeft + cropDeltaX
            : origin.cropLeft,
        cropRight:
          interaction.handle === "e" || interaction.handle === "ne" || interaction.handle === "se"
            ? origin.cropRight - cropDeltaX
            : origin.cropRight,
        cropTop:
          interaction.handle === "n" || interaction.handle === "nw" || interaction.handle === "ne"
            ? origin.cropTop + cropDeltaY
            : origin.cropTop,
        cropBottom:
          interaction.handle === "s" || interaction.handle === "sw" || interaction.handle === "se"
            ? origin.cropBottom - cropDeltaY
            : origin.cropBottom,
      });
    },
    [editorData.artAspectRatio, updateEditorArtPlacement]
  );

  const endEditorArtInteraction = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const interaction = cardArtInteractionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    cardArtInteractionRef.current = null;
  }, []);

  const uploadImageAsset = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append("image", file);
      const response = await fetch("/api/upload/image", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) return null;
      const data = await response.json();
      return typeof data?.url === "string" ? data.url : null;
    } catch (error) {
      console.error("Failed to upload image", error);
      return null;
    }
  };

  const handleTemplateImageUpload = async (cardType: CardType, file: File) => {
    const url = await uploadImageAsset(file);
    if (!url) return;
    setCardTemplates((prev) => ({
      ...prev,
      [cardType]: {
        ...prev[cardType],
        templateUrl: url,
      },
    }));
  };

  const updateTemplateField = useCallback(
    (cardType: CardType, fieldKey: TemplateFieldKey, patch: Partial<TemplateTextField>) => {
      setCardTemplates((prev) => {
        const currentTemplate = prev[cardType];
        const currentField = currentTemplate.fields[fieldKey];
        const nextField = normalizeTemplateField(
          {
            ...currentField,
            ...patch,
          },
          currentField
        );
        return {
          ...prev,
          [cardType]: {
            ...currentTemplate,
            fields: {
              ...currentTemplate.fields,
              [fieldKey]: nextField,
            },
          },
        };
      });
    },
    []
  );

  const clearTemplateImage = useCallback((cardType: CardType) => {
    setCardTemplates((prev) => ({
      ...prev,
      [cardType]: {
        ...prev[cardType],
        templateUrl: undefined,
      },
    }));
  }, []);

  const copyTemplateFieldsTo = useCallback((source: CardType, target: CardType) => {
    if (source === target) return;
    setCardTemplates((prev) => {
      const sourceFields = prev[source].fields;
      const cloneField = (field: TemplateTextField): TemplateTextField => ({ ...field });
      return {
        ...prev,
        [target]: {
          ...prev[target],
          fields: {
            name: cloneField(sourceFields.name),
            descriptor: cloneField(sourceFields.descriptor),
            abilityName: cloneField(sourceFields.abilityName),
            abilityDescription: cloneField(sourceFields.abilityDescription),
            score: cloneField(sourceFields.score),
          },
        },
      };
    });
  }, []);

  const requestCopyTemplateFieldsTo = useCallback((target: CardType) => {
    setPendingTemplateCopyTarget(target);
  }, []);

  const confirmCopyTemplateFields = useCallback(() => {
    if (!pendingTemplateCopyTarget) return;
    copyTemplateFieldsTo(templateEditorType, pendingTemplateCopyTarget);
    setPendingTemplateCopyTarget(null);
  }, [copyTemplateFieldsTo, pendingTemplateCopyTarget, templateEditorType]);

  const nudgeTemplateField = useCallback(
    (cardType: CardType, fieldKey: TemplateFieldKey, deltaX: number, deltaY: number) => {
      setCardTemplates((prev) => {
        const currentTemplate = prev[cardType];
        const currentField = currentTemplate.fields[fieldKey];
        const nextField = normalizeTemplateField(
          {
            ...currentField,
            x: currentField.x + deltaX,
            y: currentField.y + deltaY,
          },
          currentField
        );
        return {
          ...prev,
          [cardType]: {
            ...currentTemplate,
            fields: {
              ...currentTemplate.fields,
              [fieldKey]: nextField,
            },
          },
        };
      });
    },
    []
  );

  useEffect(() => {
    if (!templateDialogOpen || !selectedTemplateField) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.tagName === "SELECT" ||
          active.isContentEditable)
      ) {
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        nudgeTemplateField(templateEditorType, selectedTemplateField, -TEMPLATE_NUDGE_STEP, 0);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        nudgeTemplateField(templateEditorType, selectedTemplateField, TEMPLATE_NUDGE_STEP, 0);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        nudgeTemplateField(templateEditorType, selectedTemplateField, 0, -TEMPLATE_NUDGE_STEP);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        nudgeTemplateField(templateEditorType, selectedTemplateField, 0, TEMPLATE_NUDGE_STEP);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nudgeTemplateField, selectedTemplateField, templateDialogOpen, templateEditorType]);

  const addBattlefield = () => {
    const name = newBattlefieldName.trim();
    if (!name) return;
    const description = newBattlefieldDescription.trim() || "New battlefield.";
    const id = `bf-${Date.now().toString(36)}`;
    const factionIds = (
      newBattlefieldFactionIds.length
        ? newBattlefieldFactionIds
        : selectedFactionId
        ? [selectedFactionId]
        : []
    ).slice(0, 2);
    const { ordered } = orderBattlefieldFactionIds(factionIds, factions);
    setBattlefields((prev) => [{ id, name, description, factionIds: ordered }, ...prev]);
    setActiveBattlefieldId(id);
    setNewBattlefieldName("");
    setNewBattlefieldDescription("");
    setNewBattlefieldFactionIds([]);
  };

  const toggleNewBattlefieldFaction = (factionId: string) => {
    setNewBattlefieldFactionIds((prev) => {
      if (prev.includes(factionId)) {
        return prev.filter((id) => id !== factionId);
      }
      if (prev.length >= 2) return prev;
      return [...prev, factionId];
    });
  };

  const deleteBattlefield = (battlefieldId: string) => {
    setBattlefields((prev) => prev.filter((field) => field.id !== battlefieldId));
    setCards((prev) => {
      const hostIds = new Set<string>();
      for (const card of prev) {
        if (
          card.location.type === "slot" &&
          card.location.battlefieldId === battlefieldId
        ) {
          hostIds.add(card.id);
        }
      }
      return prev.map((card) => {
        if (
          card.location.type === "slot" &&
          card.location.battlefieldId === battlefieldId
        ) {
          return {
            ...card,
            location: { type: "hand", ownerFactionId: card.ownerFactionId },
          };
        }
        if (card.location.type === "attached" && hostIds.has(card.location.hostId)) {
          return {
            ...card,
            location: { type: "hand", ownerFactionId: card.ownerFactionId },
          };
        }
        return card;
      });
    });
  };

  const requestDeleteBattlefield = (battlefieldId: string) => {
    setConfirmBattlefieldDeleteId(battlefieldId);
  };

  const canInteract = (card: GameCard) =>
    Boolean(activeFactionId && card.ownerFactionId === activeFactionId);
  const currentRedeployFactionId = activeFactionId ?? selectedFactionId ?? viewFactionId;
  const currentRedeployStage =
    phase === "redeploy" && currentRedeployFactionId
      ? redeployStages[currentRedeployFactionId] ?? "select"
      : "select";
  const currentRedeployIds = currentRedeployFactionId
    ? redeploySelections[currentRedeployFactionId] ?? []
    : [];

  const canDragCard = (card: GameCard) => {
    if (!canInteract(card)) return false;
    if (phase === "results") return false;
    if (phase === "deploy_spies" && card.type !== "spy") return false;
    if (phase === "deploy_fighters" && card.type === "spy") return false;
    if (phase === "redeploy") {
      if (currentRedeployStage === "select") return false;
      return card.type === "fighter" && currentRedeployIds.includes(card.id);
    }
    return true;
  };

  const startDrag = (
    event: React.PointerEvent<HTMLDivElement>,
    card: GameCard,
    options?: { ignoreRules?: boolean; ignoreButton?: boolean }
  ) => {
    if (!options?.ignoreButton) {
      const isPrimaryDown = event.button === 0 || (event.buttons & 1) === 1;
      if (!isPrimaryDown) return;
    }
    if (!options?.ignoreRules && !canDragCard(card)) return;
    event.preventDefault();
    setDragState({
      cardId: card.id,
      offsetX: 0,
      offsetY: 0,
      x: event.clientX,
      y: event.clientY,
      origin: card.location,
    });
  };

  const beginSidebarDragIntent = (
    event: React.PointerEvent<HTMLDivElement>,
    card: GameCard
  ) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragIntentRef.current = {
      cardId: card.id,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
      pointerId: event.pointerId,
    };
  };

  const updateSidebarDragIntent = (
    event: React.PointerEvent<HTMLDivElement>,
    card: GameCard
  ) => {
    const intent = dragIntentRef.current;
    if (!intent || intent.cardId !== card.id) return;
    if (intent.dragging) return;
    const distance = Math.hypot(event.clientX - intent.startX, event.clientY - intent.startY);
    if (distance > 8) {
      intent.dragging = true;
      if (!canDragCard(card)) return;
      startDrag(event, card, { ignoreButton: true });
    }
  };

  const endSidebarDragIntent = (event: React.PointerEvent<HTMLDivElement>) => {
    const intent = dragIntentRef.current;
    if (intent?.pointerId === event.pointerId) {
      dragIntentRef.current = null;
    }
  };

  const beginBoardDragIntent = (
    event: React.PointerEvent<HTMLDivElement>,
    card: GameCard
  ) => {
    if (event.button !== 0) return;
    if (!canDragCard(card)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    boardDragIntentRef.current = {
      cardId: card.id,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
      pointerId: event.pointerId,
    };
  };

  const updateBoardDragIntent = (
    event: React.PointerEvent<HTMLDivElement>,
    card: GameCard
  ) => {
    const intent = boardDragIntentRef.current;
    if (!intent || intent.cardId !== card.id) return;
    if (intent.dragging) return;
    const distance = Math.hypot(event.clientX - intent.startX, event.clientY - intent.startY);
    if (distance > 8) {
      intent.dragging = true;
      recentBoardDragCardIdRef.current = card.id;
      startDrag(event, card, { ignoreButton: true });
    }
  };

  const endBoardDragIntent = (event: React.PointerEvent<HTMLDivElement>) => {
    const intent = boardDragIntentRef.current;
    if (intent?.pointerId === event.pointerId) {
      boardDragIntentRef.current = null;
    }
  };

  const findClosestSlot = useCallback(
    (x: number, y: number, card: GameCard) => {
      let closest: { slotId: string; distance: number } | null = null;
      for (const [slotId, el] of Object.entries(slotRefs.current)) {
        if (!el || !slotId.startsWith(`${activeBattlefieldId}::`)) continue;
        const [battlefieldId, laneValue, row] = slotId.split("::") as [
          string,
          string,
          RowType,
          string
        ];
        const lane = laneValue === "1" ? 1 : 0;
        const battlefield = getBattlefieldById(battlefieldId);
        if (!battlefield || !battlefield.factionIds.includes(card.ownerFactionId)) continue;
        const laneFactionId = getBattlefieldLaneFactionId(battlefieldId, lane);
        if (!laneFactionId) continue;
        if (!canPlaceOnRow(card, row)) continue;
        if (card.type === "fighter" && laneFactionId !== card.ownerFactionId) continue;
        if (card.type === "support") continue;
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distance = Math.hypot(centerX - x, centerY - y);
        if (!closest || distance < closest.distance) {
          closest = { slotId, distance };
        }
      }
      return closest;
    },
    [activeBattlefieldId, getBattlefieldById, getBattlefieldLaneFactionId]
  );

  const findClosestCard = useCallback(
    (x: number, y: number, card: GameCard) => {
      if (card.type !== "support") return null;
      let closest: { cardId: string; distance: number } | null = null;
      for (const [cardId, el] of Object.entries(cardRefs.current)) {
        if (!el) continue;
        const host = cards.find((item) => item.id === cardId);
        if (!host || host.type === "support") continue;
        if (host.ownerFactionId !== card.ownerFactionId) continue;
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distance = Math.hypot(centerX - x, centerY - y);
        if (!closest || distance < closest.distance) {
          closest = { cardId, distance };
        }
      }
      return closest;
    },
    [cards]
  );

  const resolveSpyNeutralization = () => {
    const toReturn = new Set<string>();
    const outcomeDetails = new Map<
      string,
      {
        neutralizedSpyIds: Set<string>;
        successfulSpyIds: Set<string>;
        spyNameById: Map<string, string>;
        neutralizedEnemyCount: number;
      }
    >();
    const getOutcomeEntry = (factionId: string) => {
      let entry = outcomeDetails.get(factionId);
      if (!entry) {
        entry = {
          neutralizedSpyIds: new Set<string>(),
          successfulSpyIds: new Set<string>(),
          spyNameById: new Map<string, string>(),
          neutralizedEnemyCount: 0,
        };
        outcomeDetails.set(factionId, entry);
      }
      return entry;
    };

    for (const battlefield of battlefields) {
      const lane0FactionId = battlefield.factionIds[0];
      const lane1FactionId = battlefield.factionIds[1];
      if (!lane0FactionId || !lane1FactionId) continue;
      const resolveLane = (
        lane: 0 | 1,
        defenderFactionId: string,
        attackerFactionId: string
      ) => {
        const defenderSpies = cards.filter(
          (card) =>
            card.type === "spy" &&
            card.ownerFactionId === defenderFactionId &&
            card.location.type === "slot" &&
            card.location.battlefieldId === battlefield.id &&
            card.location.lane === lane &&
            card.location.row === "spy"
        );
        const attackerSpies = cards.filter(
          (card) =>
            card.type === "spy" &&
            card.ownerFactionId === attackerFactionId &&
            card.location.type === "slot" &&
            card.location.battlefieldId === battlefield.id &&
            card.location.lane === lane &&
            card.location.row === "spy"
        );
        if (!defenderSpies.length || !attackerSpies.length) return;
        const defenderScore = Math.max(...defenderSpies.map((card) => card.score));
        const attackerScore = Math.max(...attackerSpies.map((card) => card.score));
        if (attackerScore > defenderScore) {
          defenderSpies.forEach((card) => toReturn.add(card.id));
          const defenderEntry = getOutcomeEntry(defenderFactionId);
          defenderSpies.forEach((card) => {
            defenderEntry.neutralizedSpyIds.add(card.id);
            defenderEntry.spyNameById.set(card.id, card.name);
          });
          const attackerEntry = getOutcomeEntry(attackerFactionId);
          attackerSpies.forEach((card) => {
            attackerEntry.successfulSpyIds.add(card.id);
            attackerEntry.spyNameById.set(card.id, card.name);
          });
          attackerEntry.neutralizedEnemyCount += defenderSpies.length;
        } else {
          attackerSpies.forEach((card) => toReturn.add(card.id));
          const attackerEntry = getOutcomeEntry(attackerFactionId);
          attackerSpies.forEach((card) => {
            attackerEntry.neutralizedSpyIds.add(card.id);
            attackerEntry.spyNameById.set(card.id, card.name);
          });
          const defenderEntry = getOutcomeEntry(defenderFactionId);
          defenderSpies.forEach((card) => {
            defenderEntry.successfulSpyIds.add(card.id);
            defenderEntry.spyNameById.set(card.id, card.name);
          });
          defenderEntry.neutralizedEnemyCount += attackerSpies.length;
        }
      };
      resolveLane(0, lane0FactionId, lane1FactionId);
      resolveLane(1, lane1FactionId, lane0FactionId);
    }

    const finalOutcome = new Map<string, SpyOutcome>();
    outcomeDetails.forEach((entry, factionId) => {
      finalOutcome.set(factionId, {
        neutralizedSpyNames: Array.from(entry.neutralizedSpyIds).map(
          (spyId) => entry.spyNameById.get(spyId) ?? "Unnamed Spy"
        ),
        successfulSpyNames: Array.from(entry.successfulSpyIds).map(
          (spyId) => entry.spyNameById.get(spyId) ?? "Unnamed Spy"
        ),
        neutralizedEnemyCount: entry.neutralizedEnemyCount,
      });
    });

    const outcomeForViewer = viewFactionId ? finalOutcome.get(viewFactionId) ?? null : null;
    const outcomesRecord: Record<string, SpyOutcome> = {};
    finalOutcome.forEach((value, factionId) => {
      outcomesRecord[factionId] = value;
    });
    if (toReturn.size) {
      setCards((prev) =>
        prev.map((card) =>
          toReturn.has(card.id)
            ? { ...card, location: { type: "hand", ownerFactionId: card.ownerFactionId } }
            : card
        )
      );
    }
    if (Object.keys(outcomesRecord).length > 0) {
      setSpyReportEvent({
        id: `${round}-${Date.now().toString(36)}`,
        outcomes: outcomesRecord,
      });
    } else {
      setSpyReportEvent(null);
    }
    if (
      outcomeForViewer &&
      (outcomeForViewer.neutralizedSpyNames.length > 0 ||
        outcomeForViewer.successfulSpyNames.length > 0 ||
        outcomeForViewer.neutralizedEnemyCount > 0)
    ) {
      setSpyOutcome(outcomeForViewer);
    } else {
      setSpyOutcome(null);
    }
  };

  const placeCardInSlot = (cardId: string, slotId: string) => {
    const [battlefieldId, laneValue, row, index] = slotId.split("::") as [
      string,
      string,
      RowType,
      string
    ];
    const lane = laneValue === "1" ? 1 : 0;
    setCards((prev) =>
      prev.map((card) =>
        card.id === cardId
          ? {
              ...card,
              location: {
                type: "slot",
                battlefieldId,
                lane,
                row,
                index: Number(index),
              },
            }
          : card
      )
    );
  };

  const attachSupport = (supportId: string, hostId: string) => {
    setCards((prev) =>
      prev.map((card) =>
        card.id === supportId
          ? { ...card, location: { type: "attached", hostId } }
          : card
      )
    );
  };

  useEffect(() => {
    if (!dragState) return;

    const handlePointerMove = (event: PointerEvent) => {
      setDragState((prev) =>
        prev
          ? {
              ...prev,
              x: event.clientX,
              y: event.clientY,
            }
          : prev
      );
      const dragCard = cards.find((card) => card.id === dragState.cardId);
      if (!dragCard) return;

      if (dragCard.type === "support") {
        const target = findClosestCard(event.clientX, event.clientY, dragCard);
        if (target && target.distance < 90) {
          setHoverCardId(target.cardId);
        } else {
          setHoverCardId(null);
        }
      } else {
        const closest = findClosestSlot(event.clientX, event.clientY, dragCard);
        if (closest && closest.distance < 90) {
          setHoverSlotId(closest.slotId);
        } else {
          setHoverSlotId(null);
        }
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      const dragCard = cards.find((card) => card.id === dragState.cardId);
      if (!dragCard) {
        setDragState(null);
        return;
      }

      const handTarget = handRefs.current[dragCard.ownerFactionId];
      if (handTarget) {
        const rect = handTarget.getBoundingClientRect();
        const isOverHand =
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom;
        if (isOverHand) {
          setCards((prev) =>
            prev.map((card) =>
              card.id === dragCard.id
                ? {
                    ...card,
                    location: { type: "hand", ownerFactionId: dragCard.ownerFactionId },
                  }
                : card
            )
          );
          setDragState(null);
          setHoverSlotId(null);
          setHoverCardId(null);
          return;
        }
      }

      if (dragCard.type === "support") {
        const target = findClosestCard(event.clientX, event.clientY, dragCard);
        if (target && target.distance < 90) {
          attachSupport(dragCard.id, target.cardId);
        }
      } else {
        const closest = findClosestSlot(event.clientX, event.clientY, dragCard);
        if (closest && closest.distance < 90) {
          const occupied = cards.some((card) => {
            if (card.location.type !== "slot") return false;
            const key = slotKey(
              card.location.battlefieldId,
              card.location.lane,
              card.location.row,
              card.location.index
            );
            if (key !== closest.slotId) return false;
            if (card.id === dragCard.id) return false;
            const canShareSpySlot =
              phase === "deploy_spies" &&
              dragCard.type === "spy" &&
              card.type === "spy" &&
              card.ownerFactionId !== dragCard.ownerFactionId;
            return !canShareSpySlot;
          });
          if (!occupied) {
            placeCardInSlot(dragCard.id, closest.slotId);
          }
        }
      }

      setDragState(null);
      setHoverSlotId(null);
      setHoverCardId(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState, cards, findClosestSlot, findClosestCard, phase]);

  useEffect(() => {
    if (!dragState) return;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.userSelect = previousUserSelect;
    };
  }, [dragState]);

  const clearPhaseVotes = useCallback(() => {
    setNextPhaseVotes({});
    setPhaseVoteDirection(null);
    setPendingRoundFinish(false);
  }, []);

  const previousPhase = () => {
    if (!activeFactionId) return;
    const prev = phaseOrder[currentPhaseIndex - 1];
    if (!prev) return;
    const voterFactionId = activeFactionId;
    const participatingFactionIds = progressionFactionIds.length
      ? progressionFactionIds
      : [voterFactionId];
    const alreadyReady = Boolean(
      phaseVoteDirection === "prev" && nextPhaseVotes[voterFactionId]
    );
    const proposedVotes =
      phaseVoteDirection === "prev"
        ? { ...nextPhaseVotes, [voterFactionId]: true }
        : { [voterFactionId]: true };
    const allReady = participatingFactionIds.every((factionId) => proposedVotes[factionId]);

    setPhaseVoteDirection("prev");
    setNextPhaseVotes(allReady ? {} : proposedVotes);
    if (alreadyReady && !allReady) return;
    if (!allReady) return;

    clearPhaseVotes();
    setPhase(prev);
    setRedeploySelections({});
    setRedeployStage("select");
    setRedeployStages({});
  };

  const endRound = useCallback(() => {
    setRound((prev) => prev + 1);
    setPhase("deploy_spies");
    setRedeploySelections({});
    setRedeployStage("select");
    setRedeployStages({});
    setRecentRedeployIds([]);
    clearPhaseVotes();
    setSpyReportEvent(null);
    setResultsAnnouncement(null);
    setCards((prev) =>
      prev.map((card) => ({
        ...card,
        location: { type: "hand", ownerFactionId: card.ownerFactionId },
      }))
    );
  }, [clearPhaseVotes]);

  const decrementRound = useCallback(() => {
    setRound((prev) => (prev > 1 ? prev - 1 : 1));
  }, []);

  const toggleRedeploySelection = (cardId: string) => {
    if (phase !== "redeploy" || currentRedeployStage !== "select") return;
    if (!currentRedeployFactionId) return;
    if (phaseVoteDirection === "next" && nextPhaseVotes[currentRedeployFactionId]) return;
    setRedeploySelections((prev) => {
      const current = prev[currentRedeployFactionId] ?? [];
      if (current.includes(cardId)) {
        return {
          ...prev,
          [currentRedeployFactionId]: current.filter((id) => id !== cardId),
        };
      }
      if (current.length >= 3) return prev;
      return {
        ...prev,
        [currentRedeployFactionId]: [...current, cardId],
      };
    });
  };

  const nextPhase = () => {
    if (!activeFactionId) return;
    if (phase === "redeploy" && currentRedeployStage === "select") {
      clearPhaseVotes();
      const selectedIds = redeploySelections[activeFactionId] ?? [];
      if (selectedIds.length) {
        setCards((prev) =>
          prev.map((card) =>
            selectedIds.includes(card.id)
              ? { ...card, location: { type: "hand", ownerFactionId: card.ownerFactionId } }
              : card
          )
        );
      }
      setRedeployStages((prev) => ({ ...prev, [activeFactionId]: "place" }));
      setRedeployStage("place");
      return;
    }

    const voterFactionId = activeFactionId;
    const participatingFactionIds = progressionFactionIds.length
      ? progressionFactionIds
      : [voterFactionId];
    const alreadyReady = Boolean(
      phaseVoteDirection === "next" && nextPhaseVotes[voterFactionId]
    );

    const proposedVotes =
      phaseVoteDirection === "next"
        ? { ...nextPhaseVotes, [voterFactionId]: true }
        : { [voterFactionId]: true };
    const allReady = participatingFactionIds.every((factionId) => proposedVotes[factionId]);
    setPhaseVoteDirection("next");
    setNextPhaseVotes(allReady ? {} : proposedVotes);
    if (alreadyReady && !allReady) return;
    if (!allReady) return;

    clearPhaseVotes();
    if (phase === "results") {
      setPendingRoundFinish(true);
      return;
    }
    const next = phaseOrder[currentPhaseIndex + 1];
    if (!next) return;
    if (phase === "deploy_spies") {
      resolveSpyNeutralization();
    }
    if (phase === "redeploy" && currentRedeployStage === "place" && next === "results") {
      const ids = Array.from(new Set(Object.values(redeploySelections).flat()));
      setRecentRedeployIds(ids);
    }
    setPhase(next);
    setRedeploySelections({});
    setRedeployStage("select");
    setRedeployStages({});
  };

  const cancelPhaseVote = useCallback(() => {
    if (!activeFactionId) return;
    setNextPhaseVotes((prev) => {
      if (!prev[activeFactionId]) return prev;
      const next = { ...prev };
      delete next[activeFactionId];
      return next;
    });
    setPendingRoundFinish(false);
  }, [activeFactionId]);

  useEffect(() => {
    if (!Object.keys(nextPhaseVotes).length) {
      setPhaseVoteDirection(null);
    }
  }, [nextPhaseVotes]);

  useEffect(() => {
    if (phase !== "results" || !pendingRoundFinish) return;
    const handle = window.setTimeout(() => {
      endRound();
    }, 1800);
    return () => window.clearTimeout(handle);
  }, [endRound, pendingRoundFinish, phase]);

  const calcRevealForBattlefield = (battlefieldId: string, viewerFactionId: string) => {
    const battlefield = getBattlefieldById(battlefieldId);
    if (!battlefield) {
      return { reveal: false, allowCount: false };
    }
    const viewerLane = battlefield.factionIds.indexOf(viewerFactionId);
    if (viewerLane === -1) {
      return { reveal: false, allowCount: false };
    }
    const enemyLane = viewerLane === 0 ? 1 : 0;
    const enemyFactionId = battlefield.factionIds[enemyLane];
    if (!enemyFactionId) {
      return { reveal: false, allowCount: false };
    }
    const friendlySpiesInEnemy = cards.filter(
      (card) =>
        card.ownerFactionId === viewerFactionId &&
        card.type === "spy" &&
        card.location.type === "slot" &&
        card.location.battlefieldId === battlefieldId &&
        card.location.lane === enemyLane &&
        card.location.row === "spy"
    );

    const enemySpiesInEnemy = cards.filter(
      (card) =>
        card.ownerFactionId === enemyFactionId &&
        card.type === "spy" &&
        card.location.type === "slot" &&
        card.location.battlefieldId === battlefieldId &&
        card.location.lane === enemyLane &&
        card.location.row === "spy"
    );

    if (friendlySpiesInEnemy.length > 0) {
      return { reveal: true, allowCount: false };
    }
    if (enemySpiesInEnemy.length > 0) {
      return { reveal: false, allowCount: false };
    }
    return { reveal: false, allowCount: true };
  };

  const viewerIntel = useMemo(() => {
    const map = new Map<string, { reveal: boolean; allowCount: boolean }>();
    if (!viewFactionId) return map;
    for (const battlefield of battlefields) {
      map.set(battlefield.id, calcRevealForBattlefield(battlefield.id, viewFactionId));
    }
    return map;
  }, [battlefields, cards, calcRevealForBattlefield, viewFactionId]);

  const isCardVisible = (card: GameCard) => {
    if (!viewFactionId) return false;
    if (card.ownerFactionId === viewFactionId) return true;
    if (card.type === "spy") return false;
    if (phase !== "redeploy" && phase !== "results") return false;
    if (card.location.type !== "slot") return false;
    const intel = viewerIntel.get(card.location.battlefieldId);
    return Boolean(intel?.reveal);
  };

  const getVisibleCardForSlot = useCallback(
    (slotId: string) => {
      if (!viewFactionId) return null;
      const cardsInSlot = slotToCards.get(slotId) ?? [];
      const ownedCard = cardsInSlot.find(
        (card) => card.ownerFactionId === viewFactionId
      );
      if (ownedCard) return ownedCard;
      const visibleEnemy = cardsInSlot.find((card) => isCardVisible(card));
      return visibleEnemy ?? null;
    },
    [isCardVisible, slotToCards, viewFactionId]
  );

  const getEnemyCountVisible = (battlefieldId: string) => {
    if (!viewFactionId) return false;
    if (phase !== "redeploy" && phase !== "results") return false;
    const intel = viewerIntel.get(battlefieldId);
    if (!intel) return false;
    return Boolean(intel.allowCount);
  };

  const countsByField = useMemo(() => {
    const map = new Map<string, { lane0: number; lane1: number }>();
    for (const field of battlefields) {
      map.set(field.id, { lane0: 0, lane1: 0 });
    }
    for (const card of boardCards) {
      if (card.location.type === "slot") {
        const entry = map.get(card.location.battlefieldId);
        if (entry) {
          if (card.location.lane === 1) {
            entry.lane1 += 1;
          } else {
            entry.lane0 += 1;
          }
        }
      }
    }
    return map;
  }, [battlefields, boardCards]);

  const renderCard = (
    card: GameCard,
    options?: { isDragging?: boolean; hidden?: boolean; size?: "default" | "sidebar" | "library" }
  ) => {
    const isDragging = options?.isDragging;
    const hidden = options?.hidden;
    const isSidebar = options?.size === "sidebar";
    const isLibrary = options?.size === "library";
    const sizeClass =
      isSidebar || isLibrary ? "w-full aspect-[2/3]" : "h-24 w-16";
    const fallbackColor = DEFAULT_FACTION_COLORS[0] ?? "#10b981";
    const ownerColor = normalizeHexColor(getFactionById(card.ownerFactionId)?.color, fallbackColor);
    const ownerLabel = getFactionById(card.ownerFactionId)?.name ?? "Faction";
    const ownerInitials = ownerLabel
      .split(" ")
      .map((chunk) => chunk.trim()[0])
      .filter(Boolean)
      .join("")
      .slice(0, 2)
      .toUpperCase();
    const cardTemplate = cardTemplates[card.type];
    const hasFullCardOverride = Boolean(card.imageUrl);
    const hasTemplateFrame = Boolean(cardTemplate?.templateUrl);
    const hasLayeredArt = Boolean(!hasFullCardOverride && card.artUrl && hasTemplateFrame);
    const cardFaceUrl = hasFullCardOverride ? card.imageUrl : cardTemplate?.templateUrl;
    const artPlacement = normalizeCardArtPlacement(card.artPlacement, DEFAULT_CARD_ART_PLACEMENT);
    const artAspectRatio = normalizeArtAspectRatio(card.artAspectRatio, CARD_CANVAS_ASPECT_RATIO);
    const artBox = getCardArtBox(artPlacement, artAspectRatio);
    const shouldRenderOverlayText = Boolean(
      (isSidebar || isLibrary) && cardTemplate?.templateUrl && !hidden
    );
    const textByField: Record<TemplateFieldKey, string> = {
      name: card.name,
      descriptor: card.descriptor,
      abilityName: card.abilityName,
      abilityDescription: card.abilityDescription,
      score: `Score: ${hidden ? "?" : card.score}`,
    };
    return (
      <div
        className={`relative ${sizeClass} rounded-xl ${cardFaceUrl || hasLayeredArt ? "border border-transparent bg-transparent" : "border border-white/30"} shadow-[0_14px_28px_rgba(15,23,42,0.35)] transition-transform duration-200 ease-out ${
          isDragging ? "scale-105" : "hover:-translate-y-1"
        } ${hidden ? "opacity-60" : ""}`}
        style={
          (cardFaceUrl || hasLayeredArt) && !hidden
            ? undefined
            : {
                background: `linear-gradient(135deg, ${rgbaFromHex(ownerColor, 0.95)} 0%, ${rgbaFromHex(
                  ownerColor,
                  0.7
                )} 45%, rgba(2, 6, 23, 0.9) 100%)`,
              }
        }
      >
        {(cardFaceUrl || hasLayeredArt) && !hidden ? (
          <>
            {hasLayeredArt ? (
              <>
                <div className="absolute inset-0 overflow-hidden rounded-xl bg-slate-950/70">
                  <div
                    className="absolute overflow-hidden"
                    style={{
                      ...getCardArtBoxStyle(artBox),
                      clipPath: `inset(${artPlacement.cropTop}% ${artPlacement.cropRight}% ${artPlacement.cropBottom}% ${artPlacement.cropLeft}%)`,
                    }}
                  >
                    <img
                      src={card.artUrl}
                      alt={card.name}
                      className="absolute inset-0 h-full w-full object-fill"
                    />
                  </div>
                </div>
                <img
                  src={cardTemplate?.templateUrl}
                  alt={`${card.type} template`}
                  className="pointer-events-none absolute inset-0 h-full w-full rounded-xl object-cover"
                />
              </>
            ) : cardFaceUrl ? (
              <>
                <img
                  src={cardFaceUrl}
                  alt={card.name}
                  className="absolute inset-0 h-full w-full rounded-xl object-cover"
                />
                <div className="absolute inset-0 rounded-xl bg-black/20" />
              </>
            ) : null}
            {shouldRenderOverlayText ? (
              <div className="pointer-events-none absolute inset-0 z-10 rounded-xl text-black">
                {(Object.keys(textByField) as TemplateFieldKey[]).map((fieldKey) => {
                  const field = cardTemplate.fields[fieldKey];
                  const text = textByField[fieldKey];
                  return (
                    <div
                      key={fieldKey}
                      className="absolute overflow-hidden"
                      style={{
                        left: `${field.x}%`,
                        top: `${field.y}%`,
                        width: `${field.width}%`,
                        height: `${field.height}%`,
                      }}
                    >
                      <AutoFitText text={text} field={field} />
                    </div>
                  );
                })}
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/15 via-white/0 to-black/30" />
            <div className="relative z-10 flex h-full flex-col justify-between p-1.5 text-white">
              <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.18em] opacity-80">
                <span>{card.type}</span>
                <span>{ownerInitials || "F"}</span>
              </div>
              <div className="text-[11px] font-semibold leading-tight">
                {hidden ? "Unknown" : card.name}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-[0.2em] opacity-70">
                  Score
                </span>
                <span className="text-base font-bold">{hidden ? "?" : card.score}</span>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const dragCard = dragState && cards.find((card) => card.id === dragState.cardId);
  const dragPreview =
    dragState && dragCard && typeof document !== "undefined"
      ? createPortal(
          <div
            className="pointer-events-none fixed left-0 top-0 z-50"
            style={{
              transform: `translate(${dragState.x}px, ${dragState.y}px) translate(-50%, -50%)`,
            }}
          >
            {renderCard(dragCard, { isDragging: true })}
          </div>,
          document.body
        )
      : null;
  const focusedCards = useMemo(
    () =>
      focusedCardIds
        .map((focusedCardId) => cards.find((card) => card.id === focusedCardId) ?? null)
        .filter((card): card is GameCard => Boolean(card)),
    [cards, focusedCardIds]
  );
  const primaryFocusedCard = focusedCards[0] ?? null;
  const focusedCard = primaryFocusedCard;
  const activeBattlefield = getBattlefieldById(activeBattlefieldId);
  const viewerLaneIndex =
    activeBattlefield && viewFactionId
      ? activeBattlefield.factionIds.indexOf(viewFactionId)
      : -1;
  const orderedLanes: Array<0 | 1> =
    viewerLaneIndex === 0 ? [1, 0] : viewerLaneIndex === 1 ? [0, 1] : [0, 1];
  const lanes = orderedLanes.map((lane) => ({
    lane,
    factionId: activeBattlefield?.factionIds?.[lane] ?? null,
  }));
  const returnedCardsCount = currentRedeployIds.length;
  const recentRedeployIdSet = useMemo(() => new Set(recentRedeployIds), [recentRedeployIds]);
  const hasPreviousPhase = currentPhaseIndex > 0;
  const hasNextAction = phase === "results" || currentPhaseIndex < phaseOrder.length - 1;
  const readyFactionIds = progressionFactionIds.filter((factionId) =>
    Boolean(nextPhaseVotes[factionId])
  );
  const activeFactionReady = Boolean(
    activeFactionId && phaseVoteDirection && nextPhaseVotes[activeFactionId]
  );
  const waitingOnMe = Boolean(
    activeFactionId &&
      !activeFactionReady &&
      readyFactionIds.some((factionId) => factionId !== activeFactionId)
  );
  const waitingOnOthers = Boolean(
    activeFactionReady && readyFactionIds.length < progressionFactionIds.length
  );
  const waitingDirectionLabel =
    phaseVoteDirection === "prev"
      ? "previous phase"
      : phase === "results"
      ? "finish round"
      : "next phase";
  const redeployInstruction =
    phase === "redeploy" && currentRedeployStage === "select"
      ? "Phase 1: Click up to 3 fighters, then click Next to begin redeploying."
      : phase === "redeploy"
      ? "Phase 2: Place your returned fighters from the right-hand deck, then both factions click Next."
      : "Drag cards into slots, then click Next. Both factions must click Next to continue.";
  const sidebarHandCards = cards.filter(
    (card) =>
      selectedFactionId &&
      card.ownerFactionId === selectedFactionId &&
      card.location.type === "hand" &&
      card.id !== dragState?.cardId &&
      !(phase === "redeploy" && currentRedeployStage === "place" && !currentRedeployIds.includes(card.id))
  );
  const templateEditorConfig = cardTemplates[templateEditorType];
  const editorTemplateConfig = cardTemplates[editorData.type];
  const copyToTemplateTargets = (["fighter", "spy", "support"] as CardType[]).filter(
    (type) => type !== templateEditorType
  );
  const editorPreviewTextByField: Record<TemplateFieldKey, string> = {
    name: editorData.name || "Card Name",
    descriptor: editorData.descriptor || "Descriptor",
    abilityName: editorData.abilityName || "Ability Name",
    abilityDescription: editorData.abilityDescription || "Ability text preview",
    score: `Score: ${Number.isNaN(editorData.score) ? 0 : editorData.score}`,
  };
  const editorPreviewPlacement = normalizeCardArtPlacement(
    editorData.artPlacement,
    DEFAULT_CARD_ART_PLACEMENT
  );
  const editorArtBox = getCardArtBox(editorPreviewPlacement, editorData.artAspectRatio);
  const editorCropBox = getCardArtCropBox(editorPreviewPlacement, editorData.artAspectRatio);
  const editorHasCrop =
    editorPreviewPlacement.cropLeft > 0 ||
    editorPreviewPlacement.cropTop > 0 ||
    editorPreviewPlacement.cropRight > 0 ||
    editorPreviewPlacement.cropBottom > 0;

  const renderEditorArtLauncher = () => (
    <div className="space-y-2">
      <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
        Character Art
      </label>
      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1 text-xs text-white/60">
            <div>
              {editorData.artUrl
                ? "Character art is attached to this card."
                : "Upload character art to place it behind the template."}
            </div>
            <div>
              {editorData.imageUrl
                ? "A full-card override is active and currently replaces the layered art output."
                : editorHasCrop
                ? "Crop adjustments are saved for this card."
                : "No crop adjustments have been saved yet."}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setArtEditorOpen(true)}
            className="border-white/20 bg-white/5 text-white hover:bg-white/10"
          >
            Open Art Editor
          </Button>
        </div>
      </div>
    </div>
  );

  const renderEditorArtDialog = () => {
    const hasTemplate = Boolean(editorTemplateConfig?.templateUrl);
    const hasFullImageOverride = Boolean(editorData.imageUrl);
    const hasEditableArt = Boolean(editorData.artUrl && !hasFullImageOverride);
    const visibleWidth = editorCropBox.width;
    const visibleHeight = editorCropBox.height;
    const transformHandles: Array<{ handle: CardArtHandle; className: string; cursor: string }> = [
      {
        handle: "nw",
        className: "-left-3 -top-3",
        cursor: "cursor-nwse-resize",
      },
      {
        handle: "ne",
        className: "-right-3 -top-3",
        cursor: "cursor-nesw-resize",
      },
      {
        handle: "sw",
        className: "-bottom-3 -left-3",
        cursor: "cursor-nesw-resize",
      },
      {
        handle: "se",
        className: "-bottom-3 -right-3",
        cursor: "cursor-nwse-resize",
      },
    ];
    const cropHandles: Array<{ handle: CardArtHandle; className: string; cursor: string }> = [
      {
        handle: "n",
        className: "left-1/2 -top-3 -translate-x-1/2",
        cursor: "cursor-ns-resize",
      },
      {
        handle: "e",
        className: "-right-3 top-1/2 -translate-y-1/2",
        cursor: "cursor-ew-resize",
      },
      {
        handle: "s",
        className: "bottom-[-0.75rem] left-1/2 -translate-x-1/2",
        cursor: "cursor-ns-resize",
      },
      {
        handle: "w",
        className: "-left-3 top-1/2 -translate-y-1/2",
        cursor: "cursor-ew-resize",
      },
      {
        handle: "nw",
        className: "-left-3 -top-3",
        cursor: "cursor-nwse-resize",
      },
      {
        handle: "ne",
        className: "-right-3 -top-3",
        cursor: "cursor-nesw-resize",
      },
      {
        handle: "sw",
        className: "-bottom-3 -left-3",
        cursor: "cursor-nesw-resize",
      },
      {
        handle: "se",
        className: "-bottom-3 -right-3",
        cursor: "cursor-nwse-resize",
      },
    ];

    return (
      <Dialog
        open={artEditorOpen}
        onOpenChange={(open) => {
          setArtEditorOpen(open);
          if (!open) {
            setArtEditorCropMode(false);
            cardArtInteractionRef.current = null;
          }
        }}
      >
        <DialogContent className="h-[92vh] w-[96vw] max-w-[90rem] overflow-hidden border border-white/10 bg-slate-950 p-0 text-white">
          <div className="flex h-full flex-col">
            <DialogHeader className="border-b border-white/10 px-6 py-4 text-left">
              <DialogTitle>Character Art Editor</DialogTitle>
              <p className="text-sm text-white/60">
                Drag the art to position it. Use the {artEditorCropMode ? "side or corner handles to crop the visible image" : "corner handles on the image itself to resize it"}.
              </p>
            </DialogHeader>
            <div className="grid flex-1 overflow-hidden lg:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.85fr)]">
              <div className="flex min-h-0 items-center justify-center bg-[radial-gradient(circle_at_top,_#164e63,_#020617_68%)] p-6">
                <div className="w-full max-w-[36rem]">
                  <div
                    data-art-canvas
                    className="relative aspect-[2/3] w-full overflow-hidden rounded-[1.75rem] border border-white/15 bg-slate-900 shadow-[0_24px_80px_rgba(2,6,23,0.55)] touch-none select-none"
                    onPointerMove={moveEditorArtInteraction}
                    onPointerUp={endEditorArtInteraction}
                    onPointerCancel={endEditorArtInteraction}
                  >
                    {hasFullImageOverride ? (
                      <img
                        src={editorData.imageUrl}
                        alt={`${editorData.name || "Card"} full override`}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : editorData.artUrl ? (
                      <div className="absolute inset-0 overflow-hidden rounded-[1.75rem] bg-slate-950">
                        <div
                          className={`absolute ${hasEditableArt ? "cursor-grab active:cursor-grabbing" : ""}`}
                          style={{
                            ...getCardArtBoxStyle(editorArtBox),
                            clipPath: `inset(${editorPreviewPlacement.cropTop}% ${editorPreviewPlacement.cropRight}% ${editorPreviewPlacement.cropBottom}% ${editorPreviewPlacement.cropLeft}%)`,
                          }}
                          onPointerDown={startEditorArtMove}
                        >
                          <img
                            src={editorData.artUrl}
                            alt={`${editorData.name || "Card"} character art`}
                            className="pointer-events-none absolute inset-0 h-full w-full object-fill"
                          />
                        </div>
                        <div
                          className="pointer-events-none absolute overflow-hidden rounded-[1rem] border border-cyan-200/35 bg-transparent"
                          style={{
                            ...getCardArtBoxStyle(editorCropBox),
                            boxShadow: "0 0 0 9999px rgba(2, 6, 23, 0.18)",
                          }}
                        />
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/50">
                        Upload character art to begin composing this card.
                      </div>
                    )}

                    {hasTemplate ? (
                      <img
                        src={editorTemplateConfig.templateUrl}
                        alt={`${editorData.type} template`}
                        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                      />
                    ) : null}

                    {hasTemplate ? (
                      <div className="pointer-events-none absolute inset-0 z-10 text-black">
                        {(Object.keys(editorTemplateConfig.fields) as TemplateFieldKey[]).map((fieldKey) => {
                          const field = editorTemplateConfig.fields[fieldKey];
                          return (
                            <div
                              key={fieldKey}
                              className="absolute overflow-hidden"
                              style={{
                                left: `${field.x}%`,
                                top: `${field.y}%`,
                                width: `${field.width}%`,
                                height: `${field.height}%`,
                              }}
                            >
                              <AutoFitText text={editorPreviewTextByField[fieldKey]} field={field} />
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    {hasEditableArt ? (
                      <>
                        <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-full bg-slate-900 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-white/70">
                          {artEditorCropMode ? "Crop Mode" : "Transform Mode"}
                        </div>
                        <div
                          className="pointer-events-none absolute z-20 rounded-xl border-2 border-cyan-300/80 bg-cyan-300/5 shadow-[0_0_0_1px_rgba(15,23,42,0.35)_inset]"
                          style={artEditorCropMode ? getCardArtBoxStyle(editorCropBox) : getCardArtBoxStyle(editorArtBox)}
                        >
                          <div className="pointer-events-none absolute inset-0 border border-white/15" />
                          {(artEditorCropMode ? cropHandles : transformHandles).map((handle) => (
                            <button
                              key={`${artEditorCropMode ? "crop" : "transform"}-${handle.handle}`}
                              type="button"
                              className={`pointer-events-auto absolute h-6 w-6 rounded-full border-2 border-slate-950 bg-cyan-300 ring-2 ring-white/70 shadow-lg ${handle.className} ${handle.cursor}`}
                              onPointerDown={(event) => startEditorArtHandleDrag(handle.handle, event)}
                              aria-label={`${artEditorCropMode ? "Crop" : "Resize"} ${handle.handle}`}
                            />
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-white/55">
                    <span>
                      {hasFullImageOverride
                        ? "Full-card override preview is active."
                        : hasTemplate
                        ? "The template remains on top while you position the art beneath it."
                        : "No template is assigned to this card type yet, so you are editing raw background art."}
                    </span>
                    {editorData.artUrl ? (
                      <span>
                        Visible frame: {visibleWidth.toFixed(1)}% x {visibleHeight.toFixed(1)}%
                      </span>
                    ) : null}
                  </div>
                  {hasEditableArt ? (
                    <div className="mt-2 text-center text-[11px] text-cyan-100/75">
                      {artEditorCropMode
                        ? "Drag a side or corner handle on the visible image to crop that side."
                        : "Use the cyan corner handles on the image itself to resize it."}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="min-h-0 overflow-y-auto border-t border-white/10 bg-slate-950 p-6 lg:border-l lg:border-t-0">
                <div className="space-y-5">
                  <div className="sticky top-0 z-20 -mx-6 -mt-6 border-b border-white/10 bg-slate-950 px-6 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                          Card Actions
                        </div>
                        <div className="mt-1 text-xs text-white/55">
                          Save the card here without leaving the art editor.
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setArtEditorOpen(false)}
                          className="border-white/20 bg-slate-900 text-white hover:bg-slate-800"
                        >
                          Close
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={saveEditorAndCloseArtDialog}
                          className="border-white/20 bg-slate-900 text-white hover:bg-slate-800"
                        >
                          Save + Close
                        </Button>
                        <Button
                          type="button"
                          onClick={saveEditorInPlace}
                          className="bg-amber-400/90 text-slate-950 hover:bg-amber-300"
                        >
                          Save Card
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                      Character Art
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="border-white/20 bg-slate-900 text-white hover:bg-slate-800"
                        onClick={() => {
                          const input = document.getElementById("card-character-art-upload-dialog");
                          if (input) input.click();
                        }}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Character Art
                      </Button>
                      <input
                        id="card-character-art-upload-dialog"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) handleCharacterArtUpload(file);
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={clearCharacterArt}
                        className="border-white/20 bg-slate-900 text-white hover:bg-slate-800"
                        disabled={!editorData.artUrl}
                      >
                        Clear
                      </Button>
                    </div>
                    <div className="mt-2 text-xs text-white/55">
                      {editorData.artUrl
                        ? "Drag the artwork directly in the preview to reposition it."
                        : "Start by uploading an image you want to show beneath the card frame."}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                          Resize Mode
                        </div>
                        <div className="mt-1 text-xs text-white/55">
                          {artEditorCropMode
                            ? "Handles crop the visible frame without shrinking the image."
                            : "Handles resize the image itself."}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setArtEditorCropMode((prev) => !prev)}
                        disabled={!hasEditableArt}
                        className={`border-white/20 text-white hover:bg-slate-800 ${
                          artEditorCropMode ? "bg-cyan-400/15" : "bg-slate-950"
                        }`}
                      >
                        {artEditorCropMode ? "Crop Mode On" : "Enable Crop Mode"}
                      </Button>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetEditorArtPlacement}
                        disabled={!editorData.artUrl}
                        className="border-white/20 bg-slate-950 text-white hover:bg-slate-800"
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reset All
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          updateEditorArtPlacement({
                            offsetX: DEFAULT_CARD_ART_PLACEMENT.offsetX,
                            offsetY: DEFAULT_CARD_ART_PLACEMENT.offsetY,
                            scale: DEFAULT_CARD_ART_PLACEMENT.scale,
                          })
                        }
                        disabled={!editorData.artUrl}
                        className="border-white/20 bg-slate-950 text-white hover:bg-slate-800"
                      >
                        Reset Transform
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetEditorArtCrop}
                        disabled={!editorHasCrop}
                        className="border-white/20 bg-slate-950 text-white hover:bg-slate-800"
                      >
                        Reset Crop
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                      Saved Art State
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-white/60">
                      <div className="rounded-xl border border-white/10 bg-slate-950 p-3">
                        <div className="uppercase tracking-[0.18em] text-white/45">Offset</div>
                        <div className="mt-1">
                          {editorPreviewPlacement.offsetX.toFixed(1)}%, {editorPreviewPlacement.offsetY.toFixed(1)}%
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-slate-950 p-3">
                        <div className="uppercase tracking-[0.18em] text-white/45">Scale</div>
                        <div className="mt-1">{editorPreviewPlacement.scale.toFixed(2)}x</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-slate-950 p-3">
                        <div className="uppercase tracking-[0.18em] text-white/45">Crop Top/Left</div>
                        <div className="mt-1">
                          {editorPreviewPlacement.cropTop.toFixed(1)}% / {editorPreviewPlacement.cropLeft.toFixed(1)}%
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-slate-950 p-3">
                        <div className="uppercase tracking-[0.18em] text-white/45">Crop Bottom/Right</div>
                        <div className="mt-1">
                          {editorPreviewPlacement.cropBottom.toFixed(1)}% / {editorPreviewPlacement.cropRight.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                      Full Card Image Override
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="border-white/20 bg-slate-900 text-white hover:bg-slate-800"
                        onClick={() => {
                          const input = document.getElementById("card-art-upload-dialog");
                          if (input) input.click();
                        }}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Override
                      </Button>
                      <input
                        id="card-art-upload-dialog"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) handleImageUpload(file);
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={clearCardImageOverride}
                        className="border-white/20 bg-slate-900 text-white hover:bg-slate-800"
                        disabled={!editorData.imageUrl}
                      >
                        Clear
                      </Button>
                    </div>
                    <div className="mt-2 text-xs text-white/55">
                      If an override is active, it replaces the layered template + character art result for
                      the final saved card.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  if (!selectedFactionId) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#0f172a,_#020617)] text-white">
        <header className="border-b border-white/10 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <div>
              <p className="text-[10px] uppercase tracking-[0.4em] text-amber-200/70">
                The Kozani Civil War
              </p>
              <h1 className="text-xl font-semibold">Faction Entry</h1>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/dm-space")}
              className="border-white/20 bg-white/5 text-white hover:bg-white/10"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>
        </header>
        <main className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <h2 className="text-lg font-semibold">Select Your Faction</h2>
            <p className="mt-1 text-sm text-white/60">
              Choose a faction to enter the battlefield. DM factions require the access code.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {factions.map((faction) => {
              const isEditingColor = editingFactionId === faction.id;
              const factionColor = normalizeHexColor(faction.color, "#10b981");
              return (
                <div
                  key={faction.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 text-left transition hover:border-amber-300/60 hover:bg-white/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm uppercase tracking-[0.3em] text-white/50">
                        {faction.isDm ? "DM Faction" : "Faction"}
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xl font-semibold">
                        <span
                          className="inline-block h-3 w-3 rounded-full border border-white/30"
                          style={{ backgroundColor: factionColor }}
                        />
                        {faction.name}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => (isEditingColor ? setEditingFactionId(null) : startFactionColorEdit(faction))}
                      className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                    >
                      {isEditingColor ? "Cancel" : "Edit Color"}
                    </Button>
                  </div>

                  {isEditingColor ? (
                    <div className="mt-4 flex items-center gap-2">
                      <input
                        type="color"
                        value={editingFactionColor}
                        onChange={(event) => setEditingFactionColor(event.target.value)}
                        className="h-9 w-14 cursor-pointer rounded border border-white/20 bg-white/5 p-1"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={saveFactionColor}
                        className="bg-amber-400/90 text-slate-950 hover:bg-amber-300"
                      >
                        Save
                      </Button>
                    </div>
                  ) : null}

                  <div className="mt-4">
                    <Button
                      type="button"
                      onClick={() => handleEntrySelect(faction)}
                      className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                      variant="outline"
                    >
                      Enter
                    </Button>
                  </div>
                </div>
              );
            })}
            {!factions.length && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white/60">
                No factions yet. Create them from the Factions menu.
              </div>
            )}
          </div>
        </main>

        <Dialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>DM Faction Access</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-sm text-white/70">
              <p>
                Enter the access code to join {entryTargetFaction?.name ?? "this faction"}.
              </p>
              <Input
                type="password"
                placeholder="Enter code"
                value={entryCode}
                onChange={(event) => setEntryCode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleEntryCodeSubmit();
                  }
                }}
              />
              {entryError && <p className="text-sm text-rose-200">{entryError}</p>}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEntryDialogOpen(false);
                    setEntryTargetFaction(null);
                    setEntryCode("");
                    setEntryError("");
                  }}
                  className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                >
                  Cancel
                </Button>
                <Button onClick={handleEntryCodeSubmit}>Enter</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[radial-gradient(circle_at_top,_#0f172a,_#020617)] text-white">
      <div className="flex h-full w-full justify-center items-start">
        <div
          className="origin-top"
          style={{
            width: BOARD_BASE_WIDTH,
            height: BOARD_BASE_HEIGHT,
            transform: `scale(${uiScale})`,
          }}
        >
          <div className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden">
            <header className="border-b border-white/10 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950">
        <div className="flex w-full flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/dm-space")}
              className="border-white/20 bg-white/5 text-white hover:bg-white/10"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              DM Space
            </Button>
            <div>
              <p className="text-[10px] uppercase tracking-[0.4em] text-amber-200/70">
                The Kozani Civil War
              </p>
              <h1 className="text-xl font-semibold">Battlefields</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/60">
            <Button
              size="sm"
              variant="outline"
              onClick={decrementRound}
              className="border-white/20 bg-white/5 text-white hover:bg-white/10"
            >
              Decrement Round
            </Button>
            <span>Round {round}</span>
            <span>·</span>
            <span>{phaseLabels[phase]}</span>
          </div>
        </div>
      </header>

            <main className="relative mx-auto flex w-full max-w-none min-h-0 flex-col gap-3 px-0 py-3">
        <div className="relative flex w-full flex-1 min-h-0 gap-4">
        <section className="min-h-0 flex flex-1 flex-col gap-3 overflow-hidden">
          <div className="w-full shrink-0 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur">
            <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
              <div>
                <h2 className="text-base font-semibold">
                  {activeBattlefield?.name ?? "Battlefield"}
                </h2>
                <p className="text-xs text-white/60">
                  {redeployInstruction}
                </p>
              </div>
              <div className="justify-self-center text-xs uppercase tracking-[0.3em]">
                {phase === "redeploy" ? (
                  <span className="rounded-full border border-amber-300/50 bg-amber-300/10 px-3 py-1 text-amber-100">
                    Returned Cards {returnedCardsCount}/3
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.3em]">
                <span className="rounded-full border border-white/20 px-3 py-1 text-white/70">
                  Faction {getFactionName(activeFactionId)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={resetFactionSelection}
                  className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                >
                  <Shield className="mr-2 h-4 w-4" />
                  Switch Faction
                </Button>
              </div>
            </div>
          </div>

          <div className="grid h-full min-h-0 flex-1 grid-cols-[28.8rem_minmax(0,1fr)_28.8rem] items-stretch gap-4 overflow-hidden">
            <div className="col-start-2 mx-auto h-full w-full max-w-[864px] rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-950/80 to-slate-900/80 p-3 text-[34px] shadow-[0_30px_60px_rgba(2,6,23,0.45)]">
              {lanes.map(({ lane, factionId }, index) => {
                const laneColor = factionId
                  ? normalizeHexColor(
                      getFactionById(factionId)?.color,
                      DEFAULT_FACTION_COLORS[0] ?? "#10b981"
                    )
                  : "rgba(255,255,255,0.3)";
                const rowOrder: RowType[] =
                  index === 0 ? ["spy", "fighter"] : ["fighter", "spy"];
                const laneIntel = viewerIntel.get(activeBattlefieldId);
                const showCardsRevealedLabel = Boolean(
                  factionId &&
                    factionId !== viewFactionId &&
                    (phase === "redeploy" || phase === "results") &&
                    laneIntel?.reveal
                );
                return (
                  <div key={`lane-${lane}`} className="mb-4 last:mb-0">
                    <div className="mb-2 flex items-center gap-2 text-[20px] uppercase tracking-[0.3em] text-white/60">
                      <span
                        className="h-2 w-2 rounded-full border border-white/30"
                        style={{ backgroundColor: laneColor }}
                      />
                      {factionId ? getFactionName(factionId) : "Open Lane"}
                    </div>
                    <div className="relative">
                      <div className="space-y-[31px]">
                      {rowOrder.map((rowKey) => {
                        const rowInfo = rowConfig.find((row) => row.row === rowKey);
                        if (!rowInfo) return null;
                        const scoreKey = `${activeBattlefieldId}::${lane}::${rowInfo.row}`;
                        const score =
                          rowInfo.row === "spy"
                            ? boardCards.reduce((total, card) => {
                                if (card.location.type !== "slot") return total;
                                if (card.location.battlefieldId !== activeBattlefieldId)
                                  return total;
                                if (card.location.lane !== lane) return total;
                                if (card.location.row !== "spy") return total;
                                const laneOwnerId = getBattlefieldLaneFactionId(
                                  activeBattlefieldId,
                                  lane
                                );
                                if (!laneOwnerId) return total;
                                if (card.type === "spy" && card.ownerFactionId !== laneOwnerId) {
                                  return total;
                                }
                                return total + card.score;
                              }, 0)
                            : rowScores.get(scoreKey) ?? 0;
                        const scoreVisible =
                          !factionId ||
                          factionId === viewFactionId ||
                          ((phase === "redeploy" || phase === "results") &&
                            Boolean(laneIntel?.reveal));
                        const enemyCountsVisible =
                          factionId && factionId !== viewFactionId
                            ? getEnemyCountVisible(activeBattlefieldId)
                            : false;
                        return (
                          <div
                            key={`${lane}-${rowInfo.row}`}
                            className="grid grid-cols-[72px_1fr] gap-2"
                          >
                            <div className="px-1 py-1 text-[11px] text-white/70">
                              <div className="text-[18px] uppercase tracking-[0.2em] opacity-80">
                                {rowInfo.label}
                              </div>
                              <div className="mt-1 text-base font-semibold text-amber-200">
                                {scoreVisible ? score : "—"}
                              </div>
                              <div className="mt-1 h-[14px]" />
                            </div>
                            <div
                              className={`grid gap-2 ${
                                rowInfo.slots === 4 ? "grid-cols-4" : "grid-cols-3"
                              } place-items-center`}
                            >
                              {Array.from({ length: rowInfo.slots }).map((_, slotIndex) => {
                                const slotId = slotKey(
                                  activeBattlefieldId,
                                  lane,
                                  rowInfo.row,
                                  slotIndex
                                );
                                const card = getVisibleCardForSlot(slotId);
                                const cardsInSlot = slotToCards.get(slotId) ?? [];
                                const hiddenEnemyCard = cardsInSlot.find(
                                  (slotCard) =>
                                    Boolean(
                                      viewFactionId &&
                                        slotCard.ownerFactionId !== viewFactionId &&
                                        !isCardVisible(slotCard)
                                    )
                                );
                                const showHiddenEnemyOverlay = Boolean(
                                  enemyCountsVisible && !card && hiddenEnemyCard
                                );
                                const hiddenEnemyColor = normalizeHexColor(
                                  getFactionById(hiddenEnemyCard?.ownerFactionId)?.color,
                                  DEFAULT_FACTION_COLORS[2] ?? "#38bdf8"
                                );
                                const isHover = hoverSlotId === slotId;
                                const hidden = card ? !isCardVisible(card) : false;
                                return (
                                  <div
                                    key={slotId}
                                    ref={(el) => {
                                      slotRefs.current[slotId] = el;
                                    }}
                                    className={`relative flex h-24 w-16 items-center justify-center rounded-xl border ${
                                      isHover
                                        ? "border-amber-300/80 bg-amber-300/10"
                                        : "border-white/10 bg-white/5"
                                    }`}
                                  >
                                    {showHiddenEnemyOverlay ? (
                                      <div
                                        className="pointer-events-none absolute inset-0 rounded-xl border border-white/25"
                                        style={{
                                          background: `linear-gradient(160deg, ${rgbaFromHex(
                                            hiddenEnemyColor,
                                            0.32
                                          )} 0%, ${rgbaFromHex(hiddenEnemyColor, 0.18)} 55%, rgba(2, 6, 23, 0.35) 100%)`,
                                        }}
                                      />
                                    ) : null}
                                    {!card || dragState?.cardId === card.id ? null : (
                                      <div
                                        ref={(el) => {
                                          cardRefs.current[card.id] = el;
                                        }}
                                        className="touch-none select-none"
                                        onPointerDown={(event) => beginBoardDragIntent(event, card)}
                                        onPointerMove={(event) => updateBoardDragIntent(event, card)}
                                        onPointerUp={endBoardDragIntent}
                                        onPointerCancel={endBoardDragIntent}
                                        onClick={() => {
                                          if (recentBoardDragCardIdRef.current === card.id) {
                                            recentBoardDragCardIdRef.current = null;
                                            return;
                                          }
                                          if (
                                            phase === "redeploy" &&
                                            currentRedeployStage === "select" &&
                                            card.ownerFactionId === activeFactionId &&
                                            card.type === "fighter"
                                          ) {
                                            toggleRedeploySelection(card.id);
                                          }
                                          focusCardPreview(card, true);
                                        }}
                                      >
                                        <div
                                          className={`transition ${
                                            currentRedeployIds.includes(card.id)
                                              ? "ring-2 ring-amber-300"
                                              : ""
                                          } ${
                                            phase === "results" &&
                                            card.location.type === "slot" &&
                                            recentRedeployIdSet.has(card.id)
                                              ? "ring-1 ring-cyan-200/35 shadow-[0_0_10px_rgba(186,230,253,0.2)]"
                                              : ""
                                          } ${hoverCardId === card.id ? "scale-105" : ""}`}
                                        >
                                          {renderCard(card, { hidden })}
                                        </div>
                                        {attachedSupport.get(card.id)?.length ? (
                                          <div className="mt-1 text-center text-[10px] text-white/60">
                                            +{attachedSupport.get(card.id)?.length ?? 0} support
                                          </div>
                                        ) : null}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      </div>
                      {showCardsRevealedLabel ? (
                        <div className="pointer-events-none absolute left-0 right-0 top-1/2 z-[11] -translate-y-1/2 text-center">
                          <span className="rounded-full border border-emerald-200/40 bg-emerald-300/15 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-emerald-100">
                            Cards Revealed
                          </span>
                        </div>
                      ) : null}
                      {Boolean(
                        factionId &&
                          factionId !== viewFactionId &&
                          (phase === "redeploy" || phase === "results") &&
                          !laneIntel?.reveal &&
                          !laneIntel?.allowCount &&
                          boardCards.some(
                            (card) =>
                              card.ownerFactionId === factionId &&
                              card.location.type === "slot" &&
                              card.location.battlefieldId === activeBattlefieldId &&
                              card.location.lane === lane
                          )
                      ) ? (
                        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-slate-950/65">
                          <span className="rounded-full border border-white/20 bg-slate-900/75 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-white/90">
                            Concealed by Enemy Spy
                          </span>
                        </div>
                      ) : null}
                    </div>
                    {index === 0 && (
                      <div className="my-3 h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    )}
                  </div>
                );
              })}
            </div>

            <aside className="col-start-1 row-start-1 flex h-full min-h-0 flex-col rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setLeftPanelTab("battlefields")}
                    className={`h-7 px-2 text-[10px] uppercase tracking-[0.2em] ${
                      leftPanelTab === "battlefields"
                        ? "border-amber-300/60 bg-amber-300/15 text-amber-100 hover:bg-amber-300/20"
                        : "border-white/20 bg-white/5 text-white/80 hover:bg-white/10"
                    }`}
                  >
                    Battlefields
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setLeftPanelTab("log")}
                    className={`h-7 px-2 text-[10px] uppercase tracking-[0.2em] ${
                      leftPanelTab === "log"
                        ? "border-amber-300/60 bg-amber-300/15 text-amber-100 hover:bg-amber-300/20"
                        : "border-white/20 bg-white/5 text-white/80 hover:bg-white/10"
                    }`}
                  >
                    Log
                  </Button>
                </div>
                {leftPanelTab === "battlefields" ? (
                  <Button
                    size="sm"
                    onClick={addBattlefield}
                    className="h-7 bg-amber-400/90 px-2 text-[10px] uppercase tracking-[0.2em] text-slate-950 hover:bg-amber-300"
                  >
                    Add
                  </Button>
                ) : null}
              </div>
              {leftPanelTab === "battlefields" ? (
                <>
                  <div className="mb-3 shrink-0 space-y-2">
                    <Input
                      value={newBattlefieldName}
                      onChange={(event) => setNewBattlefieldName(event.target.value)}
                      placeholder="Battlefield name"
                      className="bg-white/10 text-sm text-white placeholder:text-white/40"
                    />
                    <Input
                      value={newBattlefieldDescription}
                      onChange={(event) => setNewBattlefieldDescription(event.target.value)}
                      placeholder="Short description"
                      className="bg-white/10 text-sm text-white placeholder:text-white/40"
                    />
                    <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                      <div className="text-[10px] uppercase tracking-[0.3em] text-white/60">
                        Assign Factions (max 2)
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {factions.map((faction) => (
                          <label
                            key={faction.id}
                            className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 ${
                              newBattlefieldFactionIds.includes(faction.id)
                                ? "border-amber-300/70 bg-amber-300/10"
                                : "border-white/10 bg-white/5"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={newBattlefieldFactionIds.includes(faction.id)}
                              onChange={() => toggleNewBattlefieldFaction(faction.id)}
                            />
                            <span>{faction.name}</span>
                            {faction.isDm && (
                              <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] uppercase">
                                DM
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                    <div className="space-y-2">
                      {visibleBattlefields.map((battlefield) => {
                        const counts = countsByField.get(battlefield.id) ?? {
                          lane0: 0,
                          lane1: 0,
                        };
                        const isActive = battlefield.id === activeBattlefieldId;
                        const lane0FactionId = battlefield.factionIds[0];
                        const lane1FactionId = battlefield.factionIds[1];
                        return (
                          <div
                            key={battlefield.id}
                            className={`rounded-xl border px-3 py-2 text-left transition ${
                              isActive
                                ? "border-amber-300/60 bg-amber-300/10"
                                : "border-white/10 bg-white/5"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-xs font-semibold">{battlefield.name}</div>
                                <div className="text-[11px] text-white/60">
                                  {battlefield.description}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setActiveBattlefieldId(battlefield.id)}
                                  className="h-6 border-white/20 bg-white/5 px-2 text-[10px] uppercase tracking-[0.2em] text-white hover:bg-white/10"
                                >
                                  View
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => requestDeleteBattlefield(battlefield.id)}
                                  className="h-6 border-rose-300/40 bg-rose-500/10 px-2 text-[10px] uppercase tracking-[0.2em] text-rose-100 hover:bg-rose-500/20"
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                            <div className="mt-2 flex items-center gap-2 text-[11px] text-white/70">
                              {lane0FactionId ? (
                                <span className="rounded-full bg-white/10 px-2 py-1">
                                  {getFactionName(lane0FactionId)} {counts.lane0}
                                </span>
                              ) : (
                                <span className="rounded-full bg-white/5 px-2 py-1 text-white/40">
                                  Unassigned
                                </span>
                              )}
                              {lane1FactionId ? (
                                <span className="rounded-full bg-white/10 px-2 py-1">
                                  {getFactionName(lane1FactionId)} {counts.lane1}
                                </span>
                              ) : (
                                <span className="rounded-full bg-white/5 px-2 py-1 text-white/40">
                                  Open Slot
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  {matchLog.length ? (
                    <div className="space-y-2">
                      {[...matchLog]
                        .sort((a, b) => b.createdAt - a.createdAt)
                        .map((entry) => (
                          <div
                            key={entry.id}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/80"
                          >
                            <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-white/50">
                              Round {entry.round}
                            </div>
                            <div>{entry.message}</div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-[11px] text-white/50">
                      No match events yet.
                    </div>
                  )}
                </div>
              )}
            </aside>

            <aside className="col-start-3 row-start-1 flex h-full min-h-0 flex-col rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur">
              <div className="mb-2 flex items-center justify-between gap-2 text-xs uppercase tracking-[0.3em] text-white/60">
                <span>
                  {phase === "redeploy" && currentRedeployStage === "place"
                    ? "Returned Fighters"
                    : `${getFactionName(selectedFactionId)} Cards`}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setLibraryOpen(true)}
                    className="h-7 border-white/20 bg-white/5 px-2 text-[10px] uppercase tracking-[0.2em] text-white hover:bg-white/10"
                  >
                    Library
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setTemplateDialogOpen(true)}
                    className="h-7 border-white/20 bg-white/5 px-2 text-[10px] uppercase tracking-[0.2em] text-white hover:bg-white/10"
                  >
                    Templates
                  </Button>
                  <Button
                    size="sm"
                    onClick={addNewCard}
                    className="h-7 bg-amber-400/90 px-2 text-[10px] uppercase tracking-[0.2em] text-slate-950 hover:bg-amber-300"
                  >
                    Add
                  </Button>
                </div>
              </div>
              <div
                ref={(el) => {
                  if (selectedFactionId) {
                    handRefs.current[selectedFactionId] = el;
                  }
                }}
                className="min-h-0 flex-1 overflow-y-auto pr-1"
              >
                <div className="grid grid-cols-2 gap-x-1 gap-y-6 items-start pl-2 pt-[5%]">
                  {sidebarHandCards.map((card, index) => (
                      <div
                        key={card.id}
                        className={`${index % 2 === 0 ? "w-[95%]" : "ml-auto w-[95%]"} cursor-grab`}
                        onPointerDown={(event) => beginSidebarDragIntent(event, card)}
                        onPointerMove={(event) => updateSidebarDragIntent(event, card)}
                        onPointerUp={endSidebarDragIntent}
                        onClick={() => {
                          if (dragIntentRef.current?.dragging) return;
                          setFocusedCardIds([card.id]);
                        }}
                      >
                        {renderCard(card, { size: "sidebar" })}
                      </div>
                    ))}
                </div>
              </div>
            </aside>
          </div>

        </section>

        </div>
        <div className="shrink-0 pt-1">
          <div className="border border-white/10 border-x-0 border-b-0 bg-slate-950 px-6 py-2">
            <div className="flex w-full flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.3em] text-white/60">
                <span>Phase: {phaseLabels[phase]}</span>
                <span>Round {round}</span>
              </div>
              <div className="flex items-center gap-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={previousPhase}
                  disabled={!activeFactionId || !hasPreviousPhase}
                  className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                >
                  <Repeat2 className="mr-2 h-4 w-4" />
                  {phaseVoteDirection === "prev" && waitingOnOthers ? "Waiting..." : "Prev"}
                </Button>
                <div className="relative h-2 flex-1 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-amber-400/90 transition-[width] duration-300"
                    style={{
                      width: `${phaseProgress}%`,
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-between px-0.5">
                    {phaseOrder.map((phaseKey, index) => {
                      const isDone = index <= currentPhaseIndex;
                      const position =
                        phaseOrder.length <= 1 ? 0 : (index / (phaseOrder.length - 1)) * 100;
                      return (
                        <span
                          key={phaseKey}
                          className={`absolute -translate-x-1/2 h-3.5 w-3.5 rounded-full border ${
                            isDone
                              ? "border-amber-300 bg-amber-300"
                              : "border-white/40 bg-slate-900"
                          }`}
                          style={{ left: `${position}%` }}
                        />
                      );
                    })}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={nextPhase}
                  disabled={!activeFactionId || !hasNextAction}
                  className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                >
                  {phase === "results"
                    ? phaseVoteDirection === "next" && waitingOnOthers
                      ? "Waiting..."
                      : "Finish Round"
                    : phaseVoteDirection === "next" && waitingOnOthers
                    ? "Waiting..."
                    : "Next"}
                  <Swords className="ml-2 h-4 w-4" />
                </Button>
                {activeFactionReady && waitingOnOthers ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={cancelPhaseVote}
                    className="border-amber-300/40 bg-amber-300/10 text-amber-100 hover:bg-amber-300/20"
                  >
                    Cancel
                  </Button>
                ) : null}
                {waitingOnMe ? (
                  <span className="rounded-full border border-amber-300/50 bg-amber-300/15 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-amber-100">
                    Other faction is waiting on you for {waitingDirectionLabel}
                  </span>
                ) : waitingOnOthers ? (
                  <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-white/80">
                    Waiting on other faction for {waitingDirectionLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </main>

      {dragPreview}

      {focusedCard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6"
          onClick={() => setFocusedCardIds([])}
        >
          <div className="relative" onClick={(event) => event.stopPropagation()}>
            <Button
              size="sm"
              onClick={() => {
                if (!primaryFocusedCard) return;
                openEditor(primaryFocusedCard);
                setFocusedCardIds([]);
              }}
              className="absolute -top-10 right-0 border border-white/20 bg-white/10 text-xs uppercase tracking-[0.2em] text-white hover:bg-white/20"
            >
              Edit
            </Button>
            <div className="max-h-[972px] w-[40rem] max-w-[1728px] space-y-4 rounded-3xl border border-white/20 bg-slate-950/90 p-5 text-white shadow-[0_30px_70px_rgba(2,6,23,0.6)]">
              <div className="mx-auto w-full max-w-[22rem]">
                {renderCard(focusedCard, { size: "sidebar" })}
              </div>
              {focusedCards.length > 1 ? (
                <div className="grid grid-cols-2 gap-3">
                  {focusedCards.slice(1).map((card) => (
                    <div key={`focused-extra-${card.id}`} className="mx-auto w-full max-w-[14rem]">
                      {renderCard(card, { size: "sidebar" })}
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="space-y-2 text-center">
                <div className="text-xs uppercase tracking-[0.3em] text-white/60">
                  {focusedCard.type} - {getFactionName(focusedCard.ownerFactionId)}
                </div>
                <div className="text-xl font-semibold">{focusedCard.name}</div>
                {focusedCard.descriptor ? (
                  <p className="text-sm text-white/70">{focusedCard.descriptor}</p>
                ) : null}
                {focusedCard.abilityName ? (
                  <p className="text-sm font-semibold text-white/80">{focusedCard.abilityName}</p>
                ) : null}
                <p className="text-sm text-white/70">{focusedCard.abilityDescription}</p>
              </div>
            </div>
          </div>
        </div>
      )}


      <Dialog
        open={libraryOpen}
        onOpenChange={(open) => {
          setLibraryOpen(open);
          if (!open) setEditorCardId(null);
        }}
      >
        <DialogContent className="max-w-6xl border border-white/10 bg-slate-950/95 text-white">
          <DialogHeader>
            <DialogTitle>Card Library</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs uppercase tracking-[0.3em] text-white/60">
                {getFactionName(selectedFactionId)} Cards
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={librarySortKey}
                  onChange={(event) =>
                    setLibrarySortKey(event.target.value as "type" | "score")
                  }
                  className="rounded-md border border-white/20 bg-white px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-900"
                >
                  <option value="type">Sort: Type</option>
                  <option value="score">Sort: Score</option>
                </select>
                <select
                  value={librarySortDir}
                  onChange={(event) =>
                    setLibrarySortDir(event.target.value as "asc" | "desc")
                  }
                  className="rounded-md border border-white/20 bg-white px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-900"
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTemplateDialogOpen(true)}
                  className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                >
                  Edit Templates
                </Button>
                <Button
                  size="sm"
                  onClick={addNewCard}
                  className="bg-amber-400/90 text-slate-950 hover:bg-amber-300"
                >
                  Add New Card
                </Button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {factionLibraryCards.map((card) => {
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => openEditor(card)}
                      className="rounded-xl border border-white/10 bg-white/5 p-3 text-left transition hover:border-white/30"
                    >
                      <div className="mx-auto w-full max-w-[9rem]">
                        {renderCard(card, { size: "library" })}
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/60">
                        <span>{card.type}</span>
                        <span>{card.score} score</span>
                      </div>
                      <div className="mt-1 text-sm font-semibold text-white">{card.name}</div>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                {editorCardId ? (
                  <div className="space-y-4">
                    <div className="text-xs uppercase tracking-[0.3em] text-white/60">
                      {editorCardId === "new" ? "New Card" : "Edit Card"}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                        Name
                      </label>
                      <Input
                        value={editorData.name}
                        onChange={(event) =>
                          setEditorData((prev) => ({ ...prev, name: event.target.value }))
                        }
                        className="mt-2 border-white/20 bg-slate-900/80 text-white placeholder:text-white/40"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                          Type
                        </label>
                        <select
                          value={editorData.type}
                          onChange={(event) =>
                            setEditorData((prev) => ({
                              ...prev,
                              type: event.target.value as CardType,
                            }))
                          }
                          className="mt-2 w-full rounded-md border border-white/20 bg-slate-900/80 px-3 py-2 text-sm text-white"
                        >
                          <option value="fighter">Fighter</option>
                          <option value="spy">Spy</option>
                          <option value="support">Support</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                          Score
                        </label>
                        <Input
                          type="number"
                          value={editorData.score}
                          onChange={(event) =>
                            setEditorData((prev) => ({
                              ...prev,
                              score: Number(event.target.value),
                            }))
                          }
                          className="mt-2 border-white/20 bg-slate-900/80 text-white placeholder:text-white/40"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                        Descriptor
                      </label>
                      <Input
                        value={editorData.descriptor}
                        onChange={(event) =>
                          setEditorData((prev) => ({ ...prev, descriptor: event.target.value }))
                        }
                        className="mt-2 border-white/20 bg-slate-900/80 text-white placeholder:text-white/40"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                        Ability Name
                      </label>
                      <Input
                        value={editorData.abilityName}
                        onChange={(event) =>
                          setEditorData((prev) => ({ ...prev, abilityName: event.target.value }))
                        }
                        className="mt-2 border-white/20 bg-slate-900/80 text-white placeholder:text-white/40"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                        Ability Description
                      </label>
                      <Textarea
                        value={editorData.abilityDescription}
                        onChange={(event) =>
                          setEditorData((prev) => ({
                            ...prev,
                            abilityDescription: event.target.value,
                          }))
                        }
                        rows={3}
                        className="mt-2 border-white/20 bg-slate-900/80 text-white placeholder:text-white/40"
                      />
                    </div>
                    {renderEditorArtLauncher()}
                    <div className="flex flex-wrap justify-end gap-2">
                      {editorCardId !== "new" && (
                        <Button
                          variant="outline"
                          onClick={() => requestDeleteCard(editorCardId)}
                          className="border-rose-300/60 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
                        >
                          Delete
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => setEditorCardId(null)}
                        className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={saveEditor}
                        className="bg-amber-400/90 text-slate-950 hover:bg-amber-300"
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-white/60">
                    Select a card to edit or click Add New Card.
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-6xl border border-white/10 bg-slate-950/95 text-white">
          <DialogHeader>
            <DialogTitle>Card Template Layouts</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                  Card Type
                </label>
                <select
                  value={templateEditorType}
                  onChange={(event) => setTemplateEditorType(event.target.value as CardType)}
                  className="mt-2 w-full rounded-md border border-white/20 bg-slate-900/80 px-3 py-2 text-sm text-white"
                >
                  <option value="fighter">Fighter</option>
                  <option value="spy">Spy</option>
                  <option value="support">Support</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                  Copy To
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {copyToTemplateTargets.map((target) => (
                    <Button
                      key={target}
                      type="button"
                      variant="outline"
                      className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                      onClick={() => requestCopyTemplateFieldsTo(target)}
                    >
                      {target[0].toUpperCase() + target.slice(1)}
                    </Button>
                  ))}
                </div>
                <div className="text-[11px] text-white/50">
                  Copies location, size, font, style, and alignment from current type.
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                  Template Image
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                    onClick={() => {
                      const input = document.getElementById("card-template-upload");
                      if (input) input.click();
                    }}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </Button>
                  <input
                    id="card-template-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        handleTemplateImageUpload(templateEditorType, file);
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => clearTemplateImage(templateEditorType)}
                    className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
                Click a field on the preview, then use arrow keys to nudge it by {TEMPLATE_NUDGE_STEP}
                %. Positions and sizes are percentages of the full card. Font auto-shrinks to fit each
                field box.
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <div className="mx-auto w-full max-w-[15rem]">
                    <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/20 bg-slate-900/60">
                      {templateEditorConfig.templateUrl ? (
                        <img
                          src={templateEditorConfig.templateUrl}
                          alt={`${templateEditorType} template`}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-xs text-white/50">
                          Upload a template image
                        </div>
                      )}
                      {(Object.keys(templateEditorConfig.fields) as TemplateFieldKey[]).map(
                        (fieldKey) => {
                          const field = templateEditorConfig.fields[fieldKey];
                          return (
                            <div
                              key={fieldKey}
                              className={`absolute cursor-pointer border-2 bg-black/5 ${
                                selectedTemplateField === fieldKey
                                  ? "border-black ring-2 ring-cyan-300"
                                  : "border-black"
                              }`}
                              style={{
                                left: `${field.x}%`,
                                top: `${field.y}%`,
                                width: `${field.width}%`,
                                height: `${field.height}%`,
                              }}
                              onClick={() => setSelectedTemplateField(fieldKey)}
                            >
                              <span className="absolute left-1 top-1 rounded bg-black/80 px-1 text-[9px] uppercase tracking-[0.2em] text-white">
                                {TEMPLATE_FIELD_LABELS[fieldKey]}
                              </span>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>
                </div>
                <div className="max-h-[72vh] overflow-y-auto pr-1 space-y-3">
                  {(Object.keys(templateEditorConfig.fields) as TemplateFieldKey[]).map(
                    (fieldKey) => {
                      const field = templateEditorConfig.fields[fieldKey];
                      return (
                        <div
                          key={fieldKey}
                          className={`rounded-xl border bg-white/5 p-3 ${
                            selectedTemplateField === fieldKey
                              ? "border-cyan-300/80"
                              : "border-white/10"
                          }`}
                          onClick={() => setSelectedTemplateField(fieldKey)}
                        >
                          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                            {TEMPLATE_FIELD_LABELS[fieldKey]}
                          </div>
                          <div className="mb-2 grid grid-cols-2 gap-2 text-[10px] text-white/60">
                            <div>`X %`: distance from left edge</div>
                            <div>`Y %`: distance from top edge</div>
                            <div>`Width %`: box width (horizontal)</div>
                            <div>`Height %`: box height (vertical)</div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-white/60">
                                X %
                              </label>
                              <Input
                                type="number"
                                step="0.1"
                                value={field.x}
                                onChange={(event) =>
                                  updateTemplateField(templateEditorType, fieldKey, {
                                    x: Number(event.target.value),
                                  })
                                }
                                className="border-white/20 bg-slate-900/80 text-xs text-white"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-white/60">
                                Y %
                              </label>
                              <Input
                                type="number"
                                step="0.1"
                                value={field.y}
                                onChange={(event) =>
                                  updateTemplateField(templateEditorType, fieldKey, {
                                    y: Number(event.target.value),
                                  })
                                }
                                className="border-white/20 bg-slate-900/80 text-xs text-white"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-white/60">
                                Width %
                              </label>
                              <Input
                                type="number"
                                step="0.1"
                                value={field.width}
                                onChange={(event) =>
                                  updateTemplateField(templateEditorType, fieldKey, {
                                    width: Number(event.target.value),
                                  })
                                }
                                className="border-white/20 bg-slate-900/80 text-xs text-white"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-white/60">
                                Height %
                              </label>
                              <Input
                                type="number"
                                step="0.1"
                                value={field.height}
                                onChange={(event) =>
                                  updateTemplateField(templateEditorType, fieldKey, {
                                    height: Number(event.target.value),
                                  })
                                }
                                className="border-white/20 bg-slate-900/80 text-xs text-white"
                              />
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-4 gap-2">
                            <div>
                              <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-white/60">
                                Font Px
                              </label>
                              <Input
                                type="number"
                                value={field.fontSize}
                                onChange={(event) =>
                                  updateTemplateField(templateEditorType, fieldKey, {
                                    fontSize: Number(event.target.value),
                                  })
                                }
                                className="border-white/20 bg-slate-900/80 text-xs text-white"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-white/60">
                                Min Px
                              </label>
                              <Input
                                type="number"
                                value={field.minFontSize}
                                onChange={(event) =>
                                  updateTemplateField(templateEditorType, fieldKey, {
                                    minFontSize: Number(event.target.value),
                                  })
                                }
                                className="border-white/20 bg-slate-900/80 text-xs text-white"
                              />
                            </div>
                            <select
                              value={field.variant}
                              onChange={(event) =>
                                updateTemplateField(templateEditorType, fieldKey, {
                                  variant: event.target.value as FontVariant,
                                })
                              }
                              className="rounded-md border border-white/20 bg-slate-900/80 px-2 py-2 text-xs text-white"
                            >
                              <option value="normal">Normal</option>
                              <option value="bold">Bold</option>
                              <option value="italic">Italic</option>
                              <option value="boldItalic">Bold+Italic</option>
                            </select>
                            <select
                              value={field.align}
                              onChange={(event) =>
                                updateTemplateField(templateEditorType, fieldKey, {
                                  align: event.target.value as "left" | "center" | "right",
                                })
                              }
                              className="rounded-md border border-white/20 bg-slate-900/80 px-2 py-2 text-xs text-white"
                            >
                              <option value="left">Left</option>
                              <option value="center">Center</option>
                              <option value="right">Right</option>
                            </select>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!pendingTemplateCopyTarget}
        onOpenChange={(open) => {
          if (!open) setPendingTemplateCopyTarget(null);
        }}
      >
        <DialogContent className="border border-white/10 bg-slate-950/95 text-white">
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-white/75">
              Copy current {templateEditorType} field settings to {pendingTemplateCopyTarget}?
            </p>
            <p className="text-xs text-white/55">
              This will replace location, size, font, style, and alignment for the target template.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setPendingTemplateCopyTarget(null)}
                className="border-white/20 bg-white/5 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmCopyTemplateFields}
                className="bg-amber-400/90 text-slate-950 hover:bg-amber-300"
              >
                Copy
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editorCardId && !libraryOpen}
        onOpenChange={(open) => !open && setEditorCardId(null)}
      >
        <DialogContent className="border border-white/10 bg-slate-950/95 text-white">
          <DialogHeader>
            <DialogTitle>Edit Card</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                Name
              </label>
              <Input
                value={editorData.name}
                onChange={(event) =>
                  setEditorData((prev) => ({ ...prev, name: event.target.value }))
                }
                className="mt-2 border-white/20 bg-slate-900/80 text-white placeholder:text-white/40"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                  Type
                </label>
                <select
                  value={editorData.type}
                  onChange={(event) =>
                    setEditorData((prev) => ({
                      ...prev,
                      type: event.target.value as CardType,
                    }))
                  }
                  className="mt-2 w-full rounded-md border border-white/20 bg-slate-900/80 px-3 py-2 text-sm text-white"
                >
                  <option value="fighter">Fighter</option>
                  <option value="spy">Spy</option>
                  <option value="support">Support</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                  Score
                </label>
                <Input
                  type="number"
                  value={editorData.score}
                  onChange={(event) =>
                    setEditorData((prev) => ({
                      ...prev,
                      score: Number(event.target.value),
                    }))
                  }
                  className="mt-2 border-white/20 bg-slate-900/80 text-white placeholder:text-white/40"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                Descriptor
              </label>
              <Input
                value={editorData.descriptor}
                onChange={(event) =>
                  setEditorData((prev) => ({ ...prev, descriptor: event.target.value }))
                }
                className="mt-2 border-white/20 bg-slate-900/80 text-white placeholder:text-white/40"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                Ability Name
              </label>
              <Input
                value={editorData.abilityName}
                onChange={(event) =>
                  setEditorData((prev) => ({ ...prev, abilityName: event.target.value }))
                }
                className="mt-2 border-white/20 bg-slate-900/80 text-white placeholder:text-white/40"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                Ability Description
              </label>
              <Textarea
                value={editorData.abilityDescription}
                onChange={(event) =>
                  setEditorData((prev) => ({
                    ...prev,
                    abilityDescription: event.target.value,
                  }))
                }
                rows={3}
                className="mt-2 border-white/20 bg-slate-900/80 text-white placeholder:text-white/40"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
                Faction
              </label>
              <div className="mt-2 rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm text-white">
                {getFactionName(editorData.ownerFactionId)}
              </div>
            </div>
            {renderEditorArtLauncher()}
          </div>
          <div className="flex justify-end gap-2">
            {editorCardId && editorCardId !== "new" && (
              <Button
                variant="outline"
                onClick={() => requestDeleteCard(editorCardId)}
                className="border-rose-300/60 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
              >
                Delete
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setEditorCardId(null)}
              className="border-white/20 bg-white/5 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button onClick={saveEditor} className="bg-amber-400/90 text-slate-950 hover:bg-amber-300">
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {renderEditorArtDialog()}

      <Dialog
        open={!!confirmCardDeleteId}
        onOpenChange={(open) => {
          if (!open) setConfirmCardDeleteId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Card?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-white/70">
            <p>This will remove the card and any supports attached to it.</p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmCardDeleteId(null)}
                className="border-white/20 bg-white/5 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (confirmCardDeleteId) deleteCard(confirmCardDeleteId);
                  setConfirmCardDeleteId(null);
                }}
                className="bg-rose-500/90 text-white hover:bg-rose-500"
              >
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!confirmBattlefieldDeleteId}
        onOpenChange={(open) => {
          if (!open) setConfirmBattlefieldDeleteId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Battlefield?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-white/70">
            <p>Cards on this battlefield will return to their owners' hands.</p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmBattlefieldDeleteId(null)}
                className="border-white/20 bg-white/5 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (confirmBattlefieldDeleteId) deleteBattlefield(confirmBattlefieldDeleteId);
                  setConfirmBattlefieldDeleteId(null);
                }}
                className="bg-rose-500/90 text-white hover:bg-rose-500"
              >
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(spyOutcome)}
        onOpenChange={(open) => {
          if (!open) setSpyOutcome(null);
        }}
      >
        <DialogContent
          className="border border-white/10 bg-slate-950/95 text-white"
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Spy Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-white/70">
            {spyOutcome?.neutralizedSpyNames.length ? (
              <div className="space-y-1">
                <p>Your spies were neutralized and returned to your deck:</p>
                <ul className="list-disc pl-5 text-white/80">
                  {spyOutcome.neutralizedSpyNames.map((spyName, idx) => (
                    <li key={`neutralized-${idx}`}>{spyName}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {spyOutcome?.successfulSpyNames.length ? (
              <div className="space-y-1">
                <p>Your spies neutralized enemy spies:</p>
                <ul className="list-disc pl-5 text-white/80">
                  {spyOutcome.successfulSpyNames.map((spyName, idx) => (
                    <li key={`successful-${idx}`}>{spyName}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {spyOutcome?.neutralizedEnemyCount ? (
              <p>
                Enemy spies neutralized: <span className="font-semibold">{spyOutcome.neutralizedEnemyCount}</span>
              </p>
            ) : null}
            {!spyOutcome?.neutralizedSpyNames.length &&
            !spyOutcome?.successfulSpyNames.length &&
            !spyOutcome?.neutralizedEnemyCount ? (
              <p>No spy conflicts were resolved this round.</p>
            ) : null}
            <div className="flex justify-end">
              <Button
                onClick={() => setSpyOutcome(null)}
                className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                variant="outline"
              >
                OK
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(resultsAnnouncement)}
        onOpenChange={(open) => {
          if (!open) setResultsAnnouncement(null);
        }}
      >
        <DialogContent
          className="border border-white/10 bg-slate-950/95 text-white"
          onInteractOutside={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Round Results</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-white/70">
            {resultsAnnouncement?.winnerFactionId ? (
              <div className="space-y-1">
                <p>
                  Winner:{" "}
                  <span className="font-semibold">
                    {getFactionName(resultsAnnouncement.winnerFactionId)}
                  </span>{" "}
                  ({resultsAnnouncement.winnerScore} fighter score)
                </p>
                <p>
                  Runner-up fighter score:{" "}
                  <span className="font-semibold">{resultsAnnouncement.runnerUpScore}</span>
                </p>
              </div>
            ) : (
              <p>
                Draw: top fighter score is{" "}
                <span className="font-semibold">{resultsAnnouncement?.winnerScore ?? 0}</span>.
              </p>
            )}
            <div className="flex justify-end">
              <Button
                onClick={() => setResultsAnnouncement(null)}
                className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                variant="outline"
              >
                OK
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
           </div>
         </div>
       </div>
    </div>
  );
}


