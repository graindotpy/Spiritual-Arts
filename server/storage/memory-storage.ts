import { randomUUID } from "node:crypto";

import { getSpiritDiceForLevel } from "@shared/schema";
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

import type {
  ActiveEffectUpdate,
  CharacterUpdate,
  DmGlossaryUpdate,
  DmScratchpadUpdate,
  DmStackUpdate,
  GlossaryTermUpdate,
  IStorage,
  SpiritDiePoolUpdate,
  SpiritualInstrumentUpdate,
  TechniqueUpdate,
  TrackerUpdate,
} from "./contract";
import { DEFAULT_SEED_DATA, type DefaultSeedData } from "./seed";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function compareIds(left: { id: string }, right: { id: string }): number {
  return left.id.localeCompare(right.id);
}

function compareTextThenId(
  leftText: string,
  rightText: string,
  leftId: string,
  rightId: string,
): number {
  return leftText.localeCompare(rightText) || leftId.localeCompare(rightId);
}

function compareCreatedAtThenId(
  left: { id: string; createdAt: Date | null },
  right: { id: string; createdAt: Date | null },
): number {
  const leftTime = left.createdAt?.getTime() ?? 0;
  const rightTime = right.createdAt?.getTime() ?? 0;
  return leftTime - rightTime || left.id.localeCompare(right.id);
}

export class MemStorage implements IStorage {
  private readonly characters = new Map<string, Character>();
  private readonly spiritDiePools = new Map<string, SpiritDiePool>();
  private readonly techniques = new Map<string, Technique>();
  private readonly activeEffects = new Map<string, ActiveEffect>();
  private readonly glossaryTerms = new Map<string, GlossaryTerm>();
  private readonly users = new Map<string, User>();
  private readonly techniquePreferences = new Map<string, TechniquePreference>();
  private readonly trackers = new Map<string, Tracker>();
  private readonly spiritualInstruments = new Map<string, SpiritualInstrumentWithAssignments>();
  private readonly dmStacks = new Map<string, DmStack>();
  private readonly dmGlossary = new Map<string, DmGlossaryTerm>();
  private readonly dmScratchpads = new Map<string, DmScratchpad>();
  private readonly cardGameStates = new Map<string, CardGameState>();

  constructor(seedData: DefaultSeedData | null = DEFAULT_SEED_DATA) {
    if (seedData) {
      this.seedSynchronously(seedData);
    }
  }

  private seedSynchronously(seedData: DefaultSeedData): void {
    for (const seedCharacter of seedData.characters) {
      const { id, techniques = [], ...character } = seedCharacter;
      const createdCharacter = this.buildCharacter(character, id);
      this.characters.set(createdCharacter.id, createdCharacter);

      const pool = this.buildSpiritDiePool({
        characterId: createdCharacter.id,
        currentDice: seedData.diceForLevel(createdCharacter.level),
        overrideDice: null,
      });
      this.spiritDiePools.set(pool.id, pool);

      for (const technique of techniques) {
        const createdTechnique = this.buildTechnique({
          ...technique,
          characterId: createdCharacter.id,
        });
        this.techniques.set(createdTechnique.id, createdTechnique);
      }
    }
  }

  private buildCharacter(
    character: InsertCharacter,
    id: string = randomUUID(),
  ): Character {
    return {
      ...clone(character),
      id,
      level: character.level ?? 3,
      highestAbilityScore: character.highestAbilityScore ?? null,
      portraitUrl: character.portraitUrl ?? null,
      isDmOnly: character.isDmOnly ?? false,
      dmOwnerId: character.dmOwnerId ?? null,
    };
  }

  private buildSpiritDiePool(
    pool: InsertSpiritDiePool,
    id: string = randomUUID(),
  ): SpiritDiePool {
    return {
      ...clone(pool),
      id,
      overrideDice: pool.overrideDice ?? null,
    };
  }

