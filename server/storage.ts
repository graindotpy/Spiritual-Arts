import { 
  characters,
  spiritDiePools,
  techniques,
  activeEffects,
  glossaryTerms,
  users,
  techniquePreferences,
  trackers,
  type Character, 
  type InsertCharacter,
  type SpiritDiePool,
  type InsertSpiritDiePool,
  type Technique,
  type InsertTechnique,
  type ActiveEffect,
  type InsertActiveEffect,
  type GlossaryTerm,
  type InsertGlossaryTerm,
  type User,
  type UpsertUser,
  type TechniquePreference,
  type InsertTechniquePreference,
  type Tracker,
  type InsertTracker,
  type DieSize,
  SPIRIT_DIE_PROGRESSION
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // Characters
  getCharacter(id: string): Promise<Character | undefined>;
  createCharacter(character: InsertCharacter): Promise<Character>;
  updateCharacter(id: string, character: Partial<Character>): Promise<Character | undefined>;

  // Spirit Die Pools
  getSpiritDiePool(characterId: string): Promise<SpiritDiePool | undefined>;
  createSpiritDiePool(pool: InsertSpiritDiePool): Promise<SpiritDiePool>;
  updateSpiritDiePool(characterId: string, pool: Partial<SpiritDiePool>): Promise<SpiritDiePool | undefined>;
  deleteSpiritDiePool(characterId: string): Promise<boolean>;

  // Techniques
  getTechniques(characterId: string): Promise<Technique[]>;
  getTechnique(id: string): Promise<Technique | undefined>;
  createTechnique(technique: InsertTechnique): Promise<Technique>;
  updateTechnique(id: string, technique: Partial<Technique>): Promise<Technique | undefined>;
  deleteTechnique(id: string): Promise<boolean>;

  // Active Effects
  getActiveEffects(characterId: string): Promise<ActiveEffect[]>;
  createActiveEffect(effect: InsertActiveEffect): Promise<ActiveEffect>;
  updateActiveEffect(id: string, effect: Partial<ActiveEffect>): Promise<ActiveEffect | undefined>;
  deleteActiveEffect(id: string): Promise<boolean>;

  // Glossary Terms
  getGlossaryTerms(characterId: string): Promise<GlossaryTerm[]>;
  createGlossaryTerm(term: InsertGlossaryTerm): Promise<GlossaryTerm>;
  updateGlossaryTerm(id: string, term: Partial<GlossaryTerm>): Promise<GlossaryTerm | undefined>;
  deleteGlossaryTerm(id: string): Promise<boolean>;

  // Users (for authentication)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Technique Preferences
  getTechniquePreferences(userId: string): Promise<TechniquePreference[]>;
  upsertTechniquePreference(preference: InsertTechniquePreference): Promise<TechniquePreference>;

  // Trackers
  getTrackers(characterId: string): Promise<Tracker[]>;
  createTracker(tracker: InsertTracker): Promise<Tracker>;
  updateTracker(id: string, tracker: Partial<Tracker>): Promise<Tracker | undefined>;
  deleteTracker(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private characters: Map<string, Character>;
  private spiritDiePools: Map<string, SpiritDiePool>;
  private techniques: Map<string, Technique>;
  private activeEffects: Map<string, ActiveEffect>;
  private glossaryTerms: Map<string, GlossaryTerm>;

  constructor() {
    this.characters = new Map();
    this.spiritDiePools = new Map();
    this.techniques = new Map();
    this.activeEffects = new Map();
    this.glossaryTerms = new Map();
    
    // Initialize with R'aan Fames character
    this.initializeDefaultData();
  }

  private async initializeDefaultData() {
    // Create R'aan Fames with the expected ID and level
    const raanFames = await this.createCharacterWithId("2167178a-df9f-4f08-8d94-05b342dfcef1", {
      name: "R'aan Fames",
      path: "Path of Gluttony",
      level: 9,
      portraitUrl: "/uploads/portraits/portrait-1753820547027-209797711.jpg"
    });

    // Create Azuma
    const azuma = await this.createCharacterWithId("50cf2e2f-d76d-452d-8f70-da84c2aadbd4", {
      name: "Azuma",
      path: "Hiroshi-Do", 
      level: 9,
      portraitUrl: "/uploads/portraits/portrait-1753823004361-578891944.jpg"
    });

    // Create Yorinaga Masashige
    const yorinaga = await this.createCharacterWithId("d0efdf5f-c9f2-4803-8488-4e757d37a202", {
      name: "Yorinaga Masashige",
      path: "Path of the Spiteful Dragon",
      level: 9,
      portraitUrl: null
    });

    // Create spirit die pools for all characters
    await this.createSpiritDiePool({
      characterId: raanFames.id,
      currentDice: ["d6", "d6"], // Level 9 dice
      overrideDice: null
    });

    await this.createSpiritDiePool({
      characterId: azuma.id,
      currentDice: ["d6", "d6"], // Level 9 dice
      overrideDice: null
    });

    await this.createSpiritDiePool({
      characterId: yorinaga.id,
      currentDice: ["d6", "d6"], // Level 9 dice
      overrideDice: null
    });

    // Create default techniques from the PDF
    const techniques = [
      {
        name: "Omnivore",
        triggerDescription: "You activate this technique as a reaction when you reduce a creature to 0HP.",
        spEffects: {
          1: { effect: "You gain 5 temporary hit points.", actionType: "reaction" },
          3: { effect: "You grow in size by one stage. Melee attacks now deal 1d4 extra damage, and you have advantage on strength checks and saving throws.", actionType: "reaction" },
          4: { effect: "You regain HP equal to 3d8 + your Spiritual Arts modifier", actionType: "reaction" },
          6: { effect: "You gain the ability to absorb one technique from the target - stealing for yourself, temporarily. See Technique Drain for full details. At 6SP, the stolen Technique lasts for one hour, or until you use it.", actionType: "reaction" }
        }
      },
      {
        name: "Tongue Lash",
        triggerDescription: "You activate this technique as a Bonus Action.",
        spEffects: {
          2: { effect: "Your tongue has a 15ft range. The target gains one level of Grung Toxin. Make an attack roll with your Spiritual Arts modifier against a creature within range. You only expend a Spirit Die if the attack makes contact.", actionType: "bonus" },
          3: { effect: "Your tongue deals 2d6 poison damage", actionType: "bonus" },
          4: { effect: "Your tongue now has a range of 25ft. You inflict two levels of Grung Toxin.", actionType: "bonus" },
          6: { effect: "Your tongue now deals 5d6 poison damage. The target must make a Strength saving throw - on a fail, you may choose to either grapple the target (with your tongue) or knock them prone.", actionType: "bonus" }
        }
      },
      {
        name: "The Thrill of the Hunt",
        triggerDescription: "You activate this technique as a reaction, when you cause damage to a target.",
        spEffects: {
          4: { effect: "Your speed increases by 10ft. You have an additional +1 to hit with melee attacks. Your extra bite attack deals 1d8+Wis poison damage. When you activate this technique, you target a creature within 30ft - this creature becomes the target of your hunger.", actionType: "reaction" },
          6: { effect: "All hits with a melee weapon deal 1d8 extra damage. If you are within 20ft of the target of your hunt, attack rolls are made against you with disadvantage. You are invisible to the target of your hunt outside of this range.", actionType: "reaction" }
        }
      },
      {
        name: "Bear's Ferocity",
        triggerDescription: "Once you activate this technique, you must make a melee attack against a creature on each of your turns.",
        spEffects: {
          2: { effect: "You grow sharp and your fangs increase in length, becoming natural weapons which deal 1d8 damage. If you make a second attack with your bonus action as part of two weapon fighting, add your full modifier.", actionType: "action" },
          4: { effect: "Your natural weapons receive a +2 bonus to attack and damage. You gain the Extra Attack feature. Once per turn, when you hit with one of these attacks, you can force the target to make a Con saving throw. On a fail, you inflict one level of Grung Toxin.", actionType: "action" },
          6: { effect: "Your natural weapons now inflict 1d12 damage, and their modifier increases to +3. Your size increases by one stage, and your range increases by 5ft. You are immune to the effects of Mind Control", actionType: "action" }
        }
      }
    ];

    // Create techniques for R'aan Fames
    for (const tech of techniques) {
      await this.createTechnique({
        characterId: raanFames.id,
        ...tech
      });
    }
  }

  // Characters
  async getCharacter(id: string): Promise<Character | undefined> {
    return this.characters.get(id);
  }

  async createCharacter(character: InsertCharacter): Promise<Character> {
    const id = randomUUID();
    const newCharacter: Character = { 
      ...character, 
      id,
      level: character.level ?? 3,
      portraitUrl: character.portraitUrl ?? null
    };
    this.characters.set(id, newCharacter);
    return newCharacter;
  }

  // Helper method to create character with specific ID (for data restoration)
  private async createCharacterWithId(id: string, character: InsertCharacter): Promise<Character> {
    const newCharacter: Character = { 
      ...character, 
      id,
      level: character.level ?? 3,
      portraitUrl: character.portraitUrl ?? null
    };
    this.characters.set(id, newCharacter);
    return newCharacter;
  }

  async updateCharacter(id: string, character: Partial<Character>): Promise<Character | undefined> {
    const existing = this.characters.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...character };
    this.characters.set(id, updated);
    return updated;
  }

  // Spirit Die Pools
  async getSpiritDiePool(characterId: string): Promise<SpiritDiePool | undefined> {
    return Array.from(this.spiritDiePools.values()).find(pool => pool.characterId === characterId);
  }

  async createSpiritDiePool(pool: InsertSpiritDiePool): Promise<SpiritDiePool> {
    const id = randomUUID();
    const newPool: SpiritDiePool = { 
      ...pool, 
      id,
      overrideDice: pool.overrideDice ?? null 
    };
    this.spiritDiePools.set(id, newPool);
    return newPool;
  }

  async updateSpiritDiePool(characterId: string, pool: Partial<SpiritDiePool>): Promise<SpiritDiePool | undefined> {
    const existing = Array.from(this.spiritDiePools.values()).find(p => p.characterId === characterId);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...pool };
    this.spiritDiePools.set(existing.id, updated);
    return updated;
  }

  async deleteSpiritDiePool(characterId: string): Promise<boolean> {
    const existing = Array.from(this.spiritDiePools.values()).find(p => p.characterId === characterId);
    if (!existing) return false;
    
    return this.spiritDiePools.delete(existing.id);
  }

  // Techniques
  async getTechniques(characterId: string): Promise<Technique[]> {
    return Array.from(this.techniques.values()).filter(tech => tech.characterId === characterId && tech.isActive);
  }

  async getTechnique(id: string): Promise<Technique | undefined> {
    return this.techniques.get(id);
  }

  async createTechnique(technique: InsertTechnique): Promise<Technique> {
    const id = randomUUID();
    const newTechnique: Technique = { 
      ...technique, 
      id,
      isActive: technique.isActive ?? true 
    };
    this.techniques.set(id, newTechnique);
    return newTechnique;
  }

  async updateTechnique(id: string, technique: Partial<Technique>): Promise<Technique | undefined> {
    const existing = this.techniques.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...technique };
    this.techniques.set(id, updated);
    return updated;
  }

  async deleteTechnique(id: string): Promise<boolean> {
    const existing = this.techniques.get(id);
    if (!existing) return false;
    
    // Soft delete by marking as inactive
    const updated = { ...existing, isActive: false };
    this.techniques.set(id, updated);
    return true;
  }

  // Active Effects
  async getActiveEffects(characterId: string): Promise<ActiveEffect[]> {
    return Array.from(this.activeEffects.values()).filter(effect => effect.characterId === characterId);
  }

  async createActiveEffect(effect: InsertActiveEffect): Promise<ActiveEffect> {
    const id = randomUUID();
    const newEffect: ActiveEffect = { 
      ...effect, 
      id,
      level: effect.level ?? 1,
      description: effect.description ?? null
    };
    this.activeEffects.set(id, newEffect);
    return newEffect;
  }

  async updateActiveEffect(id: string, effect: Partial<ActiveEffect>): Promise<ActiveEffect | undefined> {
    const existing = this.activeEffects.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...effect };
    this.activeEffects.set(id, updated);
    return updated;
  }

  async deleteActiveEffect(id: string): Promise<boolean> {
    return this.activeEffects.delete(id);
  }

  // Glossary Terms
  async getGlossaryTerms(characterId: string): Promise<GlossaryTerm[]> {
    return Array.from(this.glossaryTerms.values()).filter(term => term.characterId === characterId);
  }

  async createGlossaryTerm(term: InsertGlossaryTerm): Promise<GlossaryTerm> {
    const id = randomUUID();
    const newTerm: GlossaryTerm = { 
      ...term, 
      id,
      expandedContent: term.expandedContent ?? null,
      hasExpandedContent: term.hasExpandedContent ?? false
    };
    this.glossaryTerms.set(id, newTerm);
    return newTerm;
  }

  async updateGlossaryTerm(id: string, term: Partial<GlossaryTerm>): Promise<GlossaryTerm | undefined> {
    const existing = this.glossaryTerms.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...term };
    this.glossaryTerms.set(id, updated);
    return updated;
  }

  async deleteGlossaryTerm(id: string): Promise<boolean> {
    return this.glossaryTerms.delete(id);
  }
}

