import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { apiNotFound } from "./http/errors";
import { createCharacterRouter } from "./routes/characters";
import { createDmRouter } from "./routes/dm";
import { createGlossaryRouter } from "./routes/glossary";
import { createPreferenceRouter } from "./routes/preferences";
import { createSpiritDiceRouter } from "./routes/spirit-dice";
import { createTechniqueRouter } from "./routes/techniques";
import { createTrackerRouter } from "./routes/trackers";
import { createUploadRouter } from "./routes/uploads";
import { initializeStorage, storage, type IStorage } from "./storage";
import { ImageStore } from "./uploads/image-store";
import { SpiritRollWebSocket } from "./websocket";

export async function registerRoutes(
  app: Express,
  routeStorage: IStorage = storage,
): Promise<Server> {
  if (routeStorage === storage) {
    await initializeStorage();
  }

  const httpServer = createServer(app);
  const images = new ImageStore();
  const spiritRolls = new SpiritRollWebSocket(httpServer);

  app.use(
    "/uploads",
    express.static(images.rootDirectory, {
      dotfiles: "deny",
      index: false,
      setHeaders(response) {
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
      },
    }),
  );
  app.use("/uploads", (_req, res) => {
    res.status(404).end();
  });

  app.use(createUploadRouter(images));
  app.use(createCharacterRouter(routeStorage, images));
  app.use(createSpiritDiceRouter(routeStorage, spiritRolls));
  app.use(createTechniqueRouter(routeStorage));
  app.use(createGlossaryRouter(routeStorage));
  app.use(createPreferenceRouter(routeStorage));
  app.use(createTrackerRouter(routeStorage));
  app.use(createDmRouter(routeStorage));

  app.use("/api", apiNotFound);

  return httpServer;
}
