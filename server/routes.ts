import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { db } from "./db";
import {
  characters,
  insertTechniqueSchema,
  insertSpiritDiePoolSchema,
  insertActiveEffectSchema,
  insertGlossaryTermSchema,
  insertDmStackSchema,
  insertDmGlossarySchema,
  insertDmScratchpadSchema,
  cardGameStates,
  type DieSize,
} from "@shared/schema";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { isR2Enabled, uploadToR2, deleteFromR2 } from "./r2";
import { sendFoundryWebhook } from "./integrations/foundry";

// Configure multer for portrait uploads
const useR2 = isR2Enabled();
const portraitsDir = path.join(process.cwd(), "uploads", "portraits");
const imagesDir = path.join(process.cwd(), "uploads", "images");

if (!useR2) {
  if (!fs.existsSync(portraitsDir)) {
    fs.mkdirSync(portraitsDir, { recursive: true });
  }
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
}

const portraitUpload = multer({
  storage: useR2
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: (_req, _file, cb) => {
          cb(null, portraitsDir);
        },
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
          cb(null, "portrait-" + uniqueSuffix + path.extname(file.originalname));
        },
      }),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

const imageUpload = multer({
  storage: useR2
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: (_req, _file, cb) => {
          cb(null, imagesDir);
        },
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
          cb(null, "image-" + uniqueSuffix + path.extname(file.originalname));
        },
      }),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// WebSocket clients store
const wsClients = new Set<WebSocket>();

// Broadcast function for spirit die rolls
function broadcastSpiriteRoll(rollData: any) {
  const message = JSON.stringify({
    type: 'spirit_die_roll',
    data: rollData
  });
  
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

async function sendDiscordWebhook(payload: {
  characterName: string;
  techniqueName: string | null;
  spInvestment: number;
  dieSize: string;
  value: number;
  success: boolean;
  portraitUrl: string | null;
}) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const techniqueLabel = payload.techniqueName ?? "Unknown Technique";
  const resultLabel = payload.success ? "Success" : "Failed";
  const description = `**${techniqueLabel}** — ${payload.spInvestment} SP\nResult: **${payload.value}** (${payload.dieSize}) — ${resultLabel}`;
  const color = payload.success ? 0x2ecc71 : 0xe74c3c;
  const imageUrl = resolvePublicImageUrl(payload.portraitUrl);

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: payload.characterName,
            description,
            color,
            timestamp: new Date().toISOString(),
            ...(imageUrl ? { image: { url: imageUrl } } : {}),
          },
        ],
      }),
    });
  } catch (error) {
    console.error("Discord webhook error:", error);
  }
}

