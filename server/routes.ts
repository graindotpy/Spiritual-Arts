import express, { type Express } from "express";
import { createServer, type Server } from "node:http";
import { readFoundrySessionConfig } from "./foundry/config";
import { FoundryAgentHub } from "./foundry/agent-hub";
import { FoundryControlAuth } from "./foundry/control-auth";
import { RemoteFoundryConnector } from "./foundry/remote-connector";
import { FoundrySessionManager } from "./foundry/session-manager";
import type { FoundryConnector } from "./foundry/types";
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
  const foundryAgent =
    foundryConfig.config?.mode === "agent"
      ? new FoundryAgentHub(httpServer, {
          agentId: foundryConfig.config.agentId,
          token: foundryConfig.config.agentToken,
          bridgeUser: foundryConfig.config.userName,
        })
      : null;
  let foundryConnector: FoundryConnector;
  if (foundryAgent) {
    foundryConnector = new RemoteFoundryConnector(foundryAgent);
  } else if (foundryConfig.config) {
    const { PlaywrightFoundryConnector } = await import(
      "./foundry/playwright-runner"
    );
    foundryConnector = new PlaywrightFoundryConnector();
  } else {
    // An unconfigured session manager never invokes its connector. Avoid even
    // loading the local Playwright runner in that common disabled state.
    foundryConnector = {
      connect: async () => {
        throw new Error("Foundry session control is not configured");
      },
    };
  }
  const foundrySessions = new FoundrySessionManager(
    foundryConfig.config,
    foundryConnector,
  );
  const foundryAuth = new FoundryControlAuth({
    password: process.env.FOUNDRY_CONTROL_PASSWORD,
  });
  if (foundryConfig.config && !foundryAuth.configured) {
    console.warn(
      "Foundry session controls disabled; FOUNDRY_CONTROL_PASSWORD is missing",
    );
  }
  httpServer.closeRealtime = () => spiritRolls.close();
  let closeFoundryTask: Promise<void> | null = null;
  httpServer.closeFoundrySession = () => {
    closeFoundryTask ??= foundrySessions.dispose().finally(() => {
      foundryAgent?.close();
    });
    return closeFoundryTask;
  };
  httpServer.once("close", () => {
    void httpServer.closeFoundrySession().catch((error: unknown) => {
      console.error("Failed to close the Foundry session:", error);
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
