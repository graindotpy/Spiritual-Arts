import { Router } from "express";
import {
  foundryMechanicsSchema,
  getSpiritDiceForLevel,
  insertSpiritDiePoolSchema,
  normalizeSpiritDieSlots,
  rollSpiritDie,
  rollSpiritDieRequestSchema,
  type Technique,
  updateSpiritDiePoolSchema,
} from "@shared/schema";
import { canSpiritDieMeetInvestment } from "@shared/spirit-dice";
import { calculateSpiritualArtsDc } from "@shared/spiritual-arts-dc";
import { richTextContentToPlainText } from "@shared/enhanced-content";
import { MAX_INVESTMENT_EFFECT_LENGTH } from "@shared/realtime";
import type { IStorage } from "../storage";
import type { SpiritRollBroadcaster } from "../websocket";
import { asyncHandler } from "../http/async-handler";
import { badRequest, notFound, parseRequest } from "../http/errors";
import { sendDiscordSpiritRoll } from "./discord";

export function createSpiritDiceRouter(
  storage: IStorage,
  broadcaster: SpiritRollBroadcaster,
  options: {
    random?: () => number;
    now?: () => Date;
  } = {},
): Router {
  const router = Router();

  router.get(
    "/api/character/:id/spirit-die-pool",
    asyncHandler("Failed to get spirit die pool", async (req, res) => {
      const pool = await storage.getSpiritDiePool(req.params.id);
      if (!pool) {
        throw notFound("Spirit die pool not found");
      }
      res.json(pool);
    }),
  );

  router.post(
    "/api/character/:id/spirit-die-pool",
    asyncHandler("Failed to create spirit die pool", async (req, res) => {
      const data = parseRequest(insertSpiritDiePoolSchema, {
        ...req.body,
        characterId: req.params.id,
      });
      res.status(201).json(await storage.createSpiritDiePool(data));
    }),
  );

  router.put(
    "/api/character/:id/spirit-die-pool",
    asyncHandler("Failed to update spirit die pool", async (req, res) => {
      const data = parseRequest(updateSpiritDiePoolSchema, req.body);
      const pool = await storage.updateSpiritDiePool(req.params.id, data);
      if (!pool) {
        throw notFound("Spirit die pool not found");
      }
      res.json(pool);
    }),
  );

  router.delete(
    "/api/character/:id/spirit-die-pool",
    asyncHandler("Failed to delete spirit die pool", async (req, res) => {
      if (!(await storage.deleteSpiritDiePool(req.params.id))) {
        throw notFound("Spirit die pool not found");
      }
      res.json({ message: "Spirit die pool deleted" });
    }),
  );

  router.post(
    "/api/character/:id/roll",
    asyncHandler("Failed to roll die", async (req, res) => {
      const { spInvestment, dieIndex, techniqueId } = parseRequest(
        rollSpiritDieRequestSchema,
        req.body,
      );

      const pool = await storage.getSpiritDiePool(req.params.id);
      if (!pool) {
        throw notFound("Spirit die pool not found");
      }

      const character = await storage.getCharacter(req.params.id);
      const maximumDice = pool.overrideDice ?? getSpiritDiceForLevel(character?.level ?? 1);
      const currentDice = normalizeSpiritDieSlots(
        pool.currentDice,
        maximumDice.length,
      );
      if (currentDice.every((die) => die === null)) {
        throw badRequest("No dice available to roll");
      }
      if (dieIndex < 0 || dieIndex >= currentDice.length) {
        throw badRequest("Invalid die index");
      }
      const selectedDie = currentDice[dieIndex];
      if (selectedDie === null) {
        throw badRequest("No dice available to roll");
      }
      if (!canSpiritDieMeetInvestment(selectedDie, spInvestment)) {
        throw badRequest(
          `${selectedDie.toUpperCase()} cannot power a ${spInvestment} SP technique`,
        );
      }

      const roll = rollSpiritDie({
        currentDice,
        dieIndex,
        spInvestment,
        random: options.random,
      });

      await storage.updateSpiritDiePool(req.params.id, {
        currentDice: roll.newDicePool,
      });

      if (character) {
        let techniqueName: string | null = null;
        let resolvedTechniqueId: string | null = null;
        let resolvedTechnique: Technique | undefined;
        let investmentEffect: string | undefined;
        if (techniqueId) {
          const technique = await storage.getTechnique(techniqueId);
          if (technique?.characterId === character.id) {
            resolvedTechnique = technique;
            resolvedTechniqueId = technique.id;
            const tier = technique.spEffects[String(spInvestment)];
            techniqueName = tier?.alternateName ?? technique.name;
            const effectText = tier
              ? richTextContentToPlainText(tier.effect).trim()
              : "";
            if (effectText) {
              investmentEffect =
                effectText.length > MAX_INVESTMENT_EFFECT_LENGTH
                  ? `${effectText
                      .slice(0, MAX_INVESTMENT_EFFECT_LENGTH - 1)
                      .trimEnd()}…`
                  : effectText;
            }
          }
        }

        const timestamp = (options.now?.() ?? new Date()).toISOString();
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
        const sourceRollEventId = broadcaster.broadcastSpiritRoll({
          character: broadcastCharacter,
          roll: {
            spInvestment,
            dieSize: roll.dieRolled,
            dieIndex,
            value: roll.value,
            success: roll.success,
            techniqueId: resolvedTechniqueId,
            techniqueName,
            ...(investmentEffect ? { investmentEffect } : {}),
            timestamp,
          },
        });

        if (resolvedTechnique) {
          const tier = resolvedTechnique.spEffects[String(spInvestment)];
          const mechanics = foundryMechanicsSchema.safeParse(tier?.mechanics);
          if (mechanics.success) {
            for (const action of mechanics.data.actions) {
              broadcaster.broadcastFoundryAction({
                requestedAt: timestamp,
                sourceRollEventId,
                character: {
                  ...broadcastCharacter,
                  ...(action.savingThrow ? { spiritualArtsDc } : {}),
                },
                technique: {
                  id: resolvedTechnique.id,
                  name: resolvedTechnique.name,
                },
                spInvestment,
                action,
              });
            }
          }
        }

        void sendDiscordSpiritRoll({
          characterName: character.name,
          techniqueName,
          spInvestment,
          dieSize: roll.dieRolled,
          value: roll.value,
          success: roll.success,
          portraitUrl: character.portraitUrl,
        });
      }

      res.json(roll);
    }),
  );

  router.post(
    "/api/character/:id/long-rest",
    asyncHandler("Failed to restore dice", async (req, res) => {
      const pool = await storage.getSpiritDiePool(req.params.id);
      if (!pool) {
        throw notFound("Spirit die pool not found");
      }

      const character = await storage.getCharacter(req.params.id);
      if (!character) {
        throw notFound("Character not found");
      }

      const baseDice = getSpiritDiceForLevel(character.level);
      const restoredDice = pool.overrideDice
        ? [...pool.overrideDice]
        : baseDice;
      res.json(
        await storage.updateSpiritDiePool(req.params.id, {
          currentDice: restoredDice,
        }),
      );
    }),
  );

  return router;
}