function resolvePublicImageUrl(portraitUrl: string | null) {
  if (!portraitUrl) return null;
  if (portraitUrl.startsWith("http://") || portraitUrl.startsWith("https://")) {
    return portraitUrl;
  }

  const base = process.env.R2_PUBLIC_BASE_URL;
  if (!base) return null;

  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const normalizedPath = portraitUrl.startsWith("/") ? portraitUrl.slice(1) : portraitUrl;
  return `${normalizedBase}/${normalizedPath}`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Create WebSocket server on same port with distinct path
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    wsClients.add(ws);
    
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      wsClients.delete(ws);
    });
    
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      wsClients.delete(ws);
    });
  });
  
  // Serve uploaded files (local disk only)
  if (!useR2) {
    app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
  }

  // Image upload endpoint for enhanced tooltips
  app.post("/api/upload/image", imageUpload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      if (useR2) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const key = `images/image-${uniqueSuffix}${path.extname(req.file.originalname)}`;
        const imageUrl = await uploadToR2({
          key,
          body: req.file.buffer,
          contentType: req.file.mimetype,
        });
        return res.json({ url: imageUrl });
      }

      const imageUrl = `/uploads/images/${req.file.filename}`;
      res.json({ url: imageUrl });
    } catch (error) {
      res.status(500).json({ message: "Failed to upload image" });
    }
  });
  // Utility function to check and clean up missing portrait files
  async function cleanupMissingPortraits() {
    try {
      const allCharacters = await db.select().from(characters);
      const updates = [];
      
      for (const character of allCharacters) {
        if (character.portraitUrl && character.portraitUrl.startsWith("/uploads/")) {
          const filePath = path.join(process.cwd(), character.portraitUrl);
          if (!fs.existsSync(filePath)) {
            console.log(`Cleaning up missing portrait for ${character.name}: ${character.portraitUrl}`);
            updates.push(storage.updateCharacter(character.id, { portraitUrl: null }));
          }
        }
      }
      
      if (updates.length > 0) {
        await Promise.all(updates);
        console.log(`Cleaned up ${updates.length} missing portrait references`);
      }
    } catch (error) {
      console.error('Error cleaning up missing portraits:', error);
    }
  }

  // Get all non-DM characters
  app.get("/api/characters", async (req, res) => {
    try {
      // Clean up any missing portrait files before returning characters
      await cleanupMissingPortraits();
      const characterList = await db
        .select()
        .from(characters)
        .where(eq(characters.isDmOnly, false));
      res.json(characterList);
    } catch (error) {
      console.error("Characters fetch error:", error);
      res.status(500).json({ message: "Failed to get characters" });
    }
  });

  // Get current/default character (first non-DM one for now)
  app.get("/api/character", async (req, res) => {
    try {
      // For now, we'll get the first character from the database
      const characterList = await db
        .select()
        .from(characters)
        .where(eq(characters.isDmOnly, false))
        .limit(1);
      if (characterList.length === 0) {
        return res.status(404).json({ message: "No character found" });
      }
      res.json(characterList[0]);
    } catch (error) {
      console.error("Character fetch error:", error);
      res.status(500).json({ message: "Failed to get character" });
    }
  });

  // Get specific character by ID
  app.get("/api/character/:id", async (req, res) => {
    try {
      const character = await storage.getCharacter(req.params.id);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }
      res.json(character);
    } catch (error) {
      console.error("Character fetch error:", error);
      res.status(500).json({ message: "Failed to get character" });
    }
  });

  // Delete character and related data
  app.delete("/api/character/:id", async (req, res) => {
    try {
      const character = await storage.getCharacter(req.params.id);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }

      if (character.portraitUrl) {
        if (useR2) {
          await deleteFromR2(character.portraitUrl);
        } else {
          const oldFilePath = path.join(process.cwd(), character.portraitUrl);
          try {
            if (fs.existsSync(oldFilePath)) {
              fs.unlinkSync(oldFilePath);
            }
          } catch (fileError) {
            console.error("Failed to delete portrait file:", fileError);
          }
        }
      }

      const deleted = await storage.deleteCharacter(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Character not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Character delete error:", error);
      res.status(500).json({ message: "Failed to delete character" });
    }
  });

  // Create a new character
  app.post("/api/character", async (req, res) => {
    try {
      const { name, path, level = 1 } = req.body;
      
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ message: "Name is required" });
      }
      
      if (!path || typeof path !== 'string' || path.trim().length === 0) {
        return res.status(400).json({ message: "Path is required" });
      }
      
      if (typeof level !== 'number' || level < 1 || level > 20) {
        return res.status(400).json({ message: "Level must be between 1 and 20" });
      }
      
      const character = await storage.createCharacter({
        name: name.trim(),
        path: path.trim(),
        level,
        isDmOnly: false,
        dmOwnerId: null,
      });
      
      res.json(character);
    } catch (error) {
      res.status(500).json({ message: "Failed to create character" });
    }
  });

  // Get DM-only characters for a user
  app.get("/api/dm/:userId/characters", async (req, res) => {
    try {
      const { userId } = req.params;
      const characterList = await db
        .select()
        .from(characters)
        .where(and(eq(characters.isDmOnly, true), eq(characters.dmOwnerId, userId)));
      res.json(characterList);
    } catch (error) {
      console.error("DM characters fetch error:", error);
      res.status(500).json({ message: "Failed to get DM characters" });
    }
  });

  // Create a new DM-only character for a user
  app.post("/api/dm/:userId/characters", async (req, res) => {
    try {
      const { userId } = req.params;
      const { name, path, level = 1 } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ message: "Name is required" });
      }

      if (!path || typeof path !== 'string' || path.trim().length === 0) {
        return res.status(400).json({ message: "Path is required" });
      }

      if (typeof level !== 'number' || level < 1 || level > 20) {
        return res.status(400).json({ message: "Level must be between 1 and 20" });
      }

      const character = await storage.createCharacter({
        name: name.trim(),
        path: path.trim(),
        level,
        isDmOnly: true,
        dmOwnerId: userId,
      });

      res.json(character);
    } catch (error) {
      console.error("DM character create error:", error);
      res.status(500).json({ message: "Failed to create DM character" });
    }
  });

  // Get spirit die pool
  app.get("/api/character/:id/spirit-die-pool", async (req, res) => {
    try {
      const pool = await storage.getSpiritDiePool(req.params.id);
      if (!pool) {
        return res.status(404).json({ message: "Spirit die pool not found" });
      }
      res.json(pool);
    } catch (error) {
      res.status(500).json({ message: "Failed to get spirit die pool" });
    }
  });

  // Create spirit die pool
  app.post("/api/character/:id/spirit-die-pool", async (req, res) => {
    try {
      const validatedData = insertSpiritDiePoolSchema.parse({
        ...req.body,
        characterId: req.params.id
      });
      const pool = await storage.createSpiritDiePool(validatedData);
      res.json(pool);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create spirit die pool" });
    }
  });

  // Update spirit die pool
  app.put("/api/character/:id/spirit-die-pool", async (req, res) => {
    try {
      const validatedData = insertSpiritDiePoolSchema.partial().parse(req.body);
      const updated = await storage.updateSpiritDiePool(req.params.id, validatedData);
      if (!updated) {
        return res.status(404).json({ message: "Spirit die pool not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update spirit die pool" });
    }
  });

  // Delete spirit die pool
  app.delete("/api/character/:id/spirit-die-pool", async (req, res) => {
    try {
      const deleted = await storage.deleteSpiritDiePool(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Spirit die pool not found" });
      }
      res.json({ message: "Spirit die pool deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete spirit die pool" });
    }
  });

  // Update character (level, name, path, portraitUrl)
  app.put("/api/character/:id", async (req, res) => {
    try {
      const { level, name, path, portraitUrl } = req.body;
      const updateData: any = {};
      
      if (level !== undefined) {
        if (typeof level !== 'number' || level < 1 || level > 20) {
          return res.status(400).json({ message: "Level must be between 1 and 20" });
        }
        updateData.level = level;
      }
      
      if (name !== undefined) {
        if (typeof name !== 'string' || name.trim().length === 0) {
          return res.status(400).json({ message: "Name must be a non-empty string" });
        }
        updateData.name = name.trim();
      }
      
      if (path !== undefined) {
        if (typeof path !== 'string' || path.trim().length === 0) {
          return res.status(400).json({ message: "Path must be a non-empty string" });
        }
        updateData.path = path.trim();
      }
      
      if (portraitUrl !== undefined) {
        updateData.portraitUrl = portraitUrl;
      }
      
      const updated = await storage.updateCharacter(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ message: "Character not found" });
      }
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to update character" });
    }
  });

  // Upload character portrait
  app.post("/api/character/:id/portrait", portraitUpload.single("portrait"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No portrait file provided" });
      }

      // Get the current character to check for existing portrait
      const character = await storage.getCharacter(req.params.id);
      if (!character) {
        // Clean up uploaded file if character doesn't exist
        if (!useR2 && req.file.path) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(404).json({ message: "Character not found" });
      }

      let portraitUrl = `/uploads/portraits/${req.file.filename}`;
      if (useR2) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const key = `portraits/portrait-${uniqueSuffix}${path.extname(req.file.originalname)}`;
        portraitUrl = await uploadToR2({
          key,
          body: req.file.buffer,
          contentType: req.file.mimetype,
        });
      }
      const updated = await storage.updateCharacter(req.params.id, { portraitUrl });
      
      if (!updated) {
        // Clean up uploaded file if character update fails
        if (!useR2 && req.file.path) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(404).json({ message: "Character not found" });
      }

      // Clean up old portrait file if it exists
      if (character.portraitUrl && character.portraitUrl !== portraitUrl) {
        if (useR2) {
          await deleteFromR2(character.portraitUrl);
        } else {
          const oldFilePath = path.join(process.cwd(), character.portraitUrl);
          try {
            if (fs.existsSync(oldFilePath)) {
              fs.unlinkSync(oldFilePath);
              console.log(`Cleaned up old portrait file: ${oldFilePath}`);
            }
          } catch (fileError) {
            console.error("Failed to delete old portrait file:", fileError);
          }
        }
      }

      res.json({ portraitUrl });
    } catch (error) {
      // Clean up uploaded file on error (disk storage only)
      if (!useR2 && req.file?.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          console.error("Failed to cleanup uploaded file:", cleanupError);
        }
      }
      console.error("Portrait upload error:", error);
      res.status(500).json({ message: "Failed to upload portrait" });
    }
  });

  // Delete character portrait
  app.delete("/api/character/:id/portrait", async (req, res) => {
    try {
      const character = await storage.getCharacter(req.params.id);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }

      // Delete the old portrait file if it exists
      if (character.portraitUrl) {
        if (useR2) {
          await deleteFromR2(character.portraitUrl);
        } else {
          const oldFilePath = path.join(process.cwd(), character.portraitUrl);
          try {
            if (fs.existsSync(oldFilePath)) {
              fs.unlinkSync(oldFilePath);
            }
          } catch (fileError) {
            console.error("Failed to delete old portrait file:", fileError);
          }
        }
      }

      const updated = await storage.updateCharacter(req.params.id, { portraitUrl: null });
      res.json(updated);
    } catch (error) {
      console.error("Portrait delete error:", error);
      res.status(500).json({ message: "Failed to delete portrait" });
    }
  });

  // Roll spirit die
  app.post("/api/character/:id/roll", async (req, res) => {
    try {
      const { spInvestment, dieIndex = 0, techniqueId } = req.body;
      if (!spInvestment || spInvestment < 1) {
        return res.status(400).json({ message: "Invalid SP investment" });
      }

      const pool = await storage.getSpiritDiePool(req.params.id);
      if (!pool) {
        return res.status(404).json({ message: "Spirit die pool not found" });
      }

      const currentDice = pool.currentDice as Array<DieSize | null>;
      if (currentDice.length === 0) {
        return res.status(400).json({ message: "No dice available to roll" });
      }

      // Validate die index
      if (dieIndex < 0 || dieIndex >= currentDice.length) {
        return res.status(400).json({ message: "Invalid die index" });
      }

      const dieSize = currentDice[dieIndex];
      if (!dieSize) {
        return res.status(400).json({ message: "Selected die is depleted" });
      }
      const dieMax = parseInt(dieSize.substring(1));
      const rollValue = Math.floor(Math.random() * dieMax) + 1;
      
      const success = rollValue >= spInvestment;
      let newDicePool = [...currentDice];

      // If failed, reduce die size or remove it
      if (!success) {
        const dieReductions: Record<DieSize, DieSize | null> = {
          'd12': 'd10',
          'd10': 'd8',
          'd8': 'd6',
          'd6': 'd4',
          'd4': null
        };

        const newDieSize = dieReductions[dieSize];
        if (newDieSize) {
          newDicePool[dieIndex] = newDieSize;
        } else {
          newDicePool[dieIndex] = null;
        }
      }

      // Update the pool
      await storage.updateSpiritDiePool(req.params.id, { currentDice: newDicePool });

      // Get character info for broadcast
      const character = await storage.getCharacter(req.params.id);
      let techniqueName: string | null = null;
      if (techniqueId) {
        const technique = await storage.getTechnique(techniqueId);
        if (technique && technique.characterId === req.params.id) {
          const spEffects = technique.spEffects as Record<string, { alternateName?: string }>;
          const altName = spEffects?.[String(spInvestment)]?.alternateName;
          techniqueName = altName || technique.name;
        }
      }
      
      const rollResult = {
        value: rollValue,
        success,
        newDicePool,
        dieRolled: dieSize
      };

      // Broadcast roll to all connected clients
      if (character) {
        const rollBroadcast = {
          character: {
            id: character.id,
            name: character.name,
            path: character.path,
            level: character.level,
            portraitUrl: character.portraitUrl
          },
          roll: {
            spInvestment,
            dieSize,
            dieIndex,
            value: rollValue,
            success,
            techniqueId: techniqueId ?? null,
            techniqueName,
            timestamp: new Date().toISOString()
          },
          source: "spiritual-arts" as const,
          version: 1 as const,
        };
        
        broadcastSpiriteRoll(rollBroadcast);
        void sendDiscordWebhook({
          characterName: character.name,
          techniqueName,
          spInvestment,
          dieSize,
          value: rollValue,
          success,
          portraitUrl: character.portraitUrl,
        });
        void sendFoundryWebhook(rollBroadcast);
      }

      console.log(`Roll result for ${spInvestment} SP using die ${dieIndex} (${dieSize}):`, {
        value: rollValue,
        success,
        newDicePool
      });

      res.json(rollResult);
    } catch (error) {
      console.error("Error rolling die:", error);
      res.status(500).json({ message: "Failed to roll die" });
    }
  });

  // Long rest - restore dice
  app.post("/api/character/:id/long-rest", async (req, res) => {
    try {
      const pool = await storage.getSpiritDiePool(req.params.id);
      if (!pool) {
        return res.status(404).json({ message: "Spirit die pool not found" });
      }

      // Get the character to determine level-based dice
      const character = await storage.getCharacter(req.params.id);
      if (!character) {
        return res.status(404).json({ message: "Character not found" });
      }

      const { SPIRIT_DIE_PROGRESSION } = await import("@shared/schema");
      const baseDice = SPIRIT_DIE_PROGRESSION[character.level] || ['d4'];
      const restoredDice = pool.overrideDice ? (pool.overrideDice as any[]) : baseDice;
      const updated = await storage.updateSpiritDiePool(req.params.id, { currentDice: restoredDice });
      
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to restore dice" });
    }
  });

  // Get techniques
  app.get("/api/character/:id/techniques", async (req, res) => {
    try {
      const techniques = await storage.getTechniques(req.params.id);
      res.json(techniques);
    } catch (error) {
      res.status(500).json({ message: "Failed to get techniques" });
    }
  });

  // Create technique
  app.post("/api/character/:id/techniques", async (req, res) => {
    try {
      const validatedData = insertTechniqueSchema.parse({
        ...req.body,
        characterId: req.params.id
      });
      const technique = await storage.createTechnique(validatedData);
      res.json(technique);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create technique" });
    }
  });

  // Update technique
  app.put("/api/techniques/:id", async (req, res) => {
    try {
      const validatedData = insertTechniqueSchema.partial().parse(req.body);
      const updated = await storage.updateTechnique(req.params.id, validatedData);
      if (!updated) {
        return res.status(404).json({ message: "Technique not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update technique" });
    }
  });

  // Delete technique
  app.delete("/api/techniques/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteTechnique(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Technique not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete technique" });
    }
  });

  // Get active effects
  app.get("/api/character/:id/active-effects", async (req, res) => {
    try {
      const effects = await storage.getActiveEffects(req.params.id);
      res.json(effects);
    } catch (error) {
      res.status(500).json({ message: "Failed to get active effects" });
    }
  });

  // Create active effect
  app.post("/api/character/:id/active-effects", async (req, res) => {
    try {
      const validatedData = insertActiveEffectSchema.parse({
        ...req.body,
        characterId: req.params.id
      });
      const effect = await storage.createActiveEffect(validatedData);
      res.json(effect);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create active effect" });
    }
  });

  // Delete active effect
  app.delete("/api/active-effects/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteActiveEffect(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Active effect not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete active effect" });
    }
  });

  // Glossary routes
  app.get("/api/character/:id/glossary", async (req, res) => {
    try {
      const terms = await storage.getGlossaryTerms(req.params.id);
      res.json(terms);
    } catch (error) {
      res.status(500).json({ message: "Failed to get glossary terms" });
    }
  });

  app.post("/api/character/:id/glossary", async (req, res) => {
    try {
      const validatedData = insertGlossaryTermSchema.parse({
        ...req.body,
        characterId: req.params.id
      });
      const term = await storage.createGlossaryTerm(validatedData);
      res.json(term);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create glossary term" });
    }
  });

  app.put("/api/glossary/:id", async (req, res) => {
    try {
      const validatedData = insertGlossaryTermSchema.partial().parse(req.body);
      const updated = await storage.updateGlossaryTerm(req.params.id, validatedData);
      if (!updated) {
        return res.status(404).json({ message: "Glossary term not found" });
      }
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update glossary term" });
    }
  });

  app.delete("/api/glossary/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteGlossaryTerm(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Glossary term not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete glossary term" });
    }
  });

  // Technique Preferences endpoints
  app.get("/api/technique-preferences/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const preferences = await storage.getTechniquePreferences(userId);
      res.json(preferences);
    } catch (error) {
      console.error("Technique preferences fetch error:", error);
      res.status(500).json({ message: "Failed to get technique preferences" });
    }
  });

  app.post("/api/technique-preferences", async (req, res) => {
    try {
      const { userId, techniqueId, isMinimized } = req.body;
      
      if (!userId || !techniqueId || typeof isMinimized !== 'boolean') {
        return res.status(400).json({ message: "Invalid preference data" });
      }

      const preference = await storage.upsertTechniquePreference({
        userId,
        techniqueId,
        isMinimized
      });
      
      res.json(preference);
    } catch (error) {
      console.error("Technique preference update error:", error);
      res.status(500).json({ message: "Failed to update technique preference" });
    }
  });

  // Tracker endpoints
  app.get("/api/character/:id/trackers", async (req, res) => {
    try {
      const trackers = await storage.getTrackers(req.params.id);
      res.json(trackers);
    } catch (error) {
      console.error("Get trackers error:", error);
      res.status(500).json({ message: "Failed to get trackers" });
    }
  });

  app.post("/api/character/:id/trackers", async (req, res) => {
    try {
      const { name, target } = req.body;
      
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: "Name is required" });
      }

      const tracker = await storage.createTracker({
        characterId: req.params.id,
        name: name.trim(),
        currentValue: 0,
        target: target?.trim() || null
      });
      
      res.json(tracker);
    } catch (error) {
      console.error("Create tracker error:", error);
      res.status(500).json({ message: "Failed to create tracker" });
    }
  });

  app.put("/api/trackers/:id", async (req, res) => {
    try {
      const { currentValue, target, name } = req.body;
      const updateData: any = {};
      
      if (currentValue !== undefined) updateData.currentValue = currentValue;
      if (target !== undefined) updateData.target = target;
      if (name !== undefined) updateData.name = name;
      
      const updated = await storage.updateTracker(req.params.id, updateData);
      if (!updated) {
        return res.status(404).json({ message: "Tracker not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Update tracker error:", error);
      res.status(500).json({ message: "Failed to update tracker" });
    }
  });

  app.delete("/api/trackers/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteTracker(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Tracker not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Delete tracker error:", error);
      res.status(500).json({ message: "Failed to delete tracker" });
    }
  });

  // Card game state (DM-only for now)
  app.get("/api/card-game/state", async (_req, res) => {
    try {
      const [row] = await db.select().from(cardGameStates).limit(1);
      if (!row) {
        return res.json({ state: null, updatedAt: 0 });
      }
      const updatedAt =
        row.updatedAt instanceof Date
          ? row.updatedAt.getTime()
          : typeof row.updatedAt === "string"
          ? Date.parse(row.updatedAt)
          : 0;
      res.json({ state: row.state, updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0 });
    } catch (error) {
      console.error("Get card game state error:", error);
      res.status(500).json({ message: "Failed to get card game state" });
    }
  });

  app.put("/api/card-game/state", async (req, res) => {
    try {
      const { state } = req.body ?? {};
      if (!state) {
        return res.status(400).json({ message: "State is required" });
      }

      const id = "default";
      const [existing] = await db.select().from(cardGameStates).limit(1);
      const incomingUpdatedAt =
        typeof (state as { updatedAt?: unknown })?.updatedAt === "number"
          ? Number((state as { updatedAt: number }).updatedAt)
          : 0;
      const existingUpdatedAt =
        existing?.updatedAt instanceof Date
          ? existing.updatedAt.getTime()
          : typeof existing?.updatedAt === "string"
          ? Date.parse(existing.updatedAt)
          : 0;

      if (existing && Number.isFinite(existingUpdatedAt) && incomingUpdatedAt < existingUpdatedAt) {
        return res.status(409).json({
          success: false,
          conflict: true,
          state: existing.state,
          updatedAt: existingUpdatedAt,
        });
      }
      const now = new Date();
      await db
        .insert(cardGameStates)
        .values({ id, state, updatedAt: now })
        .onConflictDoUpdate({
          target: cardGameStates.id,
          set: { state, updatedAt: now },
        });

      const toImageSet = (value: any) => {
        const urls = new Set<string>();
        const cards = Array.isArray(value?.cards) ? value.cards : [];
        for (const card of cards) {
          if (typeof card?.imageUrl === "string" && card.imageUrl.trim()) {
            urls.add(card.imageUrl.trim());
          }
        }
        return urls;
      };

      const previousImages = toImageSet(existing?.state);
      const nextImages = toImageSet(state);
      const removedImages = Array.from(previousImages).filter((url) => !nextImages.has(url));

      if (removedImages.length) {
        await Promise.all(
          removedImages.map(async (url) => {
            try {
              if (useR2) {
                await deleteFromR2(url);
                return;
              }
              if (url.startsWith("/uploads/images/")) {
                const filePath = path.join(process.cwd(), url);
                if (fs.existsSync(filePath)) {
                  fs.unlinkSync(filePath);
                }
              }
            } catch (error) {
              console.error("Failed to delete unused card image:", url, error);
            }
          })
        );
      }

      const updatedAt = now.getTime();
      const nextState =
        state && typeof state === "object"
          ? { ...state, updatedAt }
          : { updatedAt };
      res.json({ success: true, state: nextState, updatedAt });
    } catch (error) {
      console.error("Update card game state error:", error);
      res.status(500).json({ message: "Failed to update card game state" });
    }
  });

  // DM Stack endpoints
  app.get("/api/dm/:userId/stacks", async (req, res) => {
    try {
      const stacks = await storage.getDmStacks(req.params.userId);
      res.json(stacks);
    } catch (error) {
      console.error("Get DM stacks error:", error);
      res.status(500).json({ message: "Failed to get DM stacks" });
    }
  });

  app.post("/api/dm/:userId/stacks", async (req, res) => {
    try {
      const validatedData = insertDmStackSchema.parse(req.body);
      const stack = await storage.createDmStack({
        ...validatedData,
        userId: req.params.userId
      });
      res.json(stack);
    } catch (error) {
      console.error("Create DM stack error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid stack data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create DM stack" });
    }
  });

  app.put("/api/dm/stacks/:id", async (req, res) => {
    try {
      const updated = await storage.updateDmStack(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Stack not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Update DM stack error:", error);
      res.status(500).json({ message: "Failed to update DM stack" });
    }
  });

  app.delete("/api/dm/stacks/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteDmStack(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Stack not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Delete DM stack error:", error);
      res.status(500).json({ message: "Failed to delete DM stack" });
    }
  });

  // DM Glossary endpoints
  app.get("/api/dm/:userId/glossary", async (req, res) => {
    try {
      const terms = await storage.getDmGlossary(req.params.userId);
      res.json(terms);
    } catch (error) {
      console.error("Get DM glossary error:", error);
      res.status(500).json({ message: "Failed to get DM glossary" });
    }
  });

  app.post("/api/dm/:userId/glossary", async (req, res) => {
    try {
      const validatedData = insertDmGlossarySchema.parse(req.body);
      const term = await storage.createDmGlossaryTerm({
        ...validatedData,
        userId: req.params.userId
      });
      res.json(term);
    } catch (error) {
      console.error("Create DM glossary term error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid glossary term data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create DM glossary term" });
    }
  });

  app.put("/api/dm/glossary/:id", async (req, res) => {
    try {
      const updated = await storage.updateDmGlossaryTerm(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Glossary term not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Update DM glossary term error:", error);
      res.status(500).json({ message: "Failed to update DM glossary term" });
    }
  });

  app.delete("/api/dm/glossary/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteDmGlossaryTerm(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Glossary term not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Delete DM glossary term error:", error);
      res.status(500).json({ message: "Failed to delete DM glossary term" });
    }
  });

  // DM Scratchpad endpoints
  app.get("/api/dm/:userId/scratchpads", async (req, res) => {
    try {
      const scratchpads = await storage.getDmScratchpads(req.params.userId);
      res.json(scratchpads);
    } catch (error) {
      console.error("Get DM scratchpads error:", error);
      res.status(500).json({ message: "Failed to get DM scratchpads" });
    }
  });

  app.post("/api/dm/:userId/scratchpads", async (req, res) => {
    try {
      const validatedData = insertDmScratchpadSchema.parse(req.body);
      const scratchpad = await storage.createDmScratchpad({
        ...validatedData,
        userId: req.params.userId
      });
      res.json(scratchpad);
    } catch (error) {
      console.error("Create DM scratchpad error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid scratchpad data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create DM scratchpad" });
    }
  });

  app.put("/api/dm/scratchpads/:id", async (req, res) => {
    try {
      const updated = await storage.updateDmScratchpad(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "Scratchpad not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Update DM scratchpad error:", error);
      res.status(500).json({ message: "Failed to update DM scratchpad" });
    }
  });

  app.delete("/api/dm/scratchpads/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteDmScratchpad(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Scratchpad not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Delete DM scratchpad error:", error);
      res.status(500).json({ message: "Failed to delete DM scratchpad" });
    }
  });

  return httpServer;
}
