import express from "express";
import { databaseConnection } from "./db";
import { apiErrorHandler } from "./http/errors";
import { registerRoutes } from "./routes";
import { log, serveStatic, setupVite } from "./vite";

const app = express();
if (process.env.NODE_ENV === "production") {
  // Render terminates HTTPS at its proxy. Trust exactly that first hop so
  // privileged-control login throttling keys requests by the real client IP.
  app.set("trust proxy", 1);
}
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

let databaseClose: Promise<void> | undefined;

function closeDatabase(): Promise<void> {
  databaseClose ??= (async () => {
    try {
      await databaseConnection?.pool.end();
    } catch (error) {
      console.error("Failed to close the database pool:", error);
      process.exitCode = 1;
    }
  })();
  return databaseClose;
}

// Disable caching for API responses so UI reflects latest data.
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

app.use((req, res, next) => {
  const startedAt = Date.now();

  res.on("finish", () => {
    if (req.path.startsWith("/api")) {
      log(
        `${req.method} ${req.path} ${res.statusCode} in ${Date.now() - startedAt}ms`,
      );
    }
  });

  next();
});

async function start(): Promise<void> {
  const server = await registerRoutes(app);

  // Vite's fallback must be registered after API routes and their 404 handler.
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  app.use(apiErrorHandler);

  const port = Number.parseInt(process.env.PORT || "5000", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  const listenOptions: { port: number; host: string; reusePort?: boolean } = {
    port,
    host: "0.0.0.0",
  };

  if (process.platform !== "win32") {
    listenOptions.reusePort = true;
  }

  server.once("error", (error) => {
    console.error("HTTP server error:", error);
    process.exitCode = 1;
    server.closeRealtime();
    void server.closeFoundrySession().catch((closeError: unknown) => {
      console.error("Failed to close the Foundry browser session:", closeError);
    });
    void closeDatabase();
  });
  server.listen(listenOptions, () => {
    log(`serving on port ${port}`);
  });

  let shuttingDown = false;
  const shutDown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`received ${signal}; closing server`);

    const forceExit = setTimeout(() => {
      console.error("Server did not close within 10 seconds");
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    server.closeRealtime();
    const foundryClosed = server.closeFoundrySession();
    server.close((error) => {
      void (async () => {
        try {
          if (error) {
            console.error("Failed to close server cleanly:", error);
            process.exitCode = 1;
          }
          await foundryClosed;
          await closeDatabase();
        } catch (closeError: unknown) {
          console.error("Failed to close server services:", closeError);
          process.exitCode = 1;
        } finally {
          clearTimeout(forceExit);
        }
      })();
    });
  };

  process.once("SIGINT", shutDown);
  process.once("SIGTERM", shutDown);
}

void start().catch((error: unknown) => {
  console.error("Failed to start server:", error);
  process.exitCode = 1;
  void closeDatabase();
});
