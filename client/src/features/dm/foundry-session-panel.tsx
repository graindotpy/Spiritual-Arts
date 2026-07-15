import {
  Bot,
  LoaderCircle,
  LogIn,
  LogOut,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/lib/api";
import { foundrySessionKeys } from "@/lib/query-keys";
import type {
  FoundrySessionResponse,
  FoundrySessionState,
} from "@shared/foundry-session";
import {
  authenticateFoundrySession,
  useFoundrySession,
  useFoundrySessionControls,
} from "./foundry-session-api";

type ControlAction = "connect" | "disconnect";

const stateLabels: Record<FoundrySessionState, string> = {
  unconfigured: "Not configured",
  stopped: "Disconnected",
  starting: "Starting",
  authenticating: "Joining Foundry",
  ready: "Connected",
  stopping: "Disconnecting",
  failed: "Connection failed",
};

const stateClasses: Record<FoundrySessionState, string> = {
  unconfigured: "border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300",
  stopped: "border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300",
  starting: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  authenticating: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  ready: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  stopping: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  failed: "border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950/50 dark:text-red-300",
};

const transientStates = new Set<FoundrySessionState>([
  "starting",
  "authenticating",
  "stopping",
]);

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function describeStopReason(reason: string | null): string {
  switch (reason) {
    case "requested":
      return "The system user was disconnected on request.";
    case "ttl_expired":
      return "The automatic session limit was reached, so the system user disconnected.";
    case "server_shutdown":
      return "The website server stopped, so the system user disconnected.";
    case null:
    default:
      return "The system user is not connected.";
  }
}

function describeSession(
  response: FoundrySessionResponse | undefined,
  isError: boolean,
): string {
  if (isError) {
    return "The Foundry session status could not be loaded.";
  }
  if (!response) {
    return "Checking the Foundry system user…";
  }
  if (!response.session.configured) {
    return "The Foundry browser controls are not fully configured on the server.";
  }
  if (!response.authenticated) {
    return "Authorization is required before connecting or disconnecting the system user.";
  }

  const session = response.session;
  switch (session.state) {
    case "unconfigured":
      return "The Foundry browser controls are not fully configured on the server.";
    case "stopped":
      return describeStopReason(session.stopReason);
    case "starting":
      return "Starting the headless browser…";
    case "authenticating":
      return "Selecting the system user and joining the Foundry world…";
    case "ready":
      return session.bridgeUser
        ? `${session.bridgeUser} is connected and ready.`
        : "The Foundry system user is connected and ready.";
    case "stopping":
      return "Closing the Foundry session and browser…";
    case "failed":
      return session.failure?.message ?? "The system user could not connect.";
  }
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function FoundrySessionPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const sessionQuery = useFoundrySession();
  const { connect, disconnect, updateStatus } = useFoundrySessionControls();
  const [pendingAuthorization, setPendingAuthorization] =
    useState<ControlAction | null>(null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const response = sessionQuery.data;
  const session = response?.session;
  const isPending =
    connect.isPending ||
    disconnect.isPending ||
    isAuthorizing ||
    pendingAuthorization !== null;
  const isAuthenticated = response?.authenticated === true;

  const performControlAction = async (
    action: ControlAction,
    offerAuthorization = true,
  ): Promise<void> => {
    const notifySuccess = () => {
      toast({
        title: action === "connect" ? "Connection started" : "Disconnecting",
        description:
          action === "connect"
            ? "The Foundry system user is joining the game."
            : "The Foundry system user is leaving the game.",
      });
    };

    const mutation = action === "connect" ? connect : disconnect;
    try {
      await mutation.mutateAsync();
      notifySuccess();
    } catch (error) {
      if (offerAuthorization && isUnauthorized(error)) {
        setPendingAuthorization(action);
        return;
      }

      toast({
        title: action === "connect" ? "Connection failed" : "Disconnect failed",
        description: errorMessage(
          error,
          action === "connect"
            ? "The Foundry system user could not be connected."
            : "The Foundry system user could not be disconnected.",
        ),
        variant: "destructive",
      });
      void queryClient.invalidateQueries({ queryKey: foundrySessionKeys.status });
    }
  };

  const runControlAction = async (action: ControlAction): Promise<void> => {
    if (!isAuthenticated) {
      setPendingAuthorization(action);
      return;
    }
    await performControlAction(action);
  };

  const authorizeAndContinue = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    const action = pendingAuthorization;
    if (!action) return;

    const form = event.currentTarget;
    let password = new FormData(form).get("foundry-control-password");
    if (typeof password !== "string") password = "";
    if (password.length === 0) {
      toast({
        title: "Password required",
        description: "The Foundry control password cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    setIsAuthorizing(true);
    try {
      const authenticatedResponse = await authenticateFoundrySession(password);
      updateStatus(authenticatedResponse);
      if (!authenticatedResponse.authenticated) {
        toast({
          title: "Authorization failed",
          description: "The control password was not accepted.",
          variant: "destructive",
        });
        return;
      }

      form.reset();
      password = "";
      setPendingAuthorization(null);
      await performControlAction(action, false);
    } catch (error) {
      toast({
        title: "Authorization failed",
        description: errorMessage(
          error,
          "The control password could not be verified.",
        ),
        variant: "destructive",
      });
    } finally {
      form.reset();
      password = "";
      setIsAuthorizing(false);
    }
  };

  const state = session?.state ?? "unconfigured";
  const isConfigured = session?.configured === true;
  const canConnect =
    !isPending &&
    isConfigured &&
    (!isAuthenticated || ["stopped", "failed"].includes(state));
  const canDisconnect =
    !isPending &&
    isConfigured &&
    (!isAuthenticated ||
      ["starting", "authenticating", "ready", "failed"].includes(state));
  const statusLabel = sessionQuery.isLoading
    ? "Checking status"
    : sessionQuery.isError
      ? "Status unavailable"
      : !isConfigured
        ? "Not configured"
        : !isAuthenticated
          ? "Authorization required"
          : stateLabels[state];

  return (
    <>
      <Dialog
        open={pendingAuthorization !== null}
        onOpenChange={(open) => {
          if (!open && !isAuthorizing) setPendingAuthorization(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Authorize Foundry controls</DialogTitle>
            <DialogDescription>
              Enter the separate website control password to{" "}
              {pendingAuthorization}
              {pendingAuthorization ? " the" : ""} Foundry system user.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-5"
            onSubmit={(event) => void authorizeAndContinue(event)}
          >
            <div className="space-y-2">
              <Label htmlFor="foundry-control-password">Control password</Label>
              <Input
                id="foundry-control-password"
                name="foundry-control-password"
                type="password"
                autoComplete="current-password"
                autoFocus
                disabled={isAuthorizing}
                data-testid="input-foundry-control-password"
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isAuthorizing}
                onClick={() => setPendingAuthorization(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isAuthorizing}>
                {isAuthorizing && (
                  <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                )}
                Authorize
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Card className="mb-8 border-spiritual-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-spiritual-100 text-spiritual-700 dark:bg-spiritual-900 dark:text-spiritual-300">
                <Bot className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <CardTitle className="text-xl">Foundry system user</CardTitle>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  Connect only for the duration of a game session.
                </p>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                sessionQuery.isError
                  ? stateClasses.failed
                  : !isConfigured || !isAuthenticated
                    ? stateClasses.unconfigured
                    : stateClasses[state]
              }`}
              role="status"
              aria-live="polite"
              data-testid="foundry-session-status"
            >
              {sessionQuery.isLoading || transientStates.has(state) ? (
                <LoaderCircle
                  className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : sessionQuery.isError || state === "failed" ? (
                <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
              ) : state === "ready" ? (
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              ) : null}
              {statusLabel}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div className="min-w-0">
              <p className="text-sm leading-6 text-gray-700 dark:text-gray-300">
                {describeSession(response, sessionQuery.isError)}
              </p>
              {isAuthenticated && session?.expiresAt && state === "ready" && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Automatic disconnect: {" "}
                  <time dateTime={session.expiresAt}>
                    {formatTimestamp(session.expiresAt)}
                  </time>
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void runControlAction("connect")}
                disabled={!canConnect}
                data-testid="button-foundry-connect"
              >
                {connect.isPending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                ) : (
                  <LogIn className="h-4 w-4" />
                )}
                Connect
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void runControlAction("disconnect")}
                disabled={!canDisconnect}
                data-testid="button-foundry-disconnect"
              >
                {disconnect.isPending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                Disconnect
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
