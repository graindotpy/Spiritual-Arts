import { Router } from "express";
import {
  insertActiveEffectSchema,
  insertTechniqueSchema,
  updateTechniqueSchema,
} from "@shared/schema";
import type { IStorage } from "../storage";
import { asyncHandler } from "../http/async-handler";
import { notFound, parseRequest } from "../http/errors";

export function createTechniqueRouter(storage: IStorage): Router {
  const router = Router();

  router.get(
    "/api/character/:id/techniques",
    asyncHandler("Failed to get techniques", async (req, res) => {
      res.json(await storage.getTechniques(req.params.id));
    }),
  );

  router.post(
    "/api/character/:id/techniques",
    asyncHandler("Failed to create technique", async (req, res) => {
      const data = parseRequest(insertTechniqueSchema, {
        ...req.body,
        characterId: req.params.id,
      });
      res.status(201).json(await storage.createTechnique(data));
    }),
  );

  router.put(
    "/api/techniques/:id",
    asyncHandler("Failed to update technique", async (req, res) => {
      const data = parseRequest(updateTechniqueSchema, req.body);
      const technique = await storage.updateTechnique(req.params.id, data);
      if (!technique) {
        throw notFound("Technique not found");
      }
      res.json(technique);
    }),
  );

  router.delete(
    "/api/techniques/:id",
    asyncHandler("Failed to delete technique", async (req, res) => {
      if (!(await storage.deleteTechnique(req.params.id))) {
        throw notFound("Technique not found");
      }
      res.json({ success: true });
    }),
  );

  router.get(
    "/api/character/:id/active-effects",
    asyncHandler("Failed to get active effects", async (req, res) => {
      res.json(await storage.getActiveEffects(req.params.id));
    }),
  );

  router.post(
    "/api/character/:id/active-effects",
    asyncHandler("Failed to create active effect", async (req, res) => {
      const data = parseRequest(insertActiveEffectSchema, {
        ...req.body,
        characterId: req.params.id,
      });
      res.status(201).json(await storage.createActiveEffect(data));
    }),
  );

  router.delete(
    "/api/active-effects/:id",
    asyncHandler("Failed to delete active effect", async (req, res) => {
      if (!(await storage.deleteActiveEffect(req.params.id))) {
        throw notFound("Active effect not found");
      }
      res.json({ success: true });
    }),
  );

  return router;
}