  private buildTechnique(
    technique: InsertTechnique,
    id: string = randomUUID(),
  ): Technique {
    return {
      ...clone(technique),
      id,
      isActive: technique.isActive ?? true,
    };
  }

  async getCharacters(): Promise<Character[]> {
    return clone(
      Array.from(this.characters.values())
        .filter((character) => !character.isDmOnly)
        .sort(compareIds),
    );
  }

  async getDmCharacters(userId: string): Promise<Character[]> {
    return clone(
      Array.from(this.characters.values())
        .filter(
          (character) =>
            character.isDmOnly && character.dmOwnerId === userId,
        )
        .sort(compareIds),
    );
  }

  async getCharacter(id: string): Promise<Character | undefined> {
    const character = this.characters.get(id);
    return character ? clone(character) : undefined;
  }

  async createCharacter(character: InsertCharacter): Promise<Character> {
    const created = this.buildCharacter(character);
    this.characters.set(created.id, created);
    return clone(created);
  }

  async createCharacterWithSpiritDice(character: InsertCharacter): Promise<Character> {
    const created = this.buildCharacter(character);
    const pool = this.buildSpiritDiePool({
      characterId: created.id,
      currentDice: getSpiritDiceForLevel(created.level),
      overrideDice: null,
    });
    this.characters.set(created.id, created);
    this.spiritDiePools.set(pool.id, pool);
    return clone(created);
  }

  async createDmCharacterWithSpiritDice(
    userId: string,
    character: CreateDmCharacter,
  ): Promise<Character> {
    return this.createCharacterWithSpiritDice({
      ...character,
      isDmOnly: true,
      dmOwnerId: userId,
    });
  }

  async updateCharacter(
    id: string,
    character: CharacterUpdate,
  ): Promise<Character | undefined> {
    return this.updateRecord(this.characters, id, character);
  }

  async updateCharacterAndSpiritDice(
    id: string,
    character: CharacterUpdate,
  ): Promise<Character | undefined> {
    const existing = this.characters.get(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...clone(character) };
    this.characters.set(id, updated);
    if (character.level !== undefined) {
      const existingPool = Array.from(this.spiritDiePools.values()).find(
        (pool) => pool.characterId === id,
      );
      const dice = getSpiritDiceForLevel(updated.level);
      if (existingPool) {
        this.spiritDiePools.set(existingPool.id, {
          ...existingPool,
          currentDice: dice,
          overrideDice: null,
        });
      } else {
        const pool = this.buildSpiritDiePool({
          characterId: id,
          currentDice: dice,
          overrideDice: null,
        });
        this.spiritDiePools.set(pool.id, pool);
      }
    }
    return clone(updated);
  }

  async deleteCharacter(id: string): Promise<boolean> {
    if (!this.characters.delete(id)) {
      return false;
    }

    const techniqueIds = new Set(
      Array.from(this.techniques.values())
        .filter((technique) => technique.characterId === id)
        .map((technique) => technique.id),
    );

    for (const [poolId, pool] of this.spiritDiePools) {
      if (pool.characterId === id) this.spiritDiePools.delete(poolId);
    }
    for (const techniqueId of techniqueIds) {
      this.techniques.delete(techniqueId);
    }
    for (const [effectId, effect] of this.activeEffects) {
      if (effect.characterId === id) this.activeEffects.delete(effectId);
    }
    for (const [termId, term] of this.glossaryTerms) {
      if (term.characterId === id) this.glossaryTerms.delete(termId);
    }
    for (const [trackerId, tracker] of this.trackers) {
      if (tracker.characterId === id) this.trackers.delete(trackerId);
    }
    for (const [preferenceId, preference] of this.techniquePreferences) {
      if (techniqueIds.has(preference.techniqueId)) {
        this.techniquePreferences.delete(preferenceId);
      }
    }
    for (const [instrumentId, instrument] of this.spiritualInstruments) {
      if (instrument.characterIds.includes(id)) {
        this.spiritualInstruments.set(instrumentId, {
          ...instrument,
          characterIds: instrument.characterIds.filter((characterId) => characterId !== id),
        });
      }
    }

    return true;
  }

