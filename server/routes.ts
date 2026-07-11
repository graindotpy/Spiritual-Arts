import express, { type Express } from "express";
import { createServer, type Server } from "node:http";
import { apiNotFound } from "./http/errors";
import { createCardGameRouter } from "./routes/card-game";
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

export type ApplicationServer = Server & { closeRealtime: () => void };

export async function registerRoutes(
  app: Express,
  routeStorage: IStorage = storage,
  routeImages?: ImageStore,
): Promise<ApplicationServer> {
  if (routeStorage === storage) {
    await initializeStorage();
  }

  const httpServer = createServer(app) as ApplicationServer;
  const images = routeImages ?? new ImageStore();
  const spiritRolls = new SpiritRollWebSocket(httpServer);
  httpServer.closeRealtime = () => spiritRolls.close();

  if (images.usesLocalStorage) {
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
  }
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
  app.use(createCardGameRouter(routeStorage, images));
  app.use(createDmRouter(routeStorage));

  app.use("/api", apiNotFound);

  return httpServer;
}
