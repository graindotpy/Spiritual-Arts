export interface FoundryRollPayload {
  character: {
    id: string;
    name: string;
    path: string | null;
    level: number;
    portraitUrl: string | null;
  };
  roll: {
    spInvestment: number;
    dieSize: string;
    dieIndex: number;
    value: number;
    success: boolean;
    techniqueId: string | null;
    techniqueName: string | null;
    timestamp: string;
  };
  source: "spiritual-arts";
  version: 1;
}

function isFoundryEnabled() {
  const enabledFlag = process.env.FOUNDRY_ENABLED;
  if (!enabledFlag) return true;
  return enabledFlag.toLowerCase() === "true";
}

export async function sendFoundryWebhook(payload: FoundryRollPayload) {
  if (!isFoundryEnabled()) return;

  const webhookUrl = process.env.FOUNDRY_WEBHOOK_URL;
  if (!webhookUrl) return;

  const webhookToken = process.env.FOUNDRY_WEBHOOK_TOKEN;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (webhookToken) {
    headers.Authorization = `Bearer ${webhookToken}`;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(2500),
    });
  } catch (error) {
    console.error("Foundry webhook error:", error);
  }
}