export class DatabaseStorage implements IStorage {
  // Characters
  async getCharacter(id: string): Promise<Character | undefined> {
    const [character] = await db.select().from(characters).where(eq(characters.id, id));
    return character || undefined;
  }

  async createCharacter(character: InsertCharacter): Promise<Character> {
    const [newCharacter] = await db
      .insert(characters)
      .values(character)
      .returning();
    return newCharacter;
  }

  async updateCharacter(id: string, character: Partial<Character>): Promise<Character | undefined> {
    const [updated] = await db
      .update(characters)
      .set(character)
      .where(eq(characters.id, id))
      .returning();
    return updated || undefined;
  }

  // Spirit Die Pools
  async getSpiritDiePool(characterId: string): Promise<SpiritDiePool | undefined> {
    const [pool] = await db.select().from(spiritDiePools).where(eq(spiritDiePools.characterId, characterId));
    return pool || undefined;
  }

  async createSpiritDiePool(pool: InsertSpiritDiePool): Promise<SpiritDiePool> {
    const [newPool] = await db
      .insert(spiritDiePools)
      .values(pool)
      .returning();
    return newPool;
  }

  async updateSpiritDiePool(characterId: string, pool: Partial<SpiritDiePool>): Promise<SpiritDiePool | undefined> {
    const [updated] = await db
      .update(spiritDiePools)
      .set(pool)
      .where(eq(spiritDiePools.characterId, characterId))
      .returning();
    return updated || undefined;
  }

