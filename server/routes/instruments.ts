import { Router } from "express";
import {
  insertSpiritualInstrumentSchema,
  instrumentAssignmentsSchema,
  updateSpiritualInstrumentSchema,
} from "@shared/schema";
import type { IStorage } from "../storage";
import { asyncHandler } from "../http/async-handler";
import { notFound, parseRequest } from "../http/errors";

export function createInstrumentRouter(storage: IStorage): Router {
  const router = Router();

  router.get(
    "/api/instruments",
    asyncHandler("Failed to get instruments", async (req, res) => {
      res.json(await storage.getSpiritualInstruments(req.query.includeHidden === "true"));
    }),
  );

  router.post(
    "/api/instruments",
    asyncHandler("Failed to create instrument", async (req, res) => {
      const data = parseRequest(insertSpiritualInstrumentSchema, req.body);
      res.status(201).json(await storage.createSpiritualInstrument(data));
    }),
  );

  router.put(
    "/api/instruments/:id",
    asyncHandler("Failed to update instrument", async (req, res) => {
      const data = parseRequest(updateSpiritualInstrumentSchema, req.body);
      const instrument = await storage.updateSpiritualInstrument(req.params.id, data);
      if (!instrument) throw notFound("Instrument not found");
      res.json(instrument);
    }),
  );

  router.put(
    "/api/instruments/:id/assignments",
    asyncHandler("Failed to assign instrument", async (req, res) => {
      const { characterIds } = parseRequest(instrumentAssignmentsSchema, req.body);
      const instrument = await storage.setSpiritualInstrumentAssignments(
        req.params.id,
        characterIds,
      );
      if (!instrument) throw notFound("Instrument not found");
      res.json(instrument);
    }),
  );

  router.delete(
    "/api/instruments/:id",
    asyncHandler("Failed to delete instrument", async (req, res) => {
      if (!(await storage.deleteSpiritualInstrument(req.params.id))) {
        throw notFound("Instrument not found");
      }
      res.json({ success: true });
    }),
  );

  return router;
}
