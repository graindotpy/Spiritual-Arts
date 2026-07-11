export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function readResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text || undefined;
}

async function ensureSuccessfulResponse(response: Response): Promise<Response> {
  if (response.ok) {
    return response;
  }

  const details = await readResponseBody(response);
  const message =
    typeof details === "object" && details !== null && "message" in details
      ? String(details.message)
      : typeof details === "string"
        ? details
        : response.statusText || "Request failed";

  throw new ApiError(response.status, message, details);
}

async function request(
  method: HttpMethod,
  url: string,
  body?: unknown,
  init: Omit<RequestInit, "method" | "body"> = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  const hasBody = body !== undefined;

  if (hasBody && !(body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...init,
    method,
    headers,
    body: hasBody
      ? body instanceof FormData
        ? body
        : JSON.stringify(body)
      : undefined,
    credentials: init.credentials ?? "include",
  });

  return ensureSuccessfulResponse(response);
}

export async function requestJson<T>(
  method: HttpMethod,
  url: string,
  body?: unknown,
  init?: Omit<RequestInit, "method" | "body">,
): Promise<T> {
  const response = await request(method, url, body, init);
  return (await readResponseBody(response)) as T;
}
