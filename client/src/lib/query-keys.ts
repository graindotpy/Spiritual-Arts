export const characterKeys = {
  all: ["/api/characters"] as const,
  detail: (characterId: string) => ["/api/character", characterId] as const,
  spiritDice: (characterId: string) =>
    ["/api/character", characterId, "spirit-die-pool"] as const,
  techniques: (characterId: string) =>
    ["/api/character", characterId, "techniques"] as const,
  activeEffects: (characterId: string) =>
    ["/api/character", characterId, "active-effects"] as const,
  glossary: (characterId: string) =>
    ["/api/character", characterId, "glossary"] as const,
  trackers: (characterId: string) =>
    ["/api/character", characterId, "trackers"] as const,
};

export const preferenceKeys = {
  techniques: (userId: string) => ["/api/technique-preferences", userId] as const,
};

export const dmKeys = {
  stacks: (userId: string) => ["/api/dm", userId, "stacks"] as const,
  glossary: (userId: string) => ["/api/dm", userId, "glossary"] as const,
  scratchpads: (userId: string) => ["/api/dm", userId, "scratchpads"] as const,
  characters: (userId: string) => ["/api/dm", userId, "characters"] as const,
};

export const foundrySessionKeys = {
  status: ["/api/foundry-session"] as const,
};

export const instrumentKeys = {
  all: (includeHidden = false) => ["/api/instruments", { includeHidden }] as const,
};
