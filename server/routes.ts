import express, { type Express } from "express";
import { createServer, type Server } from "node:http";
import { readFoundrySessionConfig } from "./foundry/config";
import { FoundryControlAuth } from "./foundry/control-auth";
import { PlaywrightFoundryConnector } from "./foundry/playwright-runner";
import { FoundrySessionManager } from "./foundry/session-manager";
import { apiNotFound } from "./http/errors";
import { createCardGameRouter } from "./routes/card-game";
import { createCharacterRouter } from "./routes/characters";
import { createDmRouter } from "./routes/dm";
import { createFoundrySessionRouter } from "./routes/foundry-session";
import { createGlossaryRouter } from "./routes/glossary";
import { createInstrumentRouter } from "./routes/instruments";
import { createPreferenceRouter } from "./routes/preferences";
import { createSpiritDiceRouter } from "./routes/spirit-dice";
import { createTechniqueRouter } from "./routes/techniques";
import { createTrackerRouter } from "./routes/trackers";
import { createUploadRouter } from "./routes/uploads";
import { initializeStorage, storage, type IStorage } from "./storage";
import { ImageStore } from "./uploads/image-store";
import { SpiritRollWebSocket } from "./websocket";

export type ApplicationServer = Server & {
  closeRealtime: () => void;
  closeFoundrySession: () => Promise<void>;
};

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
  const foundryConfig = readFoundrySessionConfig();
  if (foundryConfig.warning) console.warn(foundryConfig.warning);
  const foundrySessions = new FoundrySessionManager(
    foundryConfig.config,
    new PlaywrightFoundryConnector(),
  );
  const foundryAuth = new FoundryControlAuth({
    password: process.env.FOUNDRY_CONTROL_PASSWORD,
  });
  if (foundryConfig.config && !foundryAuth.configured) {
    console.warn(
      "Foundry browser controls disabled; FOUNDRY_CONTROL_PASSWORD is missing",
    );
  }
  httpServer.closeRealtime = () => spiritRolls.close();
  httpServer.closeFoundrySession = () => foundrySessions.dispose();
  httpServer.once("close", () => {
    void foundrySessions.dispose().catch((error: unknown) => {
      console.error("Failed to close the Foundry browser session:", error);
    });
  });

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
  app.use(createInstrumentRouter(routeStorage, spiritRolls));
  app.use(createCardGameRouter(routeStorage, images));
  app.use(createDmRouter(routeStorage));
  app.use(createFoundrySessionRouter(foundrySessions, foundryAuth));

  app.use("/api", apiNotFound);

  return httpServer;
}
