import { Router } from "express";
import { createCharacterSchema, updateCharacterSchema } from "@shared/schema";
import type { IStorage } from "../storage";
import { asyncHandler } from "../http/async-handler";
import { badRequest, notFound, parseRequest } from "../http/errors";
import { portraitUpload, type ImageStore } from "../uploads/image-store";

type CharacterUpdate = Parameters<IStorage["updateCharacter"]>[1];

export function createCharacterRouter(
  storage: IStorage,
  images: ImageStore,
): Router {
  const router = Router();

  router.get(
    "/api/characters",
    asyncHandler("Failed to get characters", async (_req, res) => {
      res.json(await storage.getCharacters());
    }),
  );

  router.get(
    "/api/character",
    asyncHandler("Failed to get character", async (_req, res) => {
      const characters = await storage.getCharacters();
      if (characters.length === 0) {
        throw notFound("No character found");
      }
      res.json(characters[0]);
    }),
  );

  router.get(
    "/api/character/:id",
    asyncHandler("Failed to get character", async (req, res) => {
      const character = await storage.getCharacter(req.params.id);
      if (!character) {
        throw notFound("Character not found");
      }
      res.json(character);
    }),
  );

  router.delete(
    "/api/character/:id",
    asyncHandler("Failed to delete character", async (req, res) => {
      const character = await storage.getCharacter(req.params.id);
      if (!character) {
        throw notFound("Character not found");
      }

      if (!(await storage.deleteCharacter(req.params.id))) {
        throw notFound("Character not found");
      }

      if (character.portraitUrl) {
        await images.remove(character.portraitUrl, "portraits").catch((error: unknown) => {
          console.error("Failed to delete character portrait:", error);
        });
      }

      res.json({ success: true });
    }),
  );

  router.post(
    "/api/character",
    asyncHandler("Failed to create character", async (req, res) => {
      const data = parseRequest(createCharacterSchema, req.body);
      const character = await storage.createCharacterWithSpiritDice(data);
      res.status(201).json(character);
    }),
  );

  router.put(
    "/api/character/:id",
    asyncHandler("Failed to update character", async (req, res) => {
      const updateData: CharacterUpdate = parseRequest(
        updateCharacterSchema,
        req.body,
      );

      const character = await storage.updateCharacterAndSpiritDice(
        req.params.id,
        updateData,
      );
      if (!character) {
        throw notFound("Character not found");
      }

      res.json(character);
    }),
  );

  router.post(
    "/api/character/:id/portrait",
    portraitUpload,
    asyncHandler("Failed to upload portrait", async (req, res) => {
      if (!req.file) {
        throw badRequest("No portrait file provided");
      }

      const character = await storage.getCharacter(req.params.id);
      if (!character) {
        throw notFound("Character not found");
      }

      const portraitUrl = await images.save("portraits", "portrait", req.file);
      try {
        const updated = await storage.updateCharacter(req.params.id, { portraitUrl });
        if (!updated) {
          await images.remove(portraitUrl, "portraits");
          throw notFound("Character not found");
        }
      } catch (error) {
        await images.remove(portraitUrl, "portraits").catch(() => undefined);
        throw error;
      }

      if (character.portraitUrl && character.portraitUrl !== portraitUrl) {
        await images.remove(character.portraitUrl, "portraits").catch((error: unknown) => {
          console.error("Failed to delete old portrait file:", error);
        });
      }

      res.json({ portraitUrl });
    }),
  );

  router.delete(
    "/api/character/:id/portrait",
    asyncHandler("Failed to delete portrait", async (req, res) => {
      const character = await storage.getCharacter(req.params.id);
      if (!character) {
        throw notFound("Character not found");
      }

      const updated = await storage.updateCharacter(req.params.id, { portraitUrl: null });
      if (!updated) throw notFound("Character not found");

      if (character.portraitUrl) {
        await images.remove(character.portraitUrl, "portraits").catch((error: unknown) => {
          console.error("Failed to delete old portrait file:", error);
        });
      }

      res.json(updated);
    }),
  );

  return router;
}