  async getSpiritDiePool(characterId: string): Promise<SpiritDiePool | undefined> {
    const pool = Array.from(this.spiritDiePools.values())
      .filter((candidate) => candidate.characterId === characterId)
      .sort(compareIds)[0];
    return pool ? clone(pool) : undefined;
  }

  async createSpiritDiePool(pool: InsertSpiritDiePool): Promise<SpiritDiePool> {
    this.assertCharacterExists(pool.characterId);
    const duplicate = Array.from(this.spiritDiePools.values()).some(
      (candidate) => candidate.characterId === pool.characterId,
    );
    if (duplicate) {
      throw new Error(`Spirit die pool already exists for character ${pool.characterId}`);
    }

    const created = this.buildSpiritDiePool(pool);
    this.spiritDiePools.set(created.id, created);
    return clone(created);
  }

  async updateSpiritDiePool(
    characterId: string,
    pool: SpiritDiePoolUpdate,
  ): Promise<SpiritDiePool | undefined> {
    const existing = await this.getSpiritDiePool(characterId);
    return existing
      ? this.updateRecord(this.spiritDiePools, existing.id, pool)
      : undefined;
  }

  async deleteSpiritDiePool(characterId: string): Promise<boolean> {
    const matchingIds = Array.from(this.spiritDiePools.values())
      .filter((pool) => pool.characterId === characterId)
      .map((pool) => pool.id);
    for (const id of matchingIds) {
      this.spiritDiePools.delete(id);
    }
    return matchingIds.length > 0;
  }

  async getTechniques(characterId: string): Promise<Technique[]> {
    const techniques = Array.from(this.techniques.values())
      .filter((technique) => technique.characterId === characterId && technique.isActive)
      .sort((left, right) =>
        compareTextThenId(left.name, right.name, left.id, right.id),
      );
    return clone(techniques);
  }

  async getTechnique(id: string): Promise<Technique | undefined> {
    const technique = this.techniques.get(id);
    return technique ? clone(technique) : undefined;
  }

  async createTechnique(technique: InsertTechnique): Promise<Technique> {
    this.assertCharacterExists(technique.characterId);
    const created = this.buildTechnique(technique);
    this.techniques.set(created.id, created);
    return clone(created);
  }

  async updateTechnique(
    id: string,
    technique: TechniqueUpdate,
  ): Promise<Technique | undefined> {
    return this.updateRecord(this.techniques, id, technique);
  }

  async deleteTechnique(id: string): Promise<boolean> {
    const deleted = this.techniques.delete(id);
    if (deleted) {
      for (const preference of Array.from(this.techniquePreferences.values())) {
        if (preference.techniqueId === id) {
          this.techniquePreferences.delete(preference.id);
        }
      }
    }
    return deleted;
  }

  async getActiveEffects(characterId: string): Promise<ActiveEffect[]> {
    const effects = Array.from(this.activeEffects.values())
      .filter((effect) => effect.characterId === characterId)
      .sort((left, right) =>
        compareTextThenId(left.name, right.name, left.id, right.id),
      );
    return clone(effects);
  }

  async createActiveEffect(effect: InsertActiveEffect): Promise<ActiveEffect> {
    this.assertCharacterExists(effect.characterId);
    const created: ActiveEffect = {
      ...clone(effect),
      id: randomUUID(),
      level: effect.level === undefined ? 1 : effect.level,
      description: effect.description ?? null,
    };
    this.activeEffects.set(created.id, created);
    return clone(created);
  }

  async updateActiveEffect(
    id: string,
    effect: ActiveEffectUpdate,
  ): Promise<ActiveEffect | undefined> {
    return this.updateRecord(this.activeEffects, id, effect);
  }

  async deleteActiveEffect(id: string): Promise<boolean> {
    return this.activeEffects.delete(id);
  }

