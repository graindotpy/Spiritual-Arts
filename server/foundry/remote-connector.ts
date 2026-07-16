import type { FoundryAgentHub } from "./agent-hub";
import {
  FoundryRunnerError,
  type AgentFoundrySessionConfig,
  type FoundryConnection,
  type FoundryConnectionStage,
  type FoundryConnector,
  type FoundrySessionConfig,
} from "./types";

function requireAgentConfig(
  config: Readonly<FoundrySessionConfig>,
): asserts config is Readonly<AgentFoundrySessionConfig> {
  if (config.mode !== "agent") {
    throw new FoundryRunnerError(
      "startup_failed",
      "The remote Foundry connector received local browser configuration.",
    );
  }
}

export class RemoteFoundryConnector implements FoundryConnector {
  constructor(private readonly hub: FoundryAgentHub) {}

  available(): boolean {
    return this.hub.available();
  }

  connect(
    config: Readonly<FoundrySessionConfig>,
    signal: AbortSignal,
    onStage: (stage: FoundryConnectionStage) => void,
  ): Promise<FoundryConnection> {
    requireAgentConfig(config);
    return this.hub.startSession({
      expectedBridgeUser: config.userName,
      expiresAt: new Date(Date.now() + config.maxSessionMs).toISOString(),
      signal,
      onStage,
    });
  }
}
