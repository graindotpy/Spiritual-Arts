import { relations } from "drizzle-orm/relations";
import { techniques, techniquePreferences, users, characters, trackers } from "./schema";

export const techniquePreferencesRelations = relations(techniquePreferences, ({one}) => ({
	technique: one(techniques, {
		fields: [techniquePreferences.techniqueId],
		references: [techniques.id]
	}),
	user: one(users, {
		fields: [techniquePreferences.userId],
		references: [users.id]
	}),
}));

export const techniquesRelations = relations(techniques, ({many}) => ({
	techniquePreferences: many(techniquePreferences),
}));

export const usersRelations = relations(users, ({many}) => ({
	techniquePreferences: many(techniquePreferences),
}));

export const trackersRelations = relations(trackers, ({one}) => ({
	character: one(characters, {
		fields: [trackers.characterId],
		references: [characters.id]
	}),
}));

export const charactersRelations = relations(characters, ({many}) => ({
	trackers: many(trackers),
}));