import {
  BasePlugin,
  type ConfigSchema,
  type PluginConfig,
  type PluginContext,
  type PluginManifest,
  type PluginTool,
} from "@phantasy/agent/plugins";
import { PatreonClient } from "./patreon-client.js";
import { createPatreonTools, type PatreonToolHost } from "./patreon-tools.js";
import { resolvePatreonConfig, type PatreonPluginConfig } from "./types.js";

export class PatreonPlugin extends BasePlugin implements PatreonToolHost {
  name = "patreon";
  version = "0.1.0-beta";
  description =
    "Patreon API v2 audience sync, entitlement reads, and reviewed free/paid post plans for Phantasy creator companions.";

  protected author = "Phantasy";
  protected homepage = "https://www.patreon.com/portal/registration/register-clients";
  protected repository = "https://github.com/phantasy-bot/plugin-patreon";
  protected license = "MIT";
  protected displayName = "Patreon";
  protected category = "creator-business";
  protected tags = ["patreon", "creator", "members", "tiers", "publishing"];
  protected permissions = ["internet"];
  protected workspace = "business" as const;
  protected extensionKind = "integration" as const;
  protected configSchema: ConfigSchema = {
    type: "object",
    properties: {
      enabled: { type: "boolean", default: true },
      campaignId: { type: "string", description: "Default Patreon campaign id." },
      defaultAudience: {
        type: "string",
        enum: ["public", "members", "tiers"],
        default: "public",
      },
      defaultTierId: { type: "string", description: "Default tier for tier-only plans." },
      maxPages: { type: "number", default: 10 },
    },
  };
  protected dataRetention = {
    stores: [
      {
        name: "patreonConnectionConfig",
        kind: "config" as const,
        description: "Campaign and publishing defaults; access tokens remain environment-managed.",
        erasable: false,
      },
    ],
    dataCategories: [
      "campaign and tier metadata",
      "member entitlement metadata in transient tool results",
      "post metadata in transient tool results",
    ],
    externalServices: ["www.patreon.com"],
    retentionDefault: "persist" as const,
    erasable: false,
  };

  async onInit(
    agentConfig: Parameters<BasePlugin["onInit"]>[0],
    config?: PluginConfig,
  ): Promise<void> {
    await super.onInit(agentConfig, config);
  }

  getSettings(context?: PluginContext): PatreonPluginConfig {
    return resolvePatreonConfig(this.getConfig(), context);
  }

  getClient(context?: PluginContext): PatreonClient {
    return new PatreonClient(this.getSettings(context));
  }

  getTools(): PluginTool[] {
    return createPatreonTools(this);
  }

  getManifest(): PluginManifest {
    return {
      ...super.getManifest(),
      capabilities: ["patreon.api", "patreon.audience", "patreon.post-planning"],
      supportedHooks: [],
    };
  }

  async healthCheck(): Promise<{ status: "healthy" | "unhealthy"; message?: string }> {
    const settings = this.getSettings();
    return settings.accessToken
      ? { status: "healthy", message: "Patreon v2 access token is configured." }
      : { status: "unhealthy", message: "PATREON_ACCESS_TOKEN is not configured." };
  }
}

export default PatreonPlugin;

export type {
  PatreonAudience,
  PatreonPluginConfig,
} from "./types.js";
export type { PatreonResource, PatreonDocument, PatreonPage } from "./patreon-client.js";
export { PatreonApiError, PatreonClient } from "./patreon-client.js";
