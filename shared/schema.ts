import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { enhancedContentJsonSchema } from "./enhanced-content";
import {
  dieSizeSchema,
  spiritDieSlotsSchema,
  type DieSize,
  type SpiritDieSlot,
} from "./spirit-dice";

export {
  DIE_SIZES,
  MAX_CHARACTER_LEVEL,
  MIN_CHARACTER_LEVEL,
  SPIRIT_DIE_PROGRESSION,
  dieSizeSchema,
  getSpiritDiceForLevel,
  isDieSize,
  normalizeSpiritDieSlots,
  reduceDie,
  restoreDie,
  restoreSpiritDieSlot,
  rollSpiritDie,
  spiritDieSlotSchema,
  spiritDieSlotsSchema,
} from "./spirit-dice";
export type { DieSize, SpiritDieSlot, SpiritDieRoll } from "./spirit-dice";

export const characterLevelSchema = z.number().int().min(1).max(20);
export const nonEmptyTextSchema = z.string().trim().min(1).max(10_000);
export const shortTextSchema = z.string().trim().min(1).max(255);

export const triggerTypeSchema = z.enum(["action", "bonus", "reaction", "passive"]);
export type TriggerType = z.infer<typeof triggerTypeSchema>;

export const spEffectValueSchema = z.object({
  effect: nonEmptyTextSchema,
  actionType: triggerTypeSchema,
  alternateName: z.string().trim().max(255).optional(),
});

export const spEffectsSchema = z
  .record(z.string().regex(/^\d+$/), spEffectValueSchema)
  .refine((effects) => Object.keys(effects).length > 0, "At least one SP effect is required");

export type SPEffectValue = z.infer<typeof spEffectValueSchema>;
export type SPEffect = Record<string, SPEffectValue>;

export const characters = pgTable("characters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  path: text("path").notNull(),
  level: integer("level").notNull().default(3),
  portraitUrl: text("portrait_url"),
});

export const spiritDiePools = pgTable(
  "spirit_die_pools",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    characterId: varchar("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    currentDice: jsonb("current_dice").$type<SpiritDieSlot[]>().notNull(),
    overrideDice: jsonb("override_dice").$type<DieSize[] | null>(),
  },
  (table) => [unique("spirit_die_pool_character_unique").on(table.characterId)],
);

