import type { PluginConfig, PluginContext } from "@phantasy/agent/plugins";

export type PatreonAudience = "public" | "members" | "tiers";

export interface PatreonPluginConfig extends PluginConfig {
  accessToken?: string;
  campaignId?: string;
  apiBaseUrl?: string;
  userAgent?: string;
  defaultAudience?: PatreonAudience;
  defaultTierId?: string;
  maxPages?: number;
}

export type RuntimeEnv = Record<string, string | undefined>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function numberValue(...values: unknown[]): number | undefined {
  for (const value of values) {
    const number = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(number)) return number;
  }
  return undefined;
}

export function getRuntimeEnv(context?: PluginContext): RuntimeEnv {
  return context?.env || (typeof process !== "undefined" ? process.env : {});
}

export function resolvePatreonConfig(
  pluginConfig: PluginConfig,
  context?: PluginContext,
): PatreonPluginConfig {
  const configured = asRecord(pluginConfig);
  const contextual = asRecord(context?.metadata?.pluginConfig);
  const env = getRuntimeEnv(context);

  const audience = stringValue(
    contextual.defaultAudience,
    configured.defaultAudience,
    env.PATREON_DEFAULT_AUDIENCE,
  );

  return {
    enabled: configured.enabled !== false,
    accessToken: stringValue(
      contextual.accessToken,
      configured.accessToken,
      env.PATREON_ACCESS_TOKEN,
    ),
    campaignId: stringValue(
      contextual.campaignId,
      configured.campaignId,
      env.PATREON_CAMPAIGN_ID,
    ),
    apiBaseUrl:
      stringValue(contextual.apiBaseUrl, configured.apiBaseUrl) ||
      "https://www.patreon.com/api/oauth2/v2",
    userAgent:
      stringValue(contextual.userAgent, configured.userAgent, env.PATREON_USER_AGENT) ||
      "phantasy-patreon-plugin/0.1.0-beta",
    defaultAudience:
      audience === "members" || audience === "tiers" ? audience : "public",
    defaultTierId: stringValue(
      contextual.defaultTierId,
      configured.defaultTierId,
      env.PATREON_DEFAULT_TIER_ID,
    ),
    maxPages: Math.min(
      100,
      Math.max(
        1,
        Math.round(
          numberValue(
            contextual.maxPages,
            configured.maxPages,
            env.PATREON_MAX_PAGES,
          ) || 10,
        ),
      ),
    ),
  };
}

export function requiredCampaignId(
  input: Record<string, unknown>,
  config: PatreonPluginConfig,
): string {
  const campaignId = stringValue(input.campaignId, config.campaignId);
  if (!campaignId) {
    throw new Error(
      "Patreon campaignId is required (set PATREON_CAMPAIGN_ID or pass campaignId)",
    );
  }
  return campaignId;
}

export function boundedCount(value: unknown, fallback = 50): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.min(100, Math.max(1, Math.round(number))) : fallback;
}

export function boundedPages(value: unknown, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.min(100, Math.max(1, Math.round(number))) : fallback;
}

export function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
}
