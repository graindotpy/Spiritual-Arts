import { and, asc, eq, inArray, sql } from "drizzle-orm";

import {
  activeEffects,
  cardGameStates,
  characters,
  dmGlossary,
  dmScratchpads,
  dmStacks,
  glossaryTerms,
  spiritDiePools,
  spiritualInstrumentAssignments,
  spiritualInstruments,
  techniquePreferences,
  techniques,
  trackers,
  users,
  getSpiritDiceForLevel,
  type ActiveEffect,
  type CardGameState,
  type CardGameStateData,
  type Character,
  type CreateDmCharacter,
  type DmGlossaryTerm,
  type DmScratchpad,
  type DmStack,
  type GlossaryTerm,
  type InsertActiveEffect,
  type InsertCharacter,
  type InsertDmGlossaryTerm,
  type InsertDmScratchpad,
  type InsertDmStack,
  type InsertGlossaryTerm,
  type InsertSpiritDiePool,
  type InsertSpiritualInstrument,
  type InsertTechnique,
  type InsertTechniquePreference,
  type InsertTracker,
  type SpiritDiePool,
  type SpiritualInstrumentWithAssignments,
  type Technique,
  type TechniquePreference,
  type Tracker,
  type UpsertUser,
  type User,
} from "@shared/schema";
import type { Database } from "../db";
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
import { DEFAULT_SEED_DATA } from "./seed";

export class DatabaseStorage implements IStorage {
  constructor(private readonly database: Database) {}

  async getCharacters(): Promise<Character[]> {
    return this.database
      .select()
      .from(characters)
      .where(eq(characters.isDmOnly, false))
      .orderBy(asc(characters.id));
  }

  async getDmCharacters(userId: string): Promise<Character[]> {
    return this.database
      .select()
      .from(characters)
      .where(
        and(
          eq(characters.isDmOnly, true),
          eq(characters.dmOwnerId, userId),
        ),
      )
      .orderBy(asc(characters.id));
  }

  async getCharacter(id: string): Promise<Character | undefined> {
    const [character] = await this.database
      .select()
      .from(characters)
      .where(eq(characters.id, id))
      .limit(1);
    return character;
  }

  async createCharacter(character: InsertCharacter): Promise<Character> {
    const [created] = await this.database
      .insert(characters)
      .values(character)
      .returning();
    return created;
  }

  async createCharacterWithSpiritDice(character: InsertCharacter): Promise<Character> {
    return this.database.transaction(async (transaction) => {
      const [created] = await transaction
        .insert(characters)
        .values(character)
        .returning();
      await transaction.insert(spiritDiePools).values({
        characterId: created.id,
        currentDice: getSpiritDiceForLevel(created.level),
        overrideDice: null,
      });
      return created;
    });
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
    const [updated] = await this.database
      .update(characters)
      .set(character)
      .where(eq(characters.id, id))
      .returning();
    return updated;
  }

  async updateCharacterAndSpiritDice(
    id: string,
    character: CharacterUpdate,
  ): Promise<Character | undefined> {
    return this.database.transaction(async (transaction) => {
      const [updated] = await transaction
        .update(characters)
        .set(character)
        .where(eq(characters.id, id))
        .returning();
      if (!updated || character.level === undefined) return updated;

      const dice = getSpiritDiceForLevel(updated.level);
      const [existingPool] = await transaction
        .select({ id: spiritDiePools.id })
        .from(spiritDiePools)
        .where(eq(spiritDiePools.characterId, id))
        .limit(1);
      if (existingPool) {
        await transaction
          .update(spiritDiePools)
          .set({ currentDice: dice, overrideDice: null })
          .where(eq(spiritDiePools.id, existingPool.id));
      } else {
        await transaction.insert(spiritDiePools).values({
          characterId: id,
          currentDice: dice,
          overrideDice: null,
        });
      }
      return updated;
    });
  }

  async deleteCharacter(id: string): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      const characterTechniques = await transaction
        .select({ id: techniques.id })
        .from(techniques)
        .where(eq(techniques.characterId, id));
      const techniqueIds = characterTechniques.map((technique) => technique.id);

