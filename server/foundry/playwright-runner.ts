import {
  FoundryRunnerError,
  type FoundryConnection,
  type FoundryConnectionTermination,
  type FoundryConnector,
  type FoundrySessionConfig,
} from "./types";

export const FOUNDRY_JOIN_SELECTORS = Object.freeze({
  // Foundry v12 renders #join-game as a template and gives the live form the
  // #join-game-form ID. Keep the older form ID as a compatibility fallback.
  form: "form#join-game-form, form#join-game",
  user: 'select[name="userid"]',
  accessKey: 'input[name="password"]',
  joinButton: 'button[name="join"]',
  submitButton: 'button[type="submit"]',
});

const MODULE_ID = "spiritual-arts-foundry";
const BRIDGE_USER_SETTING = "bridgeUser";
const DEFAULT_ACTION_TIMEOUT_MS = 15_000;
const DEFAULT_NAVIGATION_TIMEOUT_MS = 60_000;
const DEFAULT_LOGIN_TIMEOUT_MS = 180_000;
const RESOURCE_CLOSE_TIMEOUT_MS = 2_500;

export interface PlaywrightResponsePort {
  status(): number;
}

export interface PlaywrightHandlePort<T> {
  jsonValue(): Promise<T>;
  dispose(): Promise<void>;
}

export interface PlaywrightLocatorPort {
  locator(selector: string): PlaywrightLocatorPort;
  count(): Promise<number>;
  waitFor(options: {
    state: "visible";
    timeout: number;
  }): Promise<void>;
  evaluateAll<T, TArg>(
    callback: (elements: Element[], argument: TArg) => T,
    argument: TArg,
  ): Promise<T>;
  selectOption(option: { value: string }): Promise<string[]>;
  inputValue(): Promise<string>;
  fill(value: string): Promise<void>;
  click(): Promise<void>;
}

export interface PlaywrightPagePort {
  setDefaultTimeout(timeoutMs: number): void;
  setDefaultNavigationTimeout(timeoutMs: number): void;
  goto(
    url: string,
    options: { waitUntil: "domcontentloaded"; timeout: number },
  ): Promise<PlaywrightResponsePort | null>;
  url(): string;
  locator(selector: string): PlaywrightLocatorPort;
  waitForFunction<T, TArg>(
    callback: (argument: TArg) => T | false | null | undefined,
    argument: TArg,
    options: { timeout: number },
  ): Promise<PlaywrightHandlePort<T>>;
  evaluate<T, TArg>(
    callback: (argument: TArg) => T | Promise<T>,
    argument: TArg,
  ): Promise<T>;
  on(event: "close" | "crash", listener: () => void): void;
}

export interface PlaywrightContextPort {
  newPage(): Promise<PlaywrightPagePort>;
  close(options?: { reason?: string }): Promise<void>;
  on(event: "close", listener: () => void): void;
}

export interface PlaywrightBrowserPort {
  newContext(options: {
    acceptDownloads: false;
    reducedMotion: "reduce";
    viewport: { width: number; height: number };
  }): Promise<PlaywrightContextPort>;
  close(options?: { reason?: string }): Promise<void>;
  on(event: "disconnected", listener: () => void): void;
}

export type FoundryBrowserLauncher = (options: {
  headless: boolean;
}) => Promise<PlaywrightBrowserPort>;

type JoinOutcome = { kind: "ready" } | { kind: "error" };

interface FoundryReadyProbe {
  ready: boolean;
  view: unknown;
  userId: unknown;
  userName: unknown;
  moduleActive: boolean;
  designatedBridgeUserId: unknown;
}

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

