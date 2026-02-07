import { pgTable, varchar, text, boolean, index, jsonb, timestamp, foreignKey, unique, integer } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const glossaryTerms = pgTable("glossary_terms", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	characterId: varchar("character_id").notNull(),
	keyword: text().notNull(),
	definition: text().notNull(),
	expandedContent: text("expanded_content"),
	hasExpandedContent: boolean("has_expanded_content").default(false).notNull(),
});

export const sessions = pgTable("sessions", {
	sid: varchar().primaryKey().notNull(),
	sess: jsonb().notNull(),
	expire: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	index("IDX_session_expire").using("btree", table.expire.asc().nullsLast().op("timestamp_ops")),
]);

export const spiritDiePools = pgTable("spirit_die_pools", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	characterId: varchar("character_id").notNull(),
	currentDice: jsonb("current_dice").notNull(),
	overrideDice: jsonb("override_dice"),
});

export const techniques = pgTable("techniques", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	characterId: varchar("character_id").notNull(),
	name: text().notNull(),
	triggerDescription: text("trigger_description").notNull(),
	spEffects: jsonb("sp_effects").notNull(),
	isActive: boolean("is_active").default(true).notNull(),
});

export const techniquePreferences = pgTable("technique_preferences", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	techniqueId: varchar("technique_id").notNull(),
	isMinimized: boolean("is_minimized").default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.techniqueId],
			foreignColumns: [techniques.id],
			name: "technique_preferences_technique_id_techniques_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "technique_preferences_user_id_users_id_fk"
		}).onDelete("cascade"),
	unique("user_technique_unique").on(table.userId, table.techniqueId),
]);

export const users = pgTable("users", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	email: varchar(),
	firstName: varchar("first_name"),
	lastName: varchar("last_name"),
	profileImageUrl: varchar("profile_image_url"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

export const trackers = pgTable("trackers", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	characterId: varchar("character_id").notNull(),
	name: varchar().notNull(),
	currentValue: integer("current_value").default(0),
	target: varchar(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.characterId],
			foreignColumns: [characters.id],
			name: "trackers_character_id_characters_id_fk"
		}).onDelete("cascade"),
]);

export const activeEffects = pgTable("active_effects", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	characterId: varchar("character_id").notNull(),
	name: text().notNull(),
	level: integer().default(1),
	description: text(),
});

export const dmGlossary = pgTable("dm_glossary", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	keyword: text().notNull(),
	definition: text().notNull(),
	expandedContent: text("expanded_content"),
	hasExpandedContent: boolean("has_expanded_content").default(false).notNull(),
});

export const dmScratchpads = pgTable("dm_scratchpads", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	content: text().default(').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	title: varchar().default('Scratchpad').notNull(),
});

export const dmStacks = pgTable("dm_stacks", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	target: text().notNull(),
	effect: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	name: varchar().default('Unnamed Stack').notNull(),
});

export const characters = pgTable("characters", {
	id: varchar().default(gen_random_uuid()).primaryKey().notNull(),
	name: text().notNull(),
	path: text().notNull(),
	level: integer().default(3).notNull(),
	portraitUrl: text("portrait_url"),
});
