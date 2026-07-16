import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FOUNDRY_JOIN_SELECTORS,
  PlaywrightFoundryConnector,
  type PlaywrightBrowserPort,
  type PlaywrightContextPort,
  type PlaywrightHandlePort,
  type PlaywrightLocatorPort,
  type PlaywrightPagePort,
  type PlaywrightResponsePort,
} from "./playwright-runner";
import {
  FoundryRunnerError,
  type FoundryConnectionStage,
  type FoundrySessionConfig,
} from "./types";

const config: FoundrySessionConfig = {
  worldUrl: "https://foundry.example.test/join",
  userName: "Spiritual Arts Bridge",
  accessKey: "bridge-access-key",
  maxSessionMs: 60_000,
  headless: true,
  disableCanvas: true,
  actionTimeoutMs: 25,
  navigationTimeoutMs: 50,
  loginTimeoutMs: 75,
};

class FakeHandle<T> implements PlaywrightHandlePort<T> {
  disposed = false;

  constructor(private readonly value: T) {}

  async jsonValue(): Promise<T> {
    return this.value;
  }

  async dispose(): Promise<void> {
    this.disposed = true;
  }
}

class FakeLocator implements PlaywrightLocatorPort {
  readonly children = new Map<string, FakeLocator>();
  readonly elements: Element[] = [];
  countValue = 1;
  visible = true;
  selectedValue = "";
  filledValue: string | null = null;
  clickCalls = 0;

  locator(selector: string): FakeLocator {
    const child = this.children.get(selector);
    if (!child) throw new Error(`Unexpected nested selector: ${selector}`);
    return child;
  }

  async count(): Promise<number> {
    return this.countValue;
  }

  async waitFor(): Promise<void> {
    if (!this.visible) throw new Error("locator was not visible");
  }

  async evaluateAll<T, TArg>(
    callback: (elements: Element[], argument: TArg) => T,
    argument: TArg,
  ): Promise<T> {
    return callback(this.elements, argument);
  }

  async selectOption(option: { value: string }): Promise<string[]> {
    this.selectedValue = option.value;
    return [option.value];
  }

  async inputValue(): Promise<string> {
    return this.selectedValue;
  }

  async fill(value: string): Promise<void> {
    this.filledValue = value;
  }

  async click(): Promise<void> {
    this.clickCalls += 1;
  }
}

interface Probe {
  ready: boolean;
  view: unknown;
  userId: unknown;
  userName: unknown;
  moduleActive: boolean;
  designatedBridgeUserId: unknown;
}

class FakePage implements PlaywrightPagePort {
  readonly events = new Map<"close" | "crash", () => void>();
  actionTimeout = 0;
  navigationTimeout = 0;
  gotoUrl: string | null = null;
  finalUrl = config.worldUrl;
  responseStatus = 200;
  outcome: { kind: "ready" } | { kind: "error" } = { kind: "ready" };
  probe: Probe;
  outcomeHandle: FakeHandle<{ kind: "ready" } | { kind: "error" }> | null = null;

  constructor(readonly form: FakeLocator, expectedUserId: string) {
    this.probe = {
      ready: true,
      view: "game",
      userId: expectedUserId,
      userName: config.userName,
      moduleActive: true,
      designatedBridgeUserId: expectedUserId,
    };
  }

  setDefaultTimeout(timeoutMs: number): void {
    this.actionTimeout = timeoutMs;
  }

  setDefaultNavigationTimeout(timeoutMs: number): void {
    this.navigationTimeout = timeoutMs;
  }

  async goto(url: string): Promise<PlaywrightResponsePort> {
    this.gotoUrl = url;
    return { status: () => this.responseStatus };
  }

  url(): string {
    return this.finalUrl;
  }

  locator(selector: string): PlaywrightLocatorPort {
    if (selector !== FOUNDRY_JOIN_SELECTORS.form) {
      throw new Error(`Unexpected page selector: ${selector}`);
    }
    return this.form;
  }

  async waitForFunction<T>(): Promise<PlaywrightHandlePort<T>> {
    this.outcomeHandle = new FakeHandle(this.outcome);
    return this.outcomeHandle as PlaywrightHandlePort<T>;
  }

  async evaluate<T>(): Promise<T> {
    return this.probe as T;
  }

  on(event: "close" | "crash", listener: () => void): void {
    this.events.set(event, listener);
  }

  emit(event: "close" | "crash"): void {
    this.events.get(event)?.();
  }
}

class FakeContext implements PlaywrightContextPort {
  private closeListener: (() => void) | undefined;
  readonly initScripts: Array<() => void> = [];

  constructor(
    private readonly page: FakePage,
    private readonly closeOrder: string[],
  ) {}

  async addInitScript(script: () => void): Promise<void> {
    this.initScripts.push(script);
  }

  async newPage(): Promise<PlaywrightPagePort> {
    return this.page;
  }