function abortError(): Error {
  const error = new Error("Foundry connection was cancelled");
  error.name = "AbortError";
  return error;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function errorForTermination(
  termination: FoundryConnectionTermination,
): FoundryRunnerError {
  if (termination.kind === "page_crashed") {
    return new FoundryRunnerError(
      "page_crashed",
      "The Foundry browser page crashed while connecting.",
    );
  }
  if (termination.kind === "page_closed") {
    return new FoundryRunnerError(
      "page_closed",
      "The Foundry browser page closed while connecting.",
    );
  }
  return new FoundryRunnerError(
    "browser_closed",
    "The Foundry browser closed while connecting.",
  );
}

function createOperationGate(
  signal: AbortSignal,
  terminated: Promise<FoundryConnectionTermination>,
): {
  run<T>(operation: Promise<T>): Promise<T>;
  detach(): void;
} {
  let rejectAbort!: (error: Error) => void;
  const aborted = new Promise<never>((_resolve, reject) => {
    rejectAbort = reject;
  });
  // The gate may outlive its last guarded operation after a successful login.
  void aborted.catch(() => undefined);

  const onAbort = () => rejectAbort(abortError());
  if (signal.aborted) onAbort();
  else signal.addEventListener("abort", onAbort, { once: true });

  const unexpectedlyTerminated = terminated.then((termination) => {
    throw errorForTermination(termination);
  });
  void unexpectedlyTerminated.catch(() => undefined);

  return {
    run: <T>(operation: Promise<T>) =>
      Promise.race([operation, aborted, unexpectedlyTerminated]),
    detach: () => signal.removeEventListener("abort", onAbort),
  };
}

async function closeWithTimeout(
  operation: Promise<void>,
  resourceName: string,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Timed out closing Foundry ${resourceName}`));
    }, RESOURCE_CLOSE_TIMEOUT_MS);
    timer.unref();
  });

  try {
    await Promise.race([operation, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function closeResources(
  context: PlaywrightContextPort | null,
  browser: PlaywrightBrowserPort | null,
  reason: string,
): Promise<void> {
  let firstError: unknown;
  if (context) {
    try {
      await closeWithTimeout(context.close({ reason }), "context");
    } catch (error: unknown) {
      firstError = error;
    }
  }
  if (browser) {
    try {
      await closeWithTimeout(browser.close({ reason }), "browser");
    } catch (error: unknown) {
      firstError ??= error;
    }
  }
  if (firstError) throw firstError;
}

async function defaultBrowserLauncher(options: {
  headless: boolean;
}): Promise<PlaywrightBrowserPort> {
  // Keep Playwright external to the server bundle. It is a production runtime
  // dependency, while unit tests inject a lightweight browser port instead.
  const moduleName: string = "playwright";
  const playwrightModule = (await import(moduleName)) as {
    chromium?: {
      launch(launchOptions: {
        headless: boolean;
      }): Promise<PlaywrightBrowserPort>;
    };
  };
  if (!playwrightModule.chromium) {
    throw new Error("Playwright Chromium is unavailable");
  }
  return playwrightModule.chromium.launch(options);
}

async function waitForVisible(
  gate: ReturnType<typeof createOperationGate>,
  locator: PlaywrightLocatorPort,
  timeout: number,
): Promise<void> {
  await gate.run(locator.waitFor({ state: "visible", timeout }));
}

function normalizeUnexpectedError(
  error: unknown,
  code: "foundry_unreachable" | "join_form_missing" | "login_timeout",
  publicMessage: string,
): FoundryRunnerError | Error {
  if (error instanceof FoundryRunnerError) return error;
  if (isAbortError(error)) return error as Error;
  return new FoundryRunnerError(code, publicMessage, { cause: error });
}

export class PlaywrightFoundryConnector implements FoundryConnector {
  constructor(
    private readonly launchBrowser: FoundryBrowserLauncher =
      defaultBrowserLauncher,
  ) {}

  async connect(
    config: Readonly<FoundrySessionConfig>,
    signal: AbortSignal,
    onStage: (stage: "launching" | "opening" | "authenticating" | "verifying") => void,
  ): Promise<FoundryConnection> {
    let browser: PlaywrightBrowserPort | null = null;
    let context: PlaywrightContextPort | null = null;
    let closing = false;
    let closeTask: Promise<void> | null = null;
    const termination = createDeferred<FoundryConnectionTermination>();
    const terminate = (kind: FoundryConnectionTermination["kind"]) => {
      if (!closing) termination.resolve({ kind });
    };
    const gate = createOperationGate(signal, termination.promise);

    try {
      onStage("launching");
      const launchTask = this.launchBrowser({ headless: config.headless });
      try {
        browser = await gate.run(launchTask);
      } catch (error: unknown) {
        // Promise.race cannot cancel chromium.launch(). If cancellation wins,
        // claim and close a browser which resolves after this call unwinds.
        void launchTask
          .then((lateBrowser) =>
            closeResources(null, lateBrowser, "Foundry launch cancelled"),
          )
          .catch(() => undefined);
        if (error instanceof FoundryRunnerError || isAbortError(error)) throw error;
        throw new FoundryRunnerError(
          "browser_launch_failed",
          "The Foundry browser could not be started.",
          { cause: error },
        );
      }
      browser.on("disconnected", () => terminate("browser_closed"));

      context = await gate.run(
        browser.newContext({
          acceptDownloads: false,
          reducedMotion: "reduce",
          viewport: { width: 1280, height: 720 },
        }),
      );
      context.on("close", () => terminate("browser_closed"));
      const page = await gate.run(context.newPage());
      page.on("close", () => terminate("page_closed"));
      page.on("crash", () => terminate("page_crashed"));

      const actionTimeout = config.actionTimeoutMs ?? DEFAULT_ACTION_TIMEOUT_MS;
      const navigationTimeout =
        config.navigationTimeoutMs ?? DEFAULT_NAVIGATION_TIMEOUT_MS;
      const loginTimeout = config.loginTimeoutMs ?? DEFAULT_LOGIN_TIMEOUT_MS;
      page.setDefaultTimeout(actionTimeout);
      page.setDefaultNavigationTimeout(navigationTimeout);

      onStage("opening");
      let response: PlaywrightResponsePort | null;
      try {
        response = await gate.run(
          page.goto(config.worldUrl, {
            waitUntil: "domcontentloaded",
            timeout: navigationTimeout,
          }),
        );
      } catch (error: unknown) {
        throw normalizeUnexpectedError(
          error,
          "foundry_unreachable",
          "The Foundry world could not be reached.",
        );
      }
      if (response && response.status() >= 400) {
        throw new FoundryRunnerError(
          "foundry_unreachable",
          "The Foundry world did not return a usable join page.",
        );
      }
      let expectedOrigin: string;
      let finalOrigin: string;
      try {
        expectedOrigin = new URL(config.worldUrl).origin;
        finalOrigin = new URL(page.url()).origin;
      } catch (error: unknown) {
        throw new FoundryRunnerError(
          "foundry_unreachable",
          "The Foundry world returned an invalid address.",
          { cause: error },
        );
      }
      if (finalOrigin !== expectedOrigin) {
        throw new FoundryRunnerError(
          "foundry_unreachable",
          "The Foundry world redirected to an unexpected host.",
        );
      }

      const form = page.locator(FOUNDRY_JOIN_SELECTORS.form);
      const userSelect = form.locator(FOUNDRY_JOIN_SELECTORS.user);
      const accessKeyInput = form.locator(FOUNDRY_JOIN_SELECTORS.accessKey);
      try {
        await waitForVisible(gate, form, actionTimeout);
        await waitForVisible(gate, userSelect, actionTimeout);
      } catch (error: unknown) {
        throw normalizeUnexpectedError(
          error,
          "join_form_missing",
          "The Foundry join form was not available. Confirm that the world is running.",
        );
      }

      const matchingUsers = await gate.run(
        userSelect.locator("option").evaluateAll(
          (options, expectedName) =>
            options
              .map((option) => ({
                label: (option.textContent ?? "").trim(),
                value: (option as HTMLOptionElement).value,
              }))
              .filter((option) => option.label === expectedName),
          config.userName,
        ),
      );
      if (matchingUsers.length === 0) {
        throw new FoundryRunnerError(
          "user_not_found",
          "The configured Foundry system user was not present on the join page.",
        );
      }
      if (matchingUsers.length > 1) {
        throw new FoundryRunnerError(
          "user_ambiguous",
          "More than one Foundry user has the configured system-user name.",
        );
      }

      const expectedUserId = matchingUsers[0]?.value.trim() ?? "";
      if (!expectedUserId) {
        throw new FoundryRunnerError(
          "user_not_found",
          "The configured Foundry system user did not have a valid user ID.",
        );
      }

      onStage("authenticating");
      try {
        await waitForVisible(gate, accessKeyInput, actionTimeout);
        const selected = await gate.run(
          userSelect.selectOption({ value: expectedUserId }),
        );
        if (
          selected.length !== 1 ||
          selected[0] !== expectedUserId ||
          (await gate.run(userSelect.inputValue())) !== expectedUserId
        ) {
          throw new FoundryRunnerError(
            "wrong_user",
            "Foundry did not select the configured system user.",
          );
        }
        await gate.run(accessKeyInput.fill(config.accessKey));
      } catch (error: unknown) {
        if (error instanceof FoundryRunnerError || isAbortError(error)) throw error;
        throw new FoundryRunnerError(
          "join_form_missing",
          "The Foundry join form could not be completed.",
          { cause: error },
        );
      }

      let joinButton = form.locator(FOUNDRY_JOIN_SELECTORS.joinButton);
      let joinButtonCount = await gate.run(joinButton.count());
      if (joinButtonCount === 0) {
        joinButton = form.locator(FOUNDRY_JOIN_SELECTORS.submitButton);
        joinButtonCount = await gate.run(joinButton.count());
      }
      if (joinButtonCount !== 1) {
        throw new FoundryRunnerError(
          "join_form_missing",
          "The Foundry join button was not available.",
        );
      }

      const outcomePromise = page.waitForFunction<JoinOutcome, undefined>(
        () => {
          const scope = globalThis as typeof globalThis & {
            game?: { ready?: boolean };
          };
          if (scope.game?.ready === true) return { kind: "ready" };

          const errorSelectors = [
            "#notifications .notification.error",
            ".notification.error",
            '#join-game [role="alert"]',
            "#join-game .error",
          ];
          for (const selector of errorSelectors) {
            const element = document.querySelector(selector);
            const style = element ? getComputedStyle(element) : null;
            if (
              element &&
              (element.textContent ?? "").trim() !== "" &&
              style?.visibility !== "hidden" &&
              style?.display !== "none"
            ) {
              return { kind: "error" };
            }
          }
          return false;
        },
        undefined,
        { timeout: loginTimeout },
      );
      // Keep the pre-click watcher observed if clicking or cancellation fails.
      void outcomePromise.catch(() => undefined);
      try {
        await gate.run(joinButton.click());
      } catch (error: unknown) {
        throw normalizeUnexpectedError(
          error,
          "login_timeout",
          "Foundry did not accept the login request.",
        );
      }

      let outcomeHandle: PlaywrightHandlePort<JoinOutcome> | null = null;
      let outcome: JoinOutcome;
      try {
        outcomeHandle = await gate.run(outcomePromise);
        outcome = await gate.run(outcomeHandle.jsonValue());
      } catch (error: unknown) {
        throw normalizeUnexpectedError(
          error,
          "login_timeout",
          "Timed out waiting for the Foundry world to finish loading.",
        );
      } finally {
        if (outcomeHandle) await outcomeHandle.dispose().catch(() => undefined);
      }
      if (outcome.kind === "error") {
        throw new FoundryRunnerError(
          "login_rejected",
          "Foundry rejected the system-user login. Check its access key.",
        );
      }

      onStage("verifying");
      const probe = await gate.run(
        page.evaluate<FoundryReadyProbe, { moduleId: string; setting: string }>(
          ({ moduleId, setting }) => {
            const scope = globalThis as typeof globalThis & {
              game?: {
                ready?: boolean;
                view?: unknown;
                user?: { id?: unknown; name?: unknown };
                modules?: { get(id: string): { active?: boolean } | undefined };
                settings?: { get(module: string, key: string): unknown };
              };
            };
            const game = scope.game;
            let designatedBridgeUserId: unknown = null;
            try {
              designatedBridgeUserId = game?.settings?.get(moduleId, setting);
            } catch {
              designatedBridgeUserId = null;
            }
            return {
              ready: game?.ready === true,
              view: game?.view,
              userId: game?.user?.id,
              userName: game?.user?.name,
              moduleActive: game?.modules?.get(moduleId)?.active === true,
              designatedBridgeUserId,
            };
          },
          { moduleId: MODULE_ID, setting: BRIDGE_USER_SETTING },
        ),
      );

      if (
        !probe.ready ||
        probe.view !== "game" ||
        probe.userId !== expectedUserId ||
        probe.userName !== config.userName
      ) {
        throw new FoundryRunnerError(
          "wrong_user",
          "Foundry loaded without the configured system user.",
        );
      }
      if (!probe.moduleActive) {
        throw new FoundryRunnerError(
          "module_inactive",
          "The Spiritual Arts Foundry module is not active in this world.",
        );
      }
      if (probe.designatedBridgeUserId !== expectedUserId) {
        throw new FoundryRunnerError(
          "bridge_user_mismatch",
          "The Foundry module designates a different roll-bridge user.",
        );
      }

      gate.detach();
      const liveBrowser = browser;
      const liveContext = context;
      return {
        terminated: termination.promise,
        close: (reason: string) => {
          if (closeTask) return closeTask;
          closing = true;
          closeTask = closeResources(liveContext, liveBrowser, reason);
          return closeTask;
        },
      };
    } catch (error: unknown) {
      gate.detach();
      closing = true;
      await closeResources(context, browser, "Foundry connection failed").catch(
        () => undefined,
      );
      throw error;
    }
  }
}
