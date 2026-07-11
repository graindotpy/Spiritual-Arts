import { ApiError, requestJson } from "@/lib/api";
import type {
  CardGameStateResponse,
  PersistedCardGameState,
} from "./types";

const STATE_ENDPOINT = "/api/card-game/state";

export function parsePersistedUpdatedAt(value: unknown): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function loadCardGameState(signal?: AbortSignal): Promise<CardGameStateResponse> {
  return requestJson<CardGameStateResponse>("GET", STATE_ENDPOINT, undefined, { signal });
}

export function saveCardGameState(
  state: PersistedCardGameState,
): Promise<CardGameStateResponse> {
  return requestJson<CardGameStateResponse>("PUT", STATE_ENDPOINT, { state });
}

export function cardGameConflictResponse(error: unknown): CardGameStateResponse | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  return (error.details as CardGameStateResponse | undefined) ?? null;
}

export async function uploadCardGameImage(file: File): Promise<string | null> {
  const formData = new FormData();
  formData.append("image", file);
  const data = await requestJson<{ url?: unknown }>(
    "POST",
    "/api/upload/card-image",
    formData,
  );
  return typeof data.url === "string" ? data.url : null;
}
