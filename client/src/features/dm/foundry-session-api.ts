import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  foundrySessionResponseSchema,
  type FoundrySessionResponse,
} from "@shared/foundry-session";
import { requestJson } from "@/lib/api";
import { foundrySessionKeys } from "@/lib/query-keys";

const FOUNDRY_SESSION_URL = "/api/foundry-session";
const CONTROL_REQUEST_INIT = {
  headers: { "X-Spiritual-Arts-Control": "1" },
  credentials: "include" as const,
};

async function readFoundrySessionResponse(
  method: "GET" | "POST",
  path = "",
  body?: unknown,
  controlRequest = false,
): Promise<FoundrySessionResponse> {
  const response = await requestJson<unknown>(
    method,
    `${FOUNDRY_SESSION_URL}${path}`,
    body,
    controlRequest ? CONTROL_REQUEST_INIT : undefined,
  );
  return foundrySessionResponseSchema.parse(response);
}

export function authenticateFoundrySession(
  password: string,
): Promise<FoundrySessionResponse> {
  return readFoundrySessionResponse(
    "POST",
    "/authenticate",
    { password },
    true,
  );
}

function pollInterval(response: FoundrySessionResponse | undefined) {
  switch (response?.session.state) {
    case "starting":
    case "authenticating":
    case "stopping":
      return 1_500;
    case "ready":
      return 10_000;
    case "stopped":
    case "failed":
      return 30_000;
    case "unconfigured":
      return false;
    case undefined:
      return 30_000;
  }
}

export function useFoundrySession() {
  return useQuery<FoundrySessionResponse>({
    queryKey: foundrySessionKeys.status,
    queryFn: () => readFoundrySessionResponse("GET"),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => pollInterval(query.state.data),
  });
}

export function useFoundrySessionControls() {
  const queryClient = useQueryClient();
  const updateStatus = (response: FoundrySessionResponse) => {
    queryClient.setQueryData(foundrySessionKeys.status, response);
  };

  const connect = useMutation({
    mutationFn: () =>
      readFoundrySessionResponse("POST", "/connect", undefined, true),
    onSuccess: updateStatus,
  });

  const disconnect = useMutation({
    mutationFn: () =>
      readFoundrySessionResponse("POST", "/disconnect", undefined, true),
    onSuccess: updateStatus,
  });

  return { connect, disconnect, updateStatus };
}
