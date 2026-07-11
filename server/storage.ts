import { databaseConnection } from "./db";
import {
  DatabaseStorage,
  initializeDatabaseStorage,
} from "./storage/database-storage";
import type { IStorage } from "./storage/contract";
import { MemStorage } from "./storage/memory-storage";

export type { IStorage } from "./storage/contract";

export const storage: IStorage = databaseConnection
  ? new DatabaseStorage(databaseConnection.db)
  : new MemStorage();

let initialization: Promise<void> | undefined;

/**
 * Initializes persistent storage before the HTTP server starts accepting requests.
 * MemoryStorage is fully seeded synchronously during construction.
 */
export function initializeStorage(): Promise<void> {
  initialization ??= databaseConnection
    ? initializeDatabaseStorage(databaseConnection.db)
    : Promise.resolve();
  return initialization;
}