      if (techniqueIds.length > 0) {
        await transaction
          .delete(techniquePreferences)
          .where(inArray(techniquePreferences.techniqueId, techniqueIds));
      }
      await transaction
        .delete(glossaryTerms)
        .where(eq(glossaryTerms.characterId, id));
      await transaction
        .delete(activeEffects)
        .where(eq(activeEffects.characterId, id));
      await transaction
        .delete(techniques)
        .where(eq(techniques.characterId, id));
      await transaction
        .delete(spiritDiePools)
        .where(eq(spiritDiePools.characterId, id));
      await transaction
        .delete(trackers)
        .where(eq(trackers.characterId, id));

      const deleted = await transaction
        .delete(characters)
        .where(eq(characters.id, id))
        .returning({ id: characters.id });
      return deleted.length > 0;
    });
  }

  async getSpiritDiePool(characterId: string): Promise<SpiritDiePool | undefined> {
    const [pool] = await this.database
      .select()
      .from(spiritDiePools)
      .where(eq(spiritDiePools.characterId, characterId))
      .orderBy(asc(spiritDiePools.id))
      .limit(1);
    return pool;
  }

  async createSpiritDiePool(pool: InsertSpiritDiePool): Promise<SpiritDiePool> {
    const [created] = await this.database
      .insert(spiritDiePools)
      .values(pool)
      .returning();
    return created;
  }

  async updateSpiritDiePool(
    characterId: string,
    pool: SpiritDiePoolUpdate,
  ): Promise<SpiritDiePool | undefined> {
    const [updated] = await this.database
      .update(spiritDiePools)
      .set(pool)
      .where(eq(spiritDiePools.characterId, characterId))
      .returning();
    return updated;
  }

  async deleteSpiritDiePool(characterId: string): Promise<boolean> {
    const deleted = await this.database
      .delete(spiritDiePools)
      .where(eq(spiritDiePools.characterId, characterId))
      .returning({ id: spiritDiePools.id });
    return deleted.length > 0;
  }

  async getTechniques(characterId: string): Promise<Technique[]> {
    return this.database
      .select()
      .from(techniques)
      .where(
        and(
          eq(techniques.characterId, characterId),
          eq(techniques.isActive, true),
        ),
      )
      .orderBy(asc(techniques.name), asc(techniques.id));
  }

  async getTechnique(id: string): Promise<Technique | undefined> {
    const [technique] = await this.database
      .select()
      .from(techniques)
      .where(eq(techniques.id, id))
      .limit(1);
    return technique;
  }

  async createTechnique(technique: InsertTechnique): Promise<Technique> {
    const [created] = await this.database
      .insert(techniques)
      .values(technique)
      .returning();
    return created;
  }

  async updateTechnique(
    id: string,
    technique: TechniqueUpdate,
  ): Promise<Technique | undefined> {
    const [updated] = await this.database
      .update(techniques)
      .set(technique)
      .where(eq(techniques.id, id))
      .returning();
    return updated;
  }

  async deleteTechnique(id: string): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      // Production databases created before the refactor may not yet have the
      // cascading foreign key represented by the current Drizzle schema.
      await transaction
        .delete(techniquePreferences)
        .where(eq(techniquePreferences.techniqueId, id));
      const deleted = await transaction
        .delete(techniques)
        .where(eq(techniques.id, id))
        .returning({ id: techniques.id });
      return deleted.length > 0;
    });
  }

  async getActiveEffects(characterId: string): Promise<ActiveEffect[]> {
    return this.database
      .select()
      .from(activeEffects)
      .where(eq(activeEffects.characterId, characterId))
      .orderBy(asc(activeEffects.name), asc(activeEffects.id));
  }

  async createActiveEffect(effect: InsertActiveEffect): Promise<ActiveEffect> {
    const [created] = await this.database
      .insert(activeEffects)
      .values(effect)
      .returning();
    return created;
  }

  async updateActiveEffect(
    id: string,
    effect: ActiveEffectUpdate,
  ): Promise<ActiveEffect | undefined> {
    const [updated] = await this.database
      .update(activeEffects)
      .set(effect)
      .where(eq(activeEffects.id, id))
      .returning();
    return updated;
  }

  async deleteActiveEffect(id: string): Promise<boolean> {
    const deleted = await this.database
      .delete(activeEffects)
      .where(eq(activeEffects.id, id))
      .returning({ id: activeEffects.id });
    return deleted.length > 0;
  }

  async getGlossaryTerms(characterId: string): Promise<GlossaryTerm[]> {
    return this.database
      .select()
      .from(glossaryTerms)
      .where(eq(glossaryTerms.characterId, characterId))
      .orderBy(asc(glossaryTerms.keyword), asc(glossaryTerms.id));
  }

  async createGlossaryTerm(term: InsertGlossaryTerm): Promise<GlossaryTerm> {
    const [created] = await this.database
      .insert(glossaryTerms)
      .values(term)
      .returning();
    return created;
  }

  async updateGlossaryTerm(
    id: string,
    term: GlossaryTermUpdate,
  ): Promise<GlossaryTerm | undefined> {
    const [updated] = await this.database
      .update(glossaryTerms)
      .set(term)
      .where(eq(glossaryTerms.id, id))
      .returning();
    return updated;
  }

  async deleteGlossaryTerm(id: string): Promise<boolean> {
    const deleted = await this.database
      .delete(glossaryTerms)
      .where(eq(glossaryTerms.id, id))
      .returning({ id: glossaryTerms.id });
    return deleted.length > 0;
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await this.database
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user;
  }

  async upsertUser(user: UpsertUser): Promise<User> {
    const { id: _immutableId, createdAt: _createdAt, ...mutableUser } = user;
    const [upserted] = await this.database
      .insert(users)
      .values(user)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...mutableUser,
          updatedAt: new Date(),
        },
      })
      .returning();
    return upserted;
  }

  async getTechniquePreferences(userId: string): Promise<TechniquePreference[]> {
    return this.database
      .select()
      .from(techniquePreferences)
      .where(eq(techniquePreferences.userId, userId))
      .orderBy(
        asc(techniquePreferences.techniqueId),
        asc(techniquePreferences.id),
      );
  }

  async upsertTechniquePreference(
    preference: InsertTechniquePreference,
  ): Promise<TechniquePreference> {
    await this.upsertUser({ id: preference.userId });
    const [upserted] = await this.database
      .insert(techniquePreferences)
      .values(preference)
      .onConflictDoUpdate({
        target: [
          techniquePreferences.userId,
          techniquePreferences.techniqueId,
        ],
        set: {
          isMinimized: preference.isMinimized ?? false,
          updatedAt: new Date(),
        },
      })
      .returning();
    return upserted;
  }

  async getTrackers(characterId: string): Promise<Tracker[]> {
    return this.database
      .select()
      .from(trackers)
      .where(eq(trackers.characterId, characterId))
      .orderBy(asc(trackers.createdAt), asc(trackers.id));
  }

  async createTracker(tracker: InsertTracker): Promise<Tracker> {
    const [created] = await this.database
      .insert(trackers)
      .values(tracker)
      .returning();
    return created;
  }

  async updateTracker(
    id: string,
    tracker: TrackerUpdate,
  ): Promise<Tracker | undefined> {
    const [updated] = await this.database
      .update(trackers)
      .set(tracker)
      .where(eq(trackers.id, id))
      .returning();
    return updated;
  }

  async deleteTracker(id: string): Promise<boolean> {
    const deleted = await this.database
      .delete(trackers)
      .where(eq(trackers.id, id))
      .returning({ id: trackers.id });
    return deleted.length > 0;
  }

  async getSpiritualInstruments(
    includeHidden = false,
  ): Promise<SpiritualInstrumentWithAssignments[]> {
    const instruments = await this.database
      .select()
      .from(spiritualInstruments)
      .where(includeHidden ? undefined : eq(spiritualInstruments.isRevealed, true))
      .orderBy(asc(spiritualInstruments.name), asc(spiritualInstruments.id));
    if (instruments.length === 0) return [];

    const assignments = await this.database
      .select()
      .from(spiritualInstrumentAssignments)
      .where(inArray(spiritualInstrumentAssignments.instrumentId, instruments.map(({ id }) => id)));
    return instruments.map((instrument) => ({
      ...instrument,
      characterIds: assignments
        .filter((assignment) => assignment.instrumentId === instrument.id)
        .map((assignment) => assignment.characterId),
    }));
  }

  async getSpiritualInstrument(
    id: string,
  ): Promise<SpiritualInstrumentWithAssignments | undefined> {
    const [instrument] = await this.database
      .select()
      .from(spiritualInstruments)
      .where(eq(spiritualInstruments.id, id))
      .limit(1);
    if (!instrument) return undefined;

    const assignments = await this.database
      .select({ characterId: spiritualInstrumentAssignments.characterId })
      .from(spiritualInstrumentAssignments)
      .where(eq(spiritualInstrumentAssignments.instrumentId, id));
    return {
      ...instrument,
      characterIds: assignments.map(({ characterId }) => characterId),
    };
  }

  async createSpiritualInstrument(
    instrument: InsertSpiritualInstrument,
  ): Promise<SpiritualInstrumentWithAssignments> {
    const [created] = await this.database
      .insert(spiritualInstruments)
      .values(instrument)
      .returning();
    return { ...created, characterIds: [] };
  }

  async updateSpiritualInstrument(
    id: string,
    instrument: SpiritualInstrumentUpdate,
  ): Promise<SpiritualInstrumentWithAssignments | undefined> {
    const [updated] = await this.database
      .update(spiritualInstruments)
      .set(instrument)
      .where(eq(spiritualInstruments.id, id))
      .returning();
    if (!updated) return undefined;
    const assignments = await this.database
      .select({ characterId: spiritualInstrumentAssignments.characterId })
      .from(spiritualInstrumentAssignments)
      .where(eq(spiritualInstrumentAssignments.instrumentId, id));
    return { ...updated, characterIds: assignments.map(({ characterId }) => characterId) };
  }

  async setSpiritualInstrumentAssignments(
    id: string,
    characterIds: string[],
  ): Promise<SpiritualInstrumentWithAssignments | undefined> {
    return this.database.transaction(async (transaction) => {
      const [instrument] = await transaction
        .select()
        .from(spiritualInstruments)
        .where(eq(spiritualInstruments.id, id))
        .limit(1);
      if (!instrument) return undefined;
      await transaction
        .delete(spiritualInstrumentAssignments)
        .where(eq(spiritualInstrumentAssignments.instrumentId, id));
      const uniqueIds = [...new Set(characterIds)];
      if (uniqueIds.length > 0) {
        await transaction.insert(spiritualInstrumentAssignments).values(
          uniqueIds.map((characterId) => ({ instrumentId: id, characterId })),
        );
      }
      return { ...instrument, characterIds: uniqueIds };
    });
  }

  async deleteSpiritualInstrument(id: string): Promise<boolean> {
    const deleted = await this.database
      .delete(spiritualInstruments)
      .where(eq(spiritualInstruments.id, id))
      .returning({ id: spiritualInstruments.id });
    return deleted.length > 0;
  }

  async getDmStacks(userId: string): Promise<DmStack[]> {
    return this.database
      .select()
      .from(dmStacks)
      .where(eq(dmStacks.userId, userId))
      .orderBy(asc(dmStacks.createdAt), asc(dmStacks.id));
  }

  async createDmStack(stack: InsertDmStack & { userId: string }): Promise<DmStack> {
    const [created] = await this.database
      .insert(dmStacks)
      .values(stack)
      .returning();
    return created;
  }

  async updateDmStack(
    id: string,
    stack: DmStackUpdate,
  ): Promise<DmStack | undefined> {
    const [updated] = await this.database
      .update(dmStacks)
      .set(stack)
      .where(eq(dmStacks.id, id))
      .returning();
    return updated;
  }

  async deleteDmStack(id: string): Promise<boolean> {
    const deleted = await this.database
      .delete(dmStacks)
      .where(eq(dmStacks.id, id))
      .returning({ id: dmStacks.id });
    return deleted.length > 0;
  }

  async getDmGlossary(userId: string): Promise<DmGlossaryTerm[]> {
    return this.database
      .select()
      .from(dmGlossary)
      .where(eq(dmGlossary.userId, userId))
      .orderBy(asc(dmGlossary.keyword), asc(dmGlossary.id));
  }

  async createDmGlossaryTerm(
    term: InsertDmGlossaryTerm & { userId: string },
  ): Promise<DmGlossaryTerm> {
    const [created] = await this.database
      .insert(dmGlossary)
      .values(term)
      .returning();
    return created;
  }

  async updateDmGlossaryTerm(
    id: string,
    term: DmGlossaryUpdate,
  ): Promise<DmGlossaryTerm | undefined> {
    const [updated] = await this.database
      .update(dmGlossary)
      .set(term)
      .where(eq(dmGlossary.id, id))
      .returning();
    return updated;
  }

  async deleteDmGlossaryTerm(id: string): Promise<boolean> {
    const deleted = await this.database
      .delete(dmGlossary)
      .where(eq(dmGlossary.id, id))
      .returning({ id: dmGlossary.id });
    return deleted.length > 0;
  }

  async getDmScratchpads(userId: string): Promise<DmScratchpad[]> {
    return this.database
      .select()
      .from(dmScratchpads)
      .where(eq(dmScratchpads.userId, userId))
      .orderBy(asc(dmScratchpads.createdAt), asc(dmScratchpads.id));
  }

  async createDmScratchpad(
    scratchpad: InsertDmScratchpad & { userId: string },
  ): Promise<DmScratchpad> {
    const [created] = await this.database
      .insert(dmScratchpads)
      .values(scratchpad)
      .returning();
    return created;
  }

  async updateDmScratchpad(
    id: string,
    scratchpad: DmScratchpadUpdate,
  ): Promise<DmScratchpad | undefined> {
    const [updated] = await this.database
      .update(dmScratchpads)
      .set(scratchpad)
      .where(eq(dmScratchpads.id, id))
      .returning();
    return updated;
  }

  async deleteDmScratchpad(id: string): Promise<boolean> {
    const deleted = await this.database
      .delete(dmScratchpads)
      .where(eq(dmScratchpads.id, id))
      .returning({ id: dmScratchpads.id });
    return deleted.length > 0;
  }

  async getCardGameState(id = "default"): Promise<CardGameState | undefined> {
    const [state] = await this.database
      .select()
      .from(cardGameStates)
      .where(eq(cardGameStates.id, id))
      .limit(1);
    return state;
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

    return this.database.transaction(async (transaction) => {
      // The per-state transaction lock makes the read/compare/write sequence atomic,
      // including the first insert when no row exists yet.
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtext(${id}))`,
      );

      const [existing] = await transaction
        .select()
        .from(cardGameStates)
        .where(eq(cardGameStates.id, id))
        .limit(1);
      const existingUpdatedAt = existing?.updatedAt?.getTime() ?? 0;

      // `updatedAt` is an optimistic-lock token issued by the server. Requiring
      // an exact match also rejects client clocks that are ahead of the server;
      // accepting a future timestamp would let a stale client overwrite data.
      if (existing && incomingUpdatedAt !== existingUpdatedAt) {
        return {
          conflict: true,
          state: existing.state,
          updatedAt: existingUpdatedAt,
        };
      }

      const updatedAt = Math.max(Date.now(), existingUpdatedAt + 1);
      const now = new Date(updatedAt);
      const nextState = { ...state, updatedAt };

      if (existing) {
        await transaction
          .update(cardGameStates)
          .set({ state: nextState, updatedAt: now })
          .where(eq(cardGameStates.id, id));
      } else {
        await transaction.insert(cardGameStates).values({
          id,
          state: nextState,
          createdAt: now,
          updatedAt: now,
        });
      }

      return { conflict: false, state: nextState, updatedAt };
    });
  }
}

export async function initializeDatabaseStorage(database: Database): Promise<void> {
  await database.transaction(async (transaction) => {
    const [existingCharacter] = await transaction
      .select({ id: characters.id })
      .from(characters)
      .limit(1);

    if (existingCharacter) {
      return;
    }

    for (const seedCharacter of DEFAULT_SEED_DATA.characters) {
      const { id, techniques: seedTechniques = [], ...character } = seedCharacter;
      await transaction.insert(characters).values({ id, ...character });
      await transaction.insert(spiritDiePools).values({
        characterId: id,
        currentDice: DEFAULT_SEED_DATA.diceForLevel(character.level ?? 3),
        overrideDice: null,
      });

      if (seedTechniques.length > 0) {
        await transaction.insert(techniques).values(
          seedTechniques.map((technique) => ({
            ...technique,
            characterId: id,
          })),
        );
      }
    }
  });
}
