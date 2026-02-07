import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, boolean, timestamp, index, unique } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const characters = pgTable("characters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  path: text("path").notNull(),
  level: integer("level").notNull().default(3),
  portraitUrl: text("portrait_url"),
  isDmOnly: boolean("is_dm_only").notNull().default(false),
  dmOwnerId: varchar("dm_owner_id"),
});

export const spiritDiePools = pgTable("spirit_die_pools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: varchar("character_id").notNull(),
  currentDice: jsonb("current_dice").notNull(), // Array of current die sizes
  overrideDice: jsonb("override_dice"), // Manual override for dice pool
});

export const techniques = pgTable("techniques", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: varchar("character_id").notNull(),
  name: text("name").notNull(),
  triggerDescription: text("trigger_description").notNull(),
  spEffects: jsonb("sp_effects").notNull(), // Object mapping SP amounts to { effect, actionType }
  isActive: boolean("is_active").notNull().default(true),
});

export const glossaryTerms = pgTable("glossary_terms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: varchar("character_id").notNull(),
  keyword: text("keyword").notNull(),
  definition: text("definition").notNull(),
  expandedContent: text("expanded_content"), // Rich content for expanded view
  hasExpandedContent: boolean("has_expanded_content").default(false).notNull(),
});

export const activeEffects = pgTable("active_effects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: varchar("character_id").notNull(),
  name: text("name").notNull(),
  level: integer("level").default(1),
  description: text("description"),
});

// Insert schemas
export const insertCharacterSchema = createInsertSchema(characters).omit({
  id: true,
});

export const insertSpiritDiePoolSchema = createInsertSchema(spiritDiePools).omit({
  id: true,
});

export const insertTechniqueSchema = createInsertSchema(techniques).omit({
  id: true,
});

export const insertActiveEffectSchema = createInsertSchema(activeEffects).omit({
  id: true,
});

export const insertGlossaryTermSchema = createInsertSchema(glossaryTerms).omit({
  id: true,
});

// Types
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

// Additional types for frontend
export type DieSize = 'd4' | 'd6' | 'd8' | 'd10' | 'd12';
export type TriggerType = 'action' | 'bonus' | 'reaction' | 'passive';

export interface SPEffect {
  [spAmount: number]: {
    effect: string;
    actionType: TriggerType;
    alternateName?: string;
  };
}

export interface RollResult {
  value: number;
  success: boolean;
  newDicePool: DieSize[];
}

// Spirit die progression by level
export const SPIRIT_DIE_PROGRESSION: Record<number, DieSize[]> = {
  1: ['d4'],
  2: ['d4'],
  3: ['d4', 'd4'],
  4: ['d4', 'd4'],
  5: ['d4', 'd4'],
  6: ['d4', 'd6'],
  7: ['d4', 'd6'],
  8: ['d6', 'd6'],
  9: ['d6', 'd6'],
  10: ['d6', 'd8'],
  11: ['d6', 'd8'],
  12: ['d8', 'd8'],
  13: ['d8', 'd8'],
  14: ['d8', 'd10'],
  15: ['d8', 'd10'],
  16: ['d10', 'd10'],
  17: ['d10', 'd10'],
  18: ['d10', 'd12'],
  19: ['d10', 'd12'],
  20: ['d12', 'd12']
};

// Session storage table for authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User preferences for technique UI state
export const techniquePreferences = pgTable("technique_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  techniqueId: varchar("technique_id").notNull().references(() => techniques.id, { onDelete: "cascade" }),
  isMinimized: boolean("is_minimized").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userTechniqueUnique: unique("user_technique_unique").on(table.userId, table.techniqueId)
}));

// Relations
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

// Trackers table
export const trackers = pgTable("trackers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  characterId: varchar("character_id").notNull().references(() => characters.id, { onDelete: "cascade" }),
  name: varchar("name").notNull(),
  currentValue: integer("current_value").default(0),
  target: varchar("target"), // optional freetext target description
  createdAt: timestamp("created_at").defaultNow(),
});

export type InsertTracker = typeof trackers.$inferInsert;
export type Tracker = typeof trackers.$inferSelect;

// DM Space tables
export const dmStacks = pgTable("dm_stacks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: varchar("name").notNull().default("Unnamed Stack"),
  target: text("target").notNull(),
  effect: text("effect").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const dmGlossary = pgTable("dm_glossary", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  keyword: text("keyword").notNull(),
  definition: text("definition").notNull(),
  expandedContent: text("expanded_content"),
  hasExpandedContent: boolean("has_expanded_content").default(false).notNull(),
});

export const dmScratchpads = pgTable("dm_scratchpads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: varchar("title").notNull().default("Scratchpad"),
  content: text("content").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDmStackSchema = createInsertSchema(dmStacks).omit({
  id: true,
  createdAt: true,
  userId: true,
});

export const insertDmGlossarySchema = createInsertSchema(dmGlossary).omit({
  id: true,
  userId: true,
});

export const insertDmScratchpadSchema = createInsertSchema(dmScratchpads).omit({
  id: true,
  createdAt: true,
  userId: true,
});

export type DmStack = typeof dmStacks.$inferSelect;
export type InsertDmStack = z.infer<typeof insertDmStackSchema>;

export type DmGlossaryTerm = typeof dmGlossary.$inferSelect;
export type InsertDmGlossaryTerm = z.infer<typeof insertDmGlossarySchema>;

export type DmScratchpad = typeof dmScratchpads.$inferSelect;
export type InsertDmScratchpad = z.infer<typeof insertDmScratchpadSchema>;