export const techniques = pgTable(
  "techniques",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    characterId: varchar("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    triggerDescription: text("trigger_description").notNull(),
    spEffects: jsonb("sp_effects").$type<SPEffect>().notNull(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [index("techniques_character_idx").on(table.characterId)],
);

export const glossaryTerms = pgTable(
  "glossary_terms",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    characterId: varchar("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    definition: text("definition").notNull(),
    expandedContent: text("expanded_content"),
    hasExpandedContent: boolean("has_expanded_content").default(false).notNull(),
  },
  (table) => [index("glossary_terms_character_idx").on(table.characterId)],
);

export const activeEffects = pgTable(
  "active_effects",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    characterId: varchar("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    level: integer("level").notNull().default(1),
    description: text("description"),
  },
  (table) => [index("active_effects_character_idx").on(table.characterId)],
);

export const insertCharacterSchema = createInsertSchema(characters, {
  name: shortTextSchema,
  path: shortTextSchema,
  level: characterLevelSchema,
  portraitUrl: z.string().max(2_048).nullable().optional(),
}).omit({ id: true });

export const createCharacterSchema = insertCharacterSchema
  .omit({ portraitUrl: true })
  .extend({ level: characterLevelSchema.default(1) })
  .strict();
export const updateCharacterSchema = createCharacterSchema
  .partial()
  .strict()
  .refine((update) => Object.keys(update).length > 0, "At least one field is required");

export const insertSpiritDiePoolSchema = createInsertSchema(spiritDiePools, {
  currentDice: spiritDieSlotsSchema,
  overrideDice: z.array(dieSizeSchema).max(20).nullable().optional(),
}).omit({ id: true });

export const updateSpiritDiePoolSchema = insertSpiritDiePoolSchema
  .omit({ characterId: true })
  .partial()
  .strict()
  .refine((update) => Object.keys(update).length > 0, "At least one field is required");

export const insertTechniqueSchema = createInsertSchema(techniques, {
  name: shortTextSchema,
  triggerDescription: nonEmptyTextSchema,
  spEffects: spEffectsSchema,
}).omit({ id: true });

export const updateTechniqueSchema = insertTechniqueSchema
  .omit({ characterId: true })
  .partial()
  .strict()
  .refine((update) => Object.keys(update).length > 0, "At least one field is required");

export const insertActiveEffectSchema = createInsertSchema(activeEffects, {
  name: shortTextSchema,
  description: z.string().max(10_000).nullable().optional(),
  level: z.number().int().min(0).max(100).optional(),
}).omit({ id: true });

export const updateActiveEffectSchema = insertActiveEffectSchema
  .omit({ characterId: true })
  .partial()
  .strict()
  .refine((update) => Object.keys(update).length > 0, "At least one field is required");

export const insertGlossaryTermSchema = createInsertSchema(glossaryTerms, {
  keyword: shortTextSchema,
  definition: nonEmptyTextSchema,
  expandedContent: enhancedContentJsonSchema.nullable().optional(),
}).omit({ id: true });

export const updateGlossaryTermSchema = insertGlossaryTermSchema
  .omit({ characterId: true })
  .partial()
  .strict()
  .refine((update) => Object.keys(update).length > 0, "At least one field is required");

export type Character = typeof characters.$inferSelect;
export type InsertCharacter = z.infer<typeof insertCharacterSchema>;
export type SpiritDiePool = typeof spiritDiePools.$inferSelect;
export type InsertSpiritDiePool = z.infer<typeof insertSpiritDiePoolSchema>;
export type Technique = typeof techniques.$inferSelect;
export type InsertTechnique = z.infer<typeof insertTechniqueSchema>;
export type ActiveEffect = typeof activeEffects.$inferSelect;
export type InsertActiveEffect = z.infer<typeof insertActiveEffectSchema>;
export type GlossaryTerm = typeof glossaryTerms.$inferSelect;
export type InsertGlossaryTerm = z.infer<typeof insertGlossaryTermSchema>;

export interface RollResult {
  value: number;
  success: boolean;
  dieRolled: DieSize;
  newDicePool: SpiritDieSlot[];
}

export const rollSpiritDieRequestSchema = z
  .object({
    spInvestment: z.number().int().positive().max(100),
    dieIndex: z.number().int().nonnegative().default(0),
  })
  .strict();

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const techniquePreferences = pgTable(
  "technique_preferences",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    techniqueId: varchar("technique_id")
      .notNull()
      .references(() => techniques.id, { onDelete: "cascade" }),
    isMinimized: boolean("is_minimized").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [unique("user_technique_unique").on(table.userId, table.techniqueId)],
);

export const techniquePreferencesRelations = relations(techniquePreferences, ({ one }) => ({
  user: one(users, {
    fields: [techniquePreferences.userId],
    references: [users.id],
  }),
  technique: one(techniques, {
    fields: [techniquePreferences.techniqueId],
    references: [techniques.id],
  }),
}));

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type TechniquePreference = typeof techniquePreferences.$inferSelect;
export type InsertTechniquePreference = typeof techniquePreferences.$inferInsert;

export const techniquePreferenceRequestSchema = z
  .object({
    userId: shortTextSchema,
    techniqueId: z.string().uuid(),
    isMinimized: z.boolean(),
  })
  .strict();

export const trackers = pgTable(
  "trackers",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    characterId: varchar("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    name: varchar("name").notNull(),
    currentValue: integer("current_value").notNull().default(0),
    target: varchar("target"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("trackers_character_idx").on(table.characterId)],
);

export const insertTrackerSchema = createInsertSchema(trackers, {
  name: shortTextSchema,
  currentValue: z.number().int().optional(),
  target: z.string().trim().max(255).nullable().optional(),
}).omit({ id: true, createdAt: true });

export const updateTrackerSchema = insertTrackerSchema
  .omit({ characterId: true })
  .partial()
  .strict()
  .refine((update) => Object.keys(update).length > 0, "At least one field is required");

export type InsertTracker = typeof trackers.$inferInsert;
export type Tracker = typeof trackers.$inferSelect;

export const dmStacks = pgTable(
  "dm_stacks",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    name: varchar("name").notNull().default("Unnamed Stack"),
    target: text("target").notNull(),
    effect: text("effect").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("dm_stacks_user_idx").on(table.userId)],
);

export const dmGlossary = pgTable(
  "dm_glossary",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    keyword: text("keyword").notNull(),
    definition: text("definition").notNull(),
    expandedContent: text("expanded_content"),
    hasExpandedContent: boolean("has_expanded_content").default(false).notNull(),
  },
  (table) => [index("dm_glossary_user_idx").on(table.userId)],
);

export const dmScratchpads = pgTable(
  "dm_scratchpads",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    title: varchar("title").notNull().default("Scratchpad"),
    content: text("content").notNull().default(""),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("dm_scratchpads_user_idx").on(table.userId)],
);

export const insertDmStackSchema = createInsertSchema(dmStacks, {
  name: shortTextSchema,
  target: nonEmptyTextSchema,
  effect: nonEmptyTextSchema,
})
  .omit({ id: true, createdAt: true, userId: true })
  .strict();

export const updateDmStackSchema = insertDmStackSchema
  .partial()
  .strict()
  .refine((update) => Object.keys(update).length > 0, "At least one field is required");

export const insertDmGlossarySchema = createInsertSchema(dmGlossary, {
  keyword: shortTextSchema,
  definition: nonEmptyTextSchema,
  expandedContent: enhancedContentJsonSchema.nullable().optional(),
})
  .omit({ id: true, userId: true })
  .strict();

export const updateDmGlossarySchema = insertDmGlossarySchema
  .partial()
  .strict()
  .refine((update) => Object.keys(update).length > 0, "At least one field is required");

export const insertDmScratchpadSchema = createInsertSchema(dmScratchpads, {
  title: z.string().trim().min(1).max(255).optional(),
  content: z.string().max(1_000_000),
})
  .omit({ id: true, createdAt: true, userId: true })
  .strict();

export const updateDmScratchpadSchema = insertDmScratchpadSchema
  .partial()
  .strict()
  .refine((update) => Object.keys(update).length > 0, "At least one field is required");

export type DmStack = typeof dmStacks.$inferSelect;
export type InsertDmStack = z.infer<typeof insertDmStackSchema>;
export type DmGlossaryTerm = typeof dmGlossary.$inferSelect;
export type InsertDmGlossaryTerm = z.infer<typeof insertDmGlossarySchema>;
export type DmScratchpad = typeof dmScratchpads.$inferSelect;
export type InsertDmScratchpad = z.infer<typeof insertDmScratchpadSchema>;