  async deleteSpiritDiePool(characterId: string): Promise<boolean> {
    const result = await db
      .delete(spiritDiePools)
      .where(eq(spiritDiePools.characterId, characterId));
    return (result.rowCount || 0) > 0;
  }

  // Techniques
  async getTechniques(characterId: string): Promise<Technique[]> {
    return await db.select().from(techniques).where(
      and(eq(techniques.characterId, characterId), eq(techniques.isActive, true))
    );
  }

  async getTechnique(id: string): Promise<Technique | undefined> {
    const [technique] = await db.select().from(techniques).where(eq(techniques.id, id));
    return technique || undefined;
  }

  async createTechnique(technique: InsertTechnique): Promise<Technique> {
    const [newTechnique] = await db
      .insert(techniques)
      .values(technique)
      .returning();
    return newTechnique;
  }

  async updateTechnique(id: string, technique: Partial<Technique>): Promise<Technique | undefined> {
    const [updated] = await db
      .update(techniques)
      .set(technique)
      .where(eq(techniques.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteTechnique(id: string): Promise<boolean> {
    const result = await db
      .delete(techniques)
      .where(eq(techniques.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Active Effects
  async getActiveEffects(characterId: string): Promise<ActiveEffect[]> {
    return await db.select().from(activeEffects).where(eq(activeEffects.characterId, characterId));
  }

  async createActiveEffect(effect: InsertActiveEffect): Promise<ActiveEffect> {
    const [newEffect] = await db
      .insert(activeEffects)
      .values(effect)
      .returning();
    return newEffect;
  }

  async updateActiveEffect(id: string, effect: Partial<ActiveEffect>): Promise<ActiveEffect | undefined> {
    const [updated] = await db
      .update(activeEffects)
      .set(effect)
      .where(eq(activeEffects.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteActiveEffect(id: string): Promise<boolean> {
    const result = await db.delete(activeEffects).where(eq(activeEffects.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Glossary Terms
  async getGlossaryTerms(characterId: string): Promise<GlossaryTerm[]> {
    return await db.select().from(glossaryTerms).where(eq(glossaryTerms.characterId, characterId));
  }

  async createGlossaryTerm(term: InsertGlossaryTerm): Promise<GlossaryTerm> {
    const [newTerm] = await db
      .insert(glossaryTerms)
      .values(term)
      .returning();
    return newTerm;
  }

  async updateGlossaryTerm(id: string, term: Partial<GlossaryTerm>): Promise<GlossaryTerm | undefined> {
    const [updated] = await db
      .update(glossaryTerms)
      .set(term)
      .where(eq(glossaryTerms.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteGlossaryTerm(id: string): Promise<boolean> {
    const result = await db.delete(glossaryTerms).where(eq(glossaryTerms.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Users (for authentication)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Technique Preferences
  async getTechniquePreferences(userId: string): Promise<TechniquePreference[]> {
    return await db.select().from(techniquePreferences).where(eq(techniquePreferences.userId, userId));
  }

  async upsertTechniquePreference(preference: InsertTechniquePreference): Promise<TechniquePreference> {
    // First ensure the user exists
    await this.upsertUser({ id: preference.userId });
    
    // Try to find existing preference first
    const existing = await db
      .select()
      .from(techniquePreferences)
      .where(
        and(
          eq(techniquePreferences.userId, preference.userId),
          eq(techniquePreferences.techniqueId, preference.techniqueId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing preference
      const [result] = await db
        .update(techniquePreferences)
        .set({
          isMinimized: preference.isMinimized,
          updatedAt: new Date(),
        })
        .where(eq(techniquePreferences.id, existing[0].id))
        .returning();
      return result;
    } else {
      // Create new preference
      const [result] = await db
        .insert(techniquePreferences)
        .values(preference)
        .returning();
      return result;
    }
  }

  // Trackers
  async getTrackers(characterId: string): Promise<Tracker[]> {
    return await db.select().from(trackers).where(eq(trackers.characterId, characterId));
  }

  async createTracker(tracker: InsertTracker): Promise<Tracker> {
    const [created] = await db.insert(trackers).values(tracker).returning();
    return created;
  }

  async updateTracker(id: string, tracker: Partial<Tracker>): Promise<Tracker | undefined> {
    const [updated] = await db
      .update(trackers)
      .set(tracker)
      .where(eq(trackers.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteTracker(id: string): Promise<boolean> {
    const result = await db.delete(trackers).where(eq(trackers.id, id));
    return (result.rowCount || 0) > 0;
  }
}

// Create and export storage instance (using database storage)
export const storage = new DatabaseStorage();

// Initialize database with default character data
async function initializeDatabase() {
  try {
    // Check if R'aan Fames already exists
    const existingCharacter = await db.select().from(characters).limit(1);
    
    if (existingCharacter.length === 0) {
      console.log("Initializing database with default character...");
      
      // Create R'aan Fames character
      const [character] = await db
        .insert(characters)
        .values({
          name: "R'aan Fames",
          path: "Path of Gluttony",
          level: 8
        })
        .returning();

      // Create spirit die pool
      const levelDice = SPIRIT_DIE_PROGRESSION[8] || ['d4'];
      await db
        .insert(spiritDiePools)
        .values({
          characterId: character.id,
          currentDice: levelDice,
          overrideDice: null
        });

      // Create some sample techniques
      await db
        .insert(techniques)
        .values([
          {
            characterId: character.id,
            name: "Devouring Maw",
            triggerDescription: "When you successfully hit with a melee attack",
            spEffects: {
              1: { effect: "Deal an additional 1d4 necrotic damage", actionType: "action" },
              2: { effect: "Deal an additional 1d6 necrotic damage and heal for half", actionType: "action" },
              3: { effect: "Deal an additional 1d8 necrotic damage, heal for half, and gain temporary HP", actionType: "action" }
            }
          },
          {
            characterId: character.id,
            name: "Endless Hunger",
            triggerDescription: "When you reduce a creature to 0 hit points",
            spEffects: {
              1: { effect: "Regain 1 SP", actionType: "reaction" },
              2: { effect: "Regain 2 SP and gain 5 temporary HP", actionType: "reaction" }
            }
          }
        ]);

      console.log("Database initialized successfully!");
    }
  } catch (error) {
    console.error("Failed to initialize database:", error);
  }
}

// Initialize database on startup
initializeDatabase();
