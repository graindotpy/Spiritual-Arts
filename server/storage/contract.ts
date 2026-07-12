import type {
  ActiveEffect,
  CardGameState,
  CardGameStateData,
  Character,
  CreateDmCharacter,
  DmGlossaryTerm,
  DmScratchpad,
  DmStack,
  GlossaryTerm,
  InsertActiveEffect,
  InsertCharacter,
  InsertDmGlossaryTerm,
  InsertDmScratchpad,
  InsertDmStack,
  InsertGlossaryTerm,
  InsertSpiritDiePool,
  InsertSpiritualInstrument,
  InsertTechnique,
  InsertTechniquePreference,
  InsertTracker,
  SpiritDiePool,
  SpiritualInstrumentWithAssignments,
  Technique,
  TechniquePreference,
  Tracker,
  UpsertUser,
  User,
} from "@shared/schema";

export type CharacterUpdate = Partial<
  Omit<Character, "id" | "isDmOnly" | "dmOwnerId">
>;
export type SpiritDiePoolUpdate = Partial<Omit<SpiritDiePool, "id" | "characterId">>;
export type TechniqueUpdate = Partial<Omit<Technique, "id" | "characterId">>;
export type ActiveEffectUpdate = Partial<Omit<ActiveEffect, "id" | "characterId">>;
export type GlossaryTermUpdate = Partial<Omit<GlossaryTerm, "id" | "characterId">>;
export type TrackerUpdate = Partial<Omit<Tracker, "id" | "characterId" | "createdAt">>;
export type SpiritualInstrumentUpdate = Partial<
  Omit<SpiritualInstrumentWithAssignments, "id" | "createdAt" | "characterIds">
>;
export type DmStackUpdate = Partial<Omit<DmStack, "id" | "userId" | "createdAt">>;
export type DmGlossaryUpdate = Partial<Omit<DmGlossaryTerm, "id" | "userId">>;
export type DmScratchpadUpdate = Partial<Omit<DmScratchpad, "id" | "userId" | "createdAt">>;

export interface CardGameStateWriteResult {
  conflict: boolean;
  state: CardGameStateData;
  updatedAt: number;
}

export interface IStorage {
  getCharacters(): Promise<Character[]>;
  getDmCharacters(userId: string): Promise<Character[]>;
  getCharacter(id: string): Promise<Character | undefined>;
  createCharacter(character: InsertCharacter): Promise<Character>;
  createCharacterWithSpiritDice(character: InsertCharacter): Promise<Character>;
  createDmCharacterWithSpiritDice(
    userId: string,
    character: CreateDmCharacter,
  ): Promise<Character>;
  updateCharacter(id: string, character: CharacterUpdate): Promise<Character | undefined>;
  updateCharacterAndSpiritDice(
    id: string,
    character: CharacterUpdate,
  ): Promise<Character | undefined>;
  deleteCharacter(id: string): Promise<boolean>;

  getSpiritDiePool(characterId: string): Promise<SpiritDiePool | undefined>;
  createSpiritDiePool(pool: InsertSpiritDiePool): Promise<SpiritDiePool>;
  updateSpiritDiePool(
    characterId: string,
    pool: SpiritDiePoolUpdate,
  ): Promise<SpiritDiePool | undefined>;
  deleteSpiritDiePool(characterId: string): Promise<boolean>;

  getTechniques(characterId: string): Promise<Technique[]>;
  getTechnique(id: string): Promise<Technique | undefined>;
  createTechnique(technique: InsertTechnique): Promise<Technique>;
  updateTechnique(id: string, technique: TechniqueUpdate): Promise<Technique | undefined>;
  deleteTechnique(id: string): Promise<boolean>;

  getActiveEffects(characterId: string): Promise<ActiveEffect[]>;
  createActiveEffect(effect: InsertActiveEffect): Promise<ActiveEffect>;
  updateActiveEffect(id: string, effect: ActiveEffectUpdate): Promise<ActiveEffect | undefined>;
  deleteActiveEffect(id: string): Promise<boolean>;

  getGlossaryTerms(characterId: string): Promise<GlossaryTerm[]>;
  createGlossaryTerm(term: InsertGlossaryTerm): Promise<GlossaryTerm>;
  updateGlossaryTerm(id: string, term: GlossaryTermUpdate): Promise<GlossaryTerm | undefined>;
  deleteGlossaryTerm(id: string): Promise<boolean>;

  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  getTechniquePreferences(userId: string): Promise<TechniquePreference[]>;
  upsertTechniquePreference(
    preference: InsertTechniquePreference,
  ): Promise<TechniquePreference>;

  getTrackers(characterId: string): Promise<Tracker[]>;
  createTracker(tracker: InsertTracker): Promise<Tracker>;
  updateTracker(id: string, tracker: TrackerUpdate): Promise<Tracker | undefined>;
  deleteTracker(id: string): Promise<boolean>;

  getSpiritualInstruments(includeHidden?: boolean): Promise<SpiritualInstrumentWithAssignments[]>;
  createSpiritualInstrument(instrument: InsertSpiritualInstrument): Promise<SpiritualInstrumentWithAssignments>;
  updateSpiritualInstrument(id: string, instrument: SpiritualInstrumentUpdate): Promise<SpiritualInstrumentWithAssignments | undefined>;
  setSpiritualInstrumentAssignments(id: string, characterIds: string[]): Promise<SpiritualInstrumentWithAssignments | undefined>;
  deleteSpiritualInstrument(id: string): Promise<boolean>;

  getDmStacks(userId: string): Promise<DmStack[]>;
  createDmStack(stack: InsertDmStack & { userId: string }): Promise<DmStack>;
  updateDmStack(id: string, stack: DmStackUpdate): Promise<DmStack | undefined>;
  deleteDmStack(id: string): Promise<boolean>;

  getDmGlossary(userId: string): Promise<DmGlossaryTerm[]>;
  createDmGlossaryTerm(
    term: InsertDmGlossaryTerm & { userId: string },
  ): Promise<DmGlossaryTerm>;
  updateDmGlossaryTerm(
    id: string,
    term: DmGlossaryUpdate,
  ): Promise<DmGlossaryTerm | undefined>;
  deleteDmGlossaryTerm(id: string): Promise<boolean>;

  getDmScratchpads(userId: string): Promise<DmScratchpad[]>;
  createDmScratchpad(
    scratchpad: InsertDmScratchpad & { userId: string },
  ): Promise<DmScratchpad>;
  updateDmScratchpad(
    id: string,
    scratchpad: DmScratchpadUpdate,
  ): Promise<DmScratchpad | undefined>;
  deleteDmScratchpad(id: string): Promise<boolean>;

  getCardGameState(id?: string): Promise<CardGameState | undefined>;
  upsertCardGameState(
    state: CardGameStateData,
    incomingUpdatedAt: number,
    id?: string,
  ): Promise<CardGameStateWriteResult>;
}
