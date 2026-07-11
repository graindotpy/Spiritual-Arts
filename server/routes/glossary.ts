import { Router } from "express";
import {
  insertGlossaryTermSchema,
  updateGlossaryTermSchema,
} from "@shared/schema";
import type { IStorage } from "../storage";
import { asyncHandler } from "../http/async-handler";
import { notFound, parseRequest } from "../http/errors";

export function createGlossaryRouter(storage: IStorage): Router {
  const router = Router();

  router.get(
    "/api/character/:id/glossary",
    asyncHandler("Failed to get glossary terms", async (req, res) => {
      res.json(await storage.getGlossaryTerms(req.params.id));
    }),
  );

  router.post(
    "/api/character/:id/glossary",
    asyncHandler("Failed to create glossary term", async (req, res) => {
      const data = parseRequest(insertGlossaryTermSchema, {
        ...req.body,
        characterId: req.params.id,
      });
      res.status(201).json(await storage.createGlossaryTerm(data));
    }),
  );

  router.put(
    "/api/glossary/:id",
    asyncHandler("Failed to update glossary term", async (req, res) => {
      const data = parseRequest(updateGlossaryTermSchema, req.body);
      const term = await storage.updateGlossaryTerm(req.params.id, data);
      if (!term) {
        throw notFound("Glossary term not found");
      }
      res.json(term);
    }),
  );

  router.delete(
    "/api/glossary/:id",
    asyncHandler("Failed to delete glossary term", async (req, res) => {
      if (!(await storage.deleteGlossaryTerm(req.params.id))) {
        throw notFound("Glossary term not found");
      }
      res.json({ success: true });
    }),
  );

  return router;
}