  async close(): Promise<void> {
    this.closeOrder.push("context");
    this.closeListener?.();
  }

  on(_event: "close", listener: () => void): void {
    this.closeListener = listener;
  }
}

class FakeBrowser implements PlaywrightBrowserPort {
  private disconnectedListener: (() => void) | undefined;
  readonly context: FakeContext;
  launchContextOptions: unknown;

  constructor(
    page: FakePage,
    private readonly closeOrder: string[],
  ) {
    this.context = new FakeContext(page, closeOrder);
  }

  async newContext(options: unknown): Promise<PlaywrightContextPort> {
    this.launchContextOptions = options;
    return this.context;
  }

  async close(): Promise<void> {
    this.closeOrder.push("browser");
    this.disconnectedListener?.();
  }

  on(_event: "disconnected", listener: () => void): void {
    this.disconnectedListener = listener;
  }

  disconnectUnexpectedly(): void {
    this.disconnectedListener?.();
  }
}

function option(label: string, value: string): Element {
  return { textContent: label, value } as unknown as Element;
}

function createFixture(options: {
  users?: Array<{ label: string; value: string }>;
  primaryButtonCount?: number;
} = {}) {
  const expectedUserId = "bridge-user-id";
  const form = new FakeLocator();
  const user = new FakeLocator();
  const optionsLocator = new FakeLocator();
  const accessKey = new FakeLocator();
  const join = new FakeLocator();
  const submit = new FakeLocator();
  join.countValue = options.primaryButtonCount ?? 1;
  submit.countValue = 1;
  optionsLocator.elements.push(
    ...(options.users ?? [
      { label: "Another Player", value: "other-id" },
      { label: `  ${config.userName}  `, value: expectedUserId },
    ]).map((userOption) => option(userOption.label, userOption.value)),
  );
  user.children.set("option", optionsLocator);
  form.children.set(FOUNDRY_JOIN_SELECTORS.user, user);
  form.children.set(FOUNDRY_JOIN_SELECTORS.accessKey, accessKey);
  form.children.set(FOUNDRY_JOIN_SELECTORS.joinButton, join);
  form.children.set(FOUNDRY_JOIN_SELECTORS.submitButton, submit);

  const page = new FakePage(form, expectedUserId);
  const closeOrder: string[] = [];
  const browser = new FakeBrowser(page, closeOrder);
  let launchOptions: { headless: boolean } | undefined;
  const connector = new PlaywrightFoundryConnector(async (options) => {
    launchOptions = options;
    return browser;
  });
  return {
    expectedUserId,
    connector,
    browser,
    page,
    user,
    accessKey,
    join,
    submit,
    closeOrder,
    get launchOptions() {
      return launchOptions;
    },
  };
}

async function connectFixture(fixture: ReturnType<typeof createFixture>) {
  const stages: FoundryConnectionStage[] = [];
  const connection = await fixture.connector.connect(
    config,
    new AbortController().signal,
    (stage) => stages.push(stage),
  );
  return { connection, stages };
}

test("supports current and legacy Foundry join form IDs", () => {
  assert.deepEqual(
    FOUNDRY_JOIN_SELECTORS.form.split(",").map((selector) => selector.trim()),
    ["form#join-game-form", "form#join-game"],
  );
});

test("selects the exact user, logs in, verifies Foundry, and closes in order", async () => {
  const fixture = createFixture();
  const { connection, stages } = await connectFixture(fixture);

  assert.deepEqual(stages, [
    "launching",
    "opening",
    "authenticating",
    "verifying",
  ]);
  assert.deepEqual(fixture.launchOptions, { headless: true });
  assert.deepEqual(fixture.browser.launchContextOptions, {
    acceptDownloads: false,
    reducedMotion: "reduce",
    viewport: { width: 1366, height: 768 },
  });
  assert.equal(fixture.browser.context.initScripts.length, 1);
  const stored = new Map<string, string>();
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { setItem: (key: string, value: string) => stored.set(key, value) },
  });
  try {
    fixture.browser.context.initScripts[0]?.();
  } finally {
    if (originalStorage) {
      Object.defineProperty(globalThis, "localStorage", originalStorage);
    } else {
      Reflect.deleteProperty(globalThis, "localStorage");
    }
  }
  assert.equal(stored.get("core.noCanvas"), "true");
  assert.equal(fixture.page.gotoUrl, config.worldUrl);
  assert.equal(fixture.page.actionTimeout, config.actionTimeoutMs);
  assert.equal(fixture.page.navigationTimeout, config.navigationTimeoutMs);
  assert.equal(fixture.user.selectedValue, fixture.expectedUserId);
  assert.equal(fixture.accessKey.filledValue, config.accessKey);
  assert.equal(fixture.join.clickCalls, 1);
  assert.equal(fixture.page.outcomeHandle?.disposed, true);

  await connection.close("requested");
  await connection.close("requested again");
  assert.deepEqual(fixture.closeOrder, ["context", "browser"]);
});