  async getGlossaryTerms(characterId: string): Promise<GlossaryTerm[]> {
    const terms = Array.from(this.glossaryTerms.values())
      .filter((term) => term.characterId === characterId)
      .sort((left, right) =>
        compareTextThenId(left.keyword, right.keyword, left.id, right.id),
      );
    return clone(terms);
  }

  async createGlossaryTerm(term: InsertGlossaryTerm): Promise<GlossaryTerm> {
    this.assertCharacterExists(term.characterId);
    const created: GlossaryTerm = {
      ...clone(term),
      id: randomUUID(),
      expandedContent: term.expandedContent ?? null,
      hasExpandedContent: term.hasExpandedContent ?? false,
    };
    this.glossaryTerms.set(created.id, created);
    return clone(created);
  }

  async updateGlossaryTerm(
    id: string,
    term: GlossaryTermUpdate,
  ): Promise<GlossaryTerm | undefined> {
    return this.updateRecord(this.glossaryTerms, id, term);
  }

  async deleteGlossaryTerm(id: string): Promise<boolean> {
    return this.glossaryTerms.delete(id);
  }

  async getUser(id: string): Promise<User | undefined> {
    const user = this.users.get(id);
    return user ? clone(user) : undefined;
  }

  async upsertUser(user: UpsertUser): Promise<User> {
    const id = user.id ?? randomUUID();
    const existing = this.users.get(id);
    const now = new Date();
    const upserted: User = existing
      ? {
          ...existing,
          email: user.email === undefined ? existing.email : user.email,
          firstName:
            user.firstName === undefined ? existing.firstName : user.firstName,
          lastName: user.lastName === undefined ? existing.lastName : user.lastName,
          profileImageUrl:
            user.profileImageUrl === undefined
              ? existing.profileImageUrl
              : user.profileImageUrl,
          updatedAt: now,
        }
      : {
          id,
          email: user.email ?? null,
          firstName: user.firstName ?? null,
          lastName: user.lastName ?? null,
          profileImageUrl: user.profileImageUrl ?? null,
          createdAt: user.createdAt === undefined ? now : user.createdAt,
          updatedAt: user.updatedAt === undefined ? now : user.updatedAt,
        };
    this.users.set(id, upserted);
    return clone(upserted);
  }

  async getTechniquePreferences(userId: string): Promise<TechniquePreference[]> {
    const preferences = Array.from(this.techniquePreferences.values())
      .filter((preference) => preference.userId === userId)
      .sort((left, right) =>
        left.techniqueId.localeCompare(right.techniqueId) || compareIds(left, right),
      );
    return clone(preferences);
  }

  async upsertTechniquePreference(
    preference: InsertTechniquePreference,
  ): Promise<TechniquePreference> {
    await this.upsertUser({ id: preference.userId });
    if (!this.techniques.has(preference.techniqueId)) {
      throw new Error(`Technique ${preference.techniqueId} does not exist`);
    }
    const existing = Array.from(this.techniquePreferences.values()).find(
      (candidate) =>
        candidate.userId === preference.userId &&
        candidate.techniqueId === preference.techniqueId,
    );
    const now = new Date();

    if (existing) {
      const updated: TechniquePreference = {
        ...existing,
        isMinimized: preference.isMinimized ?? false,
        updatedAt: now,
      };
      this.techniquePreferences.set(updated.id, updated);
      return clone(updated);
    }

    const created: TechniquePreference = {
      id: preference.id ?? randomUUID(),
      userId: preference.userId,
      techniqueId: preference.techniqueId,
      isMinimized: preference.isMinimized ?? false,
      createdAt: preference.createdAt === undefined ? now : preference.createdAt,
      updatedAt: preference.updatedAt === undefined ? now : preference.updatedAt,
    };
    this.techniquePreferences.set(created.id, created);
    return clone(created);
  }

