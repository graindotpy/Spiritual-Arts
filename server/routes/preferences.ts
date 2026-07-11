import { Router } from "express";
import { techniquePreferenceRequestSchema } from "@shared/schema";
import type { IStorage } from "../storage";
import { asyncHandler } from "../http/async-handler";
import { parseRequest } from "../http/errors";

export function createPreferenceRouter(storage: IStorage): Router {
  const router = Router();

  router.get(
    "/api/technique-preferences/:userId",
    asyncHandler("Failed to get technique preferences", async (req, res) => {
      res.json(await storage.getTechniquePreferences(req.params.userId));
    }),
  );

  router.post(
    "/api/technique-preferences",
    asyncHandler("Failed to update technique preference", async (req, res) => {
      const preference = parseRequest(
        techniquePreferenceRequestSchema,
        req.body,
        "Invalid preference data",
      );
      res.json(await storage.upsertTechniquePreference(preference));
    }),
  );

  return router;
}
