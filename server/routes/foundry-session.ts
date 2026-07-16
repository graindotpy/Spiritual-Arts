import { Router, type Request, type Response } from "express";
import { z } from "zod";
import type {
  FoundrySessionResponse,
  FoundrySessionStatus,
  FoundryStopReason,
} from "@shared/foundry-session";
import { asyncHandler } from "../http/async-handler";
import { ApiError, parseRequest } from "../http/errors";
import {
  FoundryControlAuth,
  FoundryControlAuthError,
} from "../foundry/control-auth";

const CONTROL_COOKIE = "spiritual_arts_foundry_control";
const CONTROL_HEADER = "X-Spiritual-Arts-Control";
const CONTROL_PATH = "/api/foundry-session";

const loginSchema = z
  .object({
    password: z.string().min(1).max(512),
  })
  .strict();

export interface FoundrySessionController {
  status(): FoundrySessionStatus;
  start(): FoundrySessionStatus;
  stop(reason?: FoundryStopReason): Promise<FoundrySessionStatus>;
}

function readCookie(request: Request, name: string): string | undefined {
  for (const part of request.headers.cookie?.split(";") ?? []) {
    const separator = part.indexOf("=");
    if (separator === -1 || part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function isAuthenticated(
  request: Request,
  auth: FoundryControlAuth,
): boolean {
  return auth.isAuthorized(readCookie(request, CONTROL_COOKIE));
}

function redactedStatus(
  controller: FoundrySessionController,
  auth: FoundryControlAuth,
): FoundrySessionStatus {
  const current = controller.status();
  const configured = current.configured && auth.configured;
  return {
    configured,
    mode: null,
    agentAvailable: null,
    state: configured ? "stopped" : "unconfigured",
    startedAt: null,
    readyAt: null,
    expiresAt: null,
    stoppedAt: null,
    stopReason: null,
    failure: null,
    bridgeUser: null,
  };
}

function responseFor(
  request: Request,
  controller: FoundrySessionController,
  auth: FoundryControlAuth,
): FoundrySessionResponse {
  const authenticated = isAuthenticated(request, auth);
  return {
    authenticated,
    session: authenticated
      ? controller.status()
      : redactedStatus(controller, auth),
  };
}

function requireControlRequest(
  request: Request,
  auth: FoundryControlAuth,
): void {
  if (!auth.configured) {
    throw new ApiError(503, "Foundry session controls are not configured");
  }
  if (request.get(CONTROL_HEADER) !== "1") {
    throw new ApiError(403, "Foundry control header is required");
  }
}

function requireAuthorization(
  request: Request,
  auth: FoundryControlAuth,
): void {
  requireControlRequest(request, auth);
  if (!isAuthenticated(request, auth)) {
    throw new ApiError(401, "Foundry control authorization is required");
  }
}

function throwLoginError(error: FoundryControlAuthError): never {
  switch (error.code) {
    case "not_configured":
      throw new ApiError(503, "Foundry session controls are not configured");
    case "invalid_password":
      throw new ApiError(401, "The Foundry control password is incorrect");
    case "rate_limited":
      throw new ApiError(
        429,
        "Too many failed control-password attempts; try again later",
      );
  }
}

function setControlCookie(response: Response, token: string, maxAge: number) {
  response.cookie(CONTROL_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: CONTROL_PATH,
    maxAge,
  });
}

export function createFoundrySessionRouter(
  controller: FoundrySessionController,
  auth: FoundryControlAuth,
): Router {
  const router = Router();

  router.get(CONTROL_PATH, (request, response) => {
    response.json(responseFor(request, controller, auth));
  });

  router.post(
    `${CONTROL_PATH}/authenticate`,
    asyncHandler("Failed to authorize Foundry controls", async (request, response) => {
      requireControlRequest(request, auth);
      const { password } = parseRequest(
        loginSchema,
        request.body,
        "A control password is required",
      );

      try {
        const login = auth.login(password, request.ip || "unknown");
        setControlCookie(response, login.token, login.expiresAt - Date.now());
        response.json({
          authenticated: true,
          session: controller.status(),
        } satisfies FoundrySessionResponse);
      } catch (error: unknown) {
        if (error instanceof FoundryControlAuthError) throwLoginError(error);
        throw error;
      }
    }),
  );

  router.post(
    `${CONTROL_PATH}/connect`,
    asyncHandler("Failed to start the Foundry session", async (request, response) => {
      requireAuthorization(request, auth);
      const current = controller.status();
      if (!current.configured) {
        throw new ApiError(503, "The Foundry system user is not configured");
      }
      if (current.mode === "agent" && current.agentAvailable !== true) {
        throw new ApiError(503, "The remote Foundry agent is offline");
      }
      const session = controller.start();
      response.status(202).json({
        authenticated: true,
        session,
      } satisfies FoundrySessionResponse);
    }),
  );

  router.post(
    `${CONTROL_PATH}/disconnect`,
    asyncHandler("Failed to stop the Foundry session", async (request, response) => {
      requireAuthorization(request, auth);
      const session = await controller.stop("requested");
      response.json({
        authenticated: true,
        session,
      } satisfies FoundrySessionResponse);
    }),
  );

  router.delete(
    `${CONTROL_PATH}/authenticate`,
    asyncHandler("Failed to clear Foundry authorization", async (request, response) => {
      requireControlRequest(request, auth);
      auth.revoke(readCookie(request, CONTROL_COOKIE));
      response.clearCookie(CONTROL_COOKIE, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: CONTROL_PATH,
      });
      response.status(204).end();
    }),
  );

  return router;
}