  async getTrackers(characterId: string): Promise<Tracker[]> {
    const trackers = Array.from(this.trackers.values())
      .filter((tracker) => tracker.characterId === characterId)
      .sort(compareCreatedAtThenId);
    return clone(trackers);
  }

  async createTracker(tracker: InsertTracker): Promise<Tracker> {
    this.assertCharacterExists(tracker.characterId);
    const created: Tracker = {
      ...clone(tracker),
      id: tracker.id ?? randomUUID(),
      currentValue:
        tracker.currentValue === undefined ? 0 : tracker.currentValue,
      target: tracker.target ?? null,
      createdAt: tracker.createdAt === undefined ? new Date() : tracker.createdAt,
    };
    this.trackers.set(created.id, created);
    return clone(created);
  }

  async updateTracker(
    id: string,
    tracker: TrackerUpdate,
  ): Promise<Tracker | undefined> {
    return this.updateRecord(this.trackers, id, tracker);
  }

  async deleteTracker(id: string): Promise<boolean> {
    return this.trackers.delete(id);
  }

  async getSpiritualInstruments(
    includeHidden = false,
  ): Promise<SpiritualInstrumentWithAssignments[]> {
    return clone(
      Array.from(this.spiritualInstruments.values())
        .filter((instrument) => includeHidden || instrument.isRevealed)
        .sort((left, right) =>
          compareTextThenId(left.name, right.name, left.id, right.id),
        ),
    );
  }

  async createSpiritualInstrument(
    instrument: InsertSpiritualInstrument,
  ): Promise<SpiritualInstrumentWithAssignments> {
    const created: SpiritualInstrumentWithAssignments = {
      ...clone(instrument),
      id: randomUUID(),
      imageUrl: instrument.imageUrl ?? null,
      expandedContent: instrument.expandedContent ?? null,
      hasExpandedContent: instrument.hasExpandedContent ?? false,
      isRevealed: instrument.isRevealed ?? true,
      createdAt: new Date(),
      characterIds: [],
    };
    this.spiritualInstruments.set(created.id, created);
    return clone(created);
  }

  async updateSpiritualInstrument(
    id: string,
    instrument: SpiritualInstrumentUpdate,
  ): Promise<SpiritualInstrumentWithAssignments | undefined> {
    return this.updateRecord(this.spiritualInstruments, id, instrument);
  }

  async setSpiritualInstrumentAssignments(
    id: string,
    characterIds: string[],
  ): Promise<SpiritualInstrumentWithAssignments | undefined> {
    const existing = this.spiritualInstruments.get(id);
    if (!existing) return undefined;
    const uniqueIds = [...new Set(characterIds)];
    uniqueIds.forEach((characterId) => this.assertCharacterExists(characterId));
    const updated = { ...existing, characterIds: uniqueIds };
    this.spiritualInstruments.set(id, updated);
    return clone(updated);
  }

  async deleteSpiritualInstrument(id: string): Promise<boolean> {
    return this.spiritualInstruments.delete(id);
  }

  async getDmStacks(userId: string): Promise<DmStack[]> {
    const stacks = Array.from(this.dmStacks.values())
      .filter((stack) => stack.userId === userId)
      .sort(compareCreatedAtThenId);
    return clone(stacks);
  }

  async createDmStack(stack: InsertDmStack & { userId: string }): Promise<DmStack> {
    const created: DmStack = {
      ...clone(stack),
      id: randomUUID(),
      name: stack.name ?? "Unnamed Stack",
      createdAt: new Date(),
    };
    this.dmStacks.set(created.id, created);
    return clone(created);
  }

  async updateDmStack(
    id: string,
    stack: DmStackUpdate,
  ): Promise<DmStack | undefined> {
    return this.updateRecord(this.dmStacks, id, stack);
  }

  async deleteDmStack(id: string): Promise<boolean> {
    return this.dmStacks.delete(id);
  }

