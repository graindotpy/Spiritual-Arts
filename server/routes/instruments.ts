import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  foundryMechanicsSchema,
  insertSpiritualInstrumentSchema,
  instrumentAssignmentsSchema,
  updateSpiritualInstrumentSchema,
} from "@shared/schema";
import {
  calculateSpiritualArtsAttackModifier,
  calculateSpiritualArtsDc,
} from "@shared/spiritual-arts-dc";
import type { IStorage } from "../storage";
import type { InstrumentActionBroadcaster } from "../websocket";
import { asyncHandler } from "../http/async-handler";
import { notFound, parseRequest } from "../http/errors";

const instrumentActionUseParamsSchema = z
  .object({
    characterId: z.string().uuid(),
    instrumentId: z.string().uuid(),
    actionId: z.string().uuid(),
  })
  .strict();
const instrumentActionUseBodySchema = z.object({}).strict();

export function createInstrumentRouter(
  storage: IStorage,
  broadcaster: InstrumentActionBroadcaster,
  options: {
    now?: () => Date;
    randomUuid?: () => string;
  } = {},
): Router {
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

  router.post(
    "/api/character/:characterId/instruments/:instrumentId/actions/:actionId/use",
    asyncHandler("Failed to use instrument action", async (req, res) => {
      const { characterId, instrumentId, actionId } = parseRequest(
        instrumentActionUseParamsSchema,
        req.params,
        "Invalid instrument action identifiers",
      );
      parseRequest(
        instrumentActionUseBodySchema,
        req.body === undefined ? {} : req.body,
        "Instrument action use accepts no client-provided data",
      );

      const character = await storage.getCharacter(characterId);
      if (!character) throw notFound("Character not found");

      const instrument = await storage.getSpiritualInstrument(instrumentId);
      if (!instrument) throw notFound("Instrument not found");
      if (!instrument.characterIds.includes(character.id)) {
        throw notFound("Instrument is not assigned to this character");
      }

      const instrumentAction = instrument.actions.find(
        (action) => action.id === actionId,
      );
      if (!instrumentAction) throw notFound("Instrument action not found");

      const invocationId = (options.randomUuid ?? randomUUID)();
      const requestedAt = (options.now?.() ?? new Date()).toISOString();
      const mechanics = foundryMechanicsSchema.safeParse(
        instrumentAction.mechanics,
      );
      let actionCount = 0;

      if (mechanics.success) {
        const broadcastCharacter = {
          id: character.id,
          name: character.name,
          path: character.path,
          level: character.level,
          portraitUrl: character.portraitUrl,
        };
        const spiritualArtsDc = calculateSpiritualArtsDc(
          character.level,
          character.highestAbilityScore,
        );
        const spiritualArtsAttackModifier =
          calculateSpiritualArtsAttackModifier(
            character.level,
            character.highestAbilityScore,
          );

        for (const action of mechanics.data.actions) {
          const eventId = broadcaster.broadcastInstrumentFoundryAction({
            requestedAt,
            sourceUseId: invocationId,
            character: {
              ...broadcastCharacter,
              ...(action.kind === "roll_attack"
                ? { spiritualArtsAttackModifier }
                : "savingThrow" in action && action.savingThrow
                  ? { spiritualArtsDc }
                  : {}),
            },
            instrument: {
              id: instrument.id,
              name: instrument.name,
            },
            instrumentAction: {
              id: instrumentAction.id,
              name: instrumentAction.name,
            },
            action,
          });
          if (eventId !== null) actionCount += 1;
        }
      }

      res.json({ invocationId, actionCount });
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