test("uses the submit-button fallback when Foundry omits the named button", async () => {
  const fixture = createFixture({ primaryButtonCount: 0 });
  const { connection } = await connectFixture(fixture);
  assert.equal(fixture.join.clickCalls, 0);
  assert.equal(fixture.submit.clickCalls, 1);
  await connection.close("requested");
});

test("rejects a missing or duplicate exact username before filling the key", async (t) => {
  await t.test("missing", async () => {
    const fixture = createFixture({
      users: [{ label: "Someone Else", value: "other" }],
    });
    await assert.rejects(
      connectFixture(fixture),
      (error: unknown) =>
        error instanceof FoundryRunnerError && error.code === "user_not_found",
    );
    assert.equal(fixture.accessKey.filledValue, null);
    assert.equal(fixture.join.clickCalls, 0);
    assert.deepEqual(fixture.closeOrder, ["context", "browser"]);
  });

  await t.test("duplicate", async () => {
    const fixture = createFixture({
      users: [
        { label: config.userName, value: "first" },
        { label: ` ${config.userName} `, value: "second" },
      ],
    });
    await assert.rejects(
      connectFixture(fixture),
      (error: unknown) =>
        error instanceof FoundryRunnerError && error.code === "user_ambiguous",
    );
    assert.equal(fixture.accessKey.filledValue, null);
  });
});

test("maps a visible Foundry login error to a curated rejection", async () => {
  const fixture = createFixture();
  fixture.page.outcome = { kind: "error" };

  await assert.rejects(
    connectFixture(fixture),
    (error: unknown) =>
      error instanceof FoundryRunnerError &&
      error.code === "login_rejected" &&
      !error.publicMessage.includes(config.accessKey),
  );
  assert.deepEqual(fixture.closeOrder, ["context", "browser"]);
});

test("requires the active module and its exact designated bridge user", async (t) => {
  await t.test("inactive module", async () => {
    const fixture = createFixture();
    fixture.page.probe.moduleActive = false;
    await assert.rejects(
      connectFixture(fixture),
      (error: unknown) =>
        error instanceof FoundryRunnerError && error.code === "module_inactive",
    );
  });

  await t.test("different designated user", async () => {
    const fixture = createFixture();
    fixture.page.probe.designatedBridgeUserId = "someone-else";
    await assert.rejects(
      connectFixture(fixture),
      (error: unknown) =>
        error instanceof FoundryRunnerError &&
        error.code === "bridge_user_mismatch",
    );
  });

  await t.test("wrong loaded identity", async () => {
    const fixture = createFixture();
    fixture.page.probe.userId = "someone-else";
    await assert.rejects(
      connectFixture(fixture),
      (error: unknown) =>
        error instanceof FoundryRunnerError && error.code === "wrong_user",
    );
  });
});

test("reports an unexpected live page crash through the connection", async () => {
  const fixture = createFixture();
  const { connection } = await connectFixture(fixture);
  fixture.page.emit("crash");
  assert.deepEqual(await connection.terminated, { kind: "page_crashed" });
  await connection.close("page_crashed");
});

test("maps an unsuccessful join-page response without touching credentials", async () => {
  const fixture = createFixture();
  fixture.page.responseStatus = 503;
  await assert.rejects(
    connectFixture(fixture),
    (error: unknown) =>
      error instanceof FoundryRunnerError &&
      error.code === "foundry_unreachable",
  );
  assert.equal(fixture.accessKey.filledValue, null);
});

test("does not send the access key after a cross-origin redirect", async () => {
  const fixture = createFixture();
  fixture.page.finalUrl = "https://unexpected.example.test/fake-join";
  await assert.rejects(
    connectFixture(fixture),
    (error: unknown) =>
      error instanceof FoundryRunnerError &&
      error.code === "foundry_unreachable",
  );
  assert.equal(fixture.accessKey.filledValue, null);
  assert.equal(fixture.join.clickCalls, 0);
});

test("an abort during a delayed launch closes Chromium if it arrives late", async () => {
  let resolveLaunch!: (browser: PlaywrightBrowserPort) => void;
  const delayedLaunch = new Promise<PlaywrightBrowserPort>((resolve) => {
    resolveLaunch = resolve;
  });
  const fixture = createFixture();
  const connector = new PlaywrightFoundryConnector(() => delayedLaunch);
  const abortController = new AbortController();
  const connecting = connector.connect(
    config,
    abortController.signal,
    () => undefined,
  );

  abortController.abort();
  await assert.rejects(
    connecting,
    (error: unknown) => error instanceof Error && error.name === "AbortError",
  );
  resolveLaunch(fixture.browser);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(fixture.closeOrder, ["browser"]);
});
