import { Router } from "express";
import {
  createDmCharacterSchema,
  insertDmGlossarySchema,
  insertDmScratchpadSchema,
  insertDmStackSchema,
  updateDmGlossarySchema,
  updateDmScratchpadSchema,
  updateDmStackSchema,
} from "@shared/schema";
import type { IStorage } from "../storage";
import { asyncHandler } from "../http/async-handler";
import { notFound, parseRequest } from "../http/errors";

export function createDmRouter(storage: IStorage): Router {
  const router = Router();

  router.get(
    "/api/dm/:userId/characters",
    asyncHandler("Failed to get DM characters", async (req, res) => {
      res.json(await storage.getDmCharacters(req.params.userId));
    }),
  );

  router.post(
    "/api/dm/:userId/characters",
    asyncHandler("Failed to create DM character", async (req, res) => {
      const character = parseRequest(
        createDmCharacterSchema,
        req.body,
        "Invalid character data",
      );
      res.status(201).json(
        await storage.createDmCharacterWithSpiritDice(
          req.params.userId,
          character,
        ),
      );
    }),
  );

  router.get(
    "/api/dm/:userId/stacks",
    asyncHandler("Failed to get DM stacks", async (req, res) => {
      res.json(await storage.getDmStacks(req.params.userId));
    }),
  );

  router.post(
    "/api/dm/:userId/stacks",
    asyncHandler("Failed to create DM stack", async (req, res) => {
      const data = parseRequest(insertDmStackSchema, req.body, "Invalid stack data");
      res.status(201).json(
        await storage.createDmStack({ ...data, userId: req.params.userId }),
      );
    }),
  );

  router.put(
    "/api/dm/stacks/:id",
    asyncHandler("Failed to update DM stack", async (req, res) => {
      const data = parseRequest(updateDmStackSchema, req.body, "Invalid stack data");
      const stack = await storage.updateDmStack(req.params.id, data);
      if (!stack) {
        throw notFound("Stack not found");
      }
      res.json(stack);
    }),
  );

  router.delete(
    "/api/dm/stacks/:id",
    asyncHandler("Failed to delete DM stack", async (req, res) => {
      if (!(await storage.deleteDmStack(req.params.id))) {
        throw notFound("Stack not found");
      }
      res.json({ success: true });
    }),
  );

  router.get(
    "/api/dm/:userId/glossary",
    asyncHandler("Failed to get DM glossary", async (req, res) => {
      res.json(await storage.getDmGlossary(req.params.userId));
    }),
  );

  router.post(
    "/api/dm/:userId/glossary",
    asyncHandler("Failed to create DM glossary term", async (req, res) => {
      const data = parseRequest(
        insertDmGlossarySchema,
        req.body,
        "Invalid glossary term data",
      );
      res.status(201).json(
        await storage.createDmGlossaryTerm({
          ...data,
          userId: req.params.userId,
        }),
      );
    }),
  );

  router.put(
    "/api/dm/glossary/:id",
    asyncHandler("Failed to update DM glossary term", async (req, res) => {
      const data = parseRequest(
        updateDmGlossarySchema,
        req.body,
        "Invalid glossary term data",
      );
      const term = await storage.updateDmGlossaryTerm(req.params.id, data);
      if (!term) {
        throw notFound("Glossary term not found");
      }
      res.json(term);
    }),
  );

  router.delete(
    "/api/dm/glossary/:id",
    asyncHandler("Failed to delete DM glossary term", async (req, res) => {
      if (!(await storage.deleteDmGlossaryTerm(req.params.id))) {
        throw notFound("Glossary term not found");
      }
      res.json({ success: true });
    }),
  );

  router.get(
    "/api/dm/:userId/scratchpads",
    asyncHandler("Failed to get DM scratchpads", async (req, res) => {
      res.json(await storage.getDmScratchpads(req.params.userId));
    }),
  );

  router.post(
    "/api/dm/:userId/scratchpads",
    asyncHandler("Failed to create DM scratchpad", async (req, res) => {
      const data = parseRequest(
        insertDmScratchpadSchema,
        req.body,
        "Invalid scratchpad data",
      );
      res.status(201).json(
        await storage.createDmScratchpad({
          ...data,
          userId: req.params.userId,
        }),
      );
    }),
  );

  router.put(
    "/api/dm/scratchpads/:id",
    asyncHandler("Failed to update DM scratchpad", async (req, res) => {
      const data = parseRequest(
        updateDmScratchpadSchema,
        req.body,
        "Invalid scratchpad data",
      );
      const scratchpad = await storage.updateDmScratchpad(req.params.id, data);
      if (!scratchpad) {
        throw notFound("Scratchpad not found");
      }
      res.json(scratchpad);
    }),
  );

  router.delete(
    "/api/dm/scratchpads/:id",
    asyncHandler("Failed to delete DM scratchpad", async (req, res) => {
      if (!(await storage.deleteDmScratchpad(req.params.id))) {
        throw notFound("Scratchpad not found");
      }
      res.json({ success: true });
    }),
  );

  return router;
}
