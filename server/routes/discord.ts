export interface DiscordSpiritRoll {
  characterName: string;
  techniqueName: string | null;
  spInvestment: number;
  dieSize: string;
  value: number;
  success: boolean;
  portraitUrl: string | null;
}

function resolvePublicImageUrl(portraitUrl: string | null): string | undefined {
  if (!portraitUrl) return undefined;

  try {
    const absolute = new URL(portraitUrl);
    return ["http:", "https:"].includes(absolute.protocol)
      ? absolute.toString()
      : undefined;
  } catch {
    const baseUrl = process.env.APP_PUBLIC_BASE_URL?.trim();
    if (!baseUrl) return undefined;
    try {
      const absolute = new URL(portraitUrl, `${baseUrl.replace(/\/+$/, "")}/`);
      return ["http:", "https:"].includes(absolute.protocol)
        ? absolute.toString()
        : undefined;
    } catch {
      return undefined;
    }
  }
}

export async function sendDiscordSpiritRoll(payload: DiscordSpiritRoll): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!webhookUrl) return;

  const technique = payload.techniqueName ?? "Unknown Technique";
  const result = payload.success ? "Success" : "Failed";
  const portraitUrl = resolvePublicImageUrl(payload.portraitUrl);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: payload.characterName.slice(0, 256),
            description: `**${technique}** — ${payload.spInvestment} SP\nResult: **${payload.value}** (${payload.dieSize}) — ${result}`.slice(0, 4_096),
            color: payload.success ? 0x2ecc71 : 0xe74c3c,
            timestamp: new Date().toISOString(),
            ...(portraitUrl ? { image: { url: portraitUrl } } : {}),
          },
        ],
      }),
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      console.error(`Discord webhook returned HTTP ${response.status}`);
    }
  } catch (error) {
    console.error("Discord webhook error:", error);
  }
}