  async getDmGlossary(userId: string): Promise<DmGlossaryTerm[]> {
    const terms = Array.from(this.dmGlossary.values())
      .filter((term) => term.userId === userId)
      .sort((left, right) =>
        compareTextThenId(left.keyword, right.keyword, left.id, right.id),
      );
    return clone(terms);
  }

  async createDmGlossaryTerm(
    term: InsertDmGlossaryTerm & { userId: string },
  ): Promise<DmGlossaryTerm> {
    const created: DmGlossaryTerm = {
      ...clone(term),
      id: randomUUID(),
      expandedContent: term.expandedContent ?? null,
      hasExpandedContent: term.hasExpandedContent ?? false,
    };
    this.dmGlossary.set(created.id, created);
    return clone(created);
  }

  async updateDmGlossaryTerm(
    id: string,
    term: DmGlossaryUpdate,
  ): Promise<DmGlossaryTerm | undefined> {
    return this.updateRecord(this.dmGlossary, id, term);
  }

  async deleteDmGlossaryTerm(id: string): Promise<boolean> {
    return this.dmGlossary.delete(id);
  }

  async getDmScratchpads(userId: string): Promise<DmScratchpad[]> {
    const scratchpads = Array.from(this.dmScratchpads.values())
      .filter((scratchpad) => scratchpad.userId === userId)
      .sort(compareCreatedAtThenId);
    return clone(scratchpads);
  }

  async createDmScratchpad(
    scratchpad: InsertDmScratchpad & { userId: string },
  ): Promise<DmScratchpad> {
    const created: DmScratchpad = {
      ...clone(scratchpad),
      id: randomUUID(),
      title: scratchpad.title ?? "Scratchpad",
      content: scratchpad.content ?? "",
      createdAt: new Date(),
    };
    this.dmScratchpads.set(created.id, created);
    return clone(created);
  }

  async updateDmScratchpad(
    id: string,
    scratchpad: DmScratchpadUpdate,
  ): Promise<DmScratchpad | undefined> {
    return this.updateRecord(this.dmScratchpads, id, scratchpad);
  }

  async deleteDmScratchpad(id: string): Promise<boolean> {
    return this.dmScratchpads.delete(id);
  }

  async getCardGameState(id = "default"): Promise<CardGameState | undefined> {
    const state = this.cardGameStates.get(id);
    return state ? clone(state) : undefined;
  }

  async upsertCardGameState(
    state: CardGameStateData,
    incomingUpdatedAt: number,
    id = "default",
  ): Promise<{
    conflict: boolean;
    state: CardGameStateData;
    updatedAt: number;
  }> {
    if (!Number.isFinite(incomingUpdatedAt) || incomingUpdatedAt < 0) {
      throw new RangeError("incomingUpdatedAt must be a non-negative finite number");
    }

    const existing = this.cardGameStates.get(id);
    const existingUpdatedAt = existing?.updatedAt?.getTime() ?? 0;
    if (existing && incomingUpdatedAt !== existingUpdatedAt) {
      return {
        conflict: true,
        state: clone(existing.state),
        updatedAt: existingUpdatedAt,
      };
    }

    const updatedAt = Math.max(Date.now(), existingUpdatedAt + 1);
    const now = new Date(updatedAt);
    const nextState = { ...clone(state), updatedAt };
    const upserted: CardGameState = {
      id,
      state: nextState,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.cardGameStates.set(id, upserted);

    return { conflict: false, state: clone(nextState), updatedAt };
  }

  private assertCharacterExists(characterId: string): void {
    if (!this.characters.has(characterId)) {
      throw new Error(`Character ${characterId} does not exist`);
    }
  }

  private async updateRecord<T extends { id: string }>(
    records: Map<string, T>,
    id: string,
    update: Partial<Omit<T, "id">>,
  ): Promise<T | undefined> {
    const existing = records.get(id);
    if (!existing) {
      return undefined;
    }

    const updated = { ...existing, ...clone(update), id } as T;
    records.set(id, updated);
    return clone(updated);
  }
}
