import { Router } from "express";
import {
  cardGameStateRequestSchema,
  type CardGameStateData,
} from "@shared/schema";
import type { IStorage } from "../storage";
import type { ImageStore } from "../uploads/image-store";
import { asyncHandler } from "../http/async-handler";
import { parseRequest } from "../http/errors";

function timestampValue(value: Date | string | null | undefined): number {
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function incomingTimestamp(state: CardGameStateData): number {
  const value = state.updatedAt;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function imageUrls(state: CardGameStateData | undefined): Set<string> {
  const urls = new Set<string>();
  const pending: unknown[] = state ? [state] : [];
  const urlFields = new Set(["imageUrl", "artUrl", "templateUrl"]);

  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value !== "object" || value === null) continue;

    if (Array.isArray(value)) {
      pending.push(...value);
      continue;
    }

    for (const [key, child] of Object.entries(value)) {
      if (urlFields.has(key) && typeof child === "string" && child.trim()) {
        urls.add(child.trim());
      } else if (typeof child === "object" && child !== null) {
        pending.push(child);
      }
    }
  }

  return urls;
}

async function removeOrphanedImages(
  images: ImageStore,
  previousState: CardGameStateData | undefined,
  nextState: CardGameStateData,
): Promise<void> {
  const previous = imageUrls(previousState);
  const next = imageUrls(nextState);
  const removed = [...previous].filter((url) => !next.has(url));

  await Promise.all(
    removed.map(async (url) => {
      try {
        // Only card-owned objects are eligible for automatic cleanup. Legacy
        // card URLs in the shared `images` namespace are intentionally retained
        // because glossary content may reference the same object.
        await images.remove(url, "card-images");
      } catch (error) {
        console.error(`Failed to delete unused card image ${url}:`, error);
      }
    }),
  );
}

export function createCardGameRouter(storage: IStorage, images: ImageStore): Router {
  const router = Router();

  router.get(
    "/api/card-game/state",
    asyncHandler("Failed to get card game state", async (_req, res) => {
      const saved = await storage.getCardGameState();
      if (!saved) {
        res.json({ state: null, updatedAt: 0 });
        return;
      }

      res.json({
        state: saved.state,
        updatedAt: timestampValue(saved.updatedAt),
      });
    }),
  );

  router.put(
    "/api/card-game/state",
    asyncHandler("Failed to update card game state", async (req, res) => {
      const { state } = parseRequest(
        cardGameStateRequestSchema,
        req.body,
        "Invalid card game state",
      );
      const previous = await storage.getCardGameState();
      const result = await storage.upsertCardGameState(
        state,
        incomingTimestamp(state),
      );

      if (result.conflict) {
        res.status(409).json({
          success: false,
          conflict: true,
          state: result.state,
          updatedAt: result.updatedAt,
        });
        return;
      }

      await removeOrphanedImages(images, previous?.state, result.state);
      res.json({
        success: true,
        state: result.state,
        updatedAt: result.updatedAt,
      });
    }),
  );

  return router;
}
