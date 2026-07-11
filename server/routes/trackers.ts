import { Router } from "express";
import { insertTrackerSchema, updateTrackerSchema } from "@shared/schema";
import type { IStorage } from "../storage";
import { asyncHandler } from "../http/async-handler";
import { notFound, parseRequest } from "../http/errors";

export function createTrackerRouter(storage: IStorage): Router {
  const router = Router();

  router.get(
    "/api/character/:id/trackers",
    asyncHandler("Failed to get trackers", async (req, res) => {
      res.json(await storage.getTrackers(req.params.id));
    }),
  );

  router.post(
    "/api/character/:id/trackers",
    asyncHandler("Failed to create tracker", async (req, res) => {
      const body: Record<string, unknown> =
        typeof req.body === "object" && req.body !== null ? req.body : {};
      const data = parseRequest(insertTrackerSchema, {
        ...body,
        characterId: req.params.id,
        currentValue: 0,
        target:
          typeof body.target === "string"
            ? body.target.trim() || null
            : (body.target ?? null),
      });
      res.status(201).json(await storage.createTracker(data));
    }),
  );

  router.put(
    "/api/trackers/:id",
    asyncHandler("Failed to update tracker", async (req, res) => {
      const data = parseRequest(updateTrackerSchema, req.body);
      const tracker = await storage.updateTracker(req.params.id, data);
      if (!tracker) {
        throw notFound("Tracker not found");
      }
      res.json(tracker);
    }),
  );

  router.delete(
    "/api/trackers/:id",
    asyncHandler("Failed to delete tracker", async (req, res) => {
      if (!(await storage.deleteTracker(req.params.id))) {
        throw notFound("Tracker not found");
      }
      res.json({ success: true });
    }),
  );

  return router;
}
