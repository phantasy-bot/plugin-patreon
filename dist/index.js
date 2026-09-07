// src/index.ts
import {
  BasePlugin
} from "@phantasy/agent/plugins";

// src/patreon-client.ts
var PatreonApiError = class extends Error {
  constructor(message, status, retryAfterSeconds) {
    super(message);
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
    this.name = "PatreonApiError";
  }
  status;
  retryAfterSeconds;
};
function asResourceArray(value) {
  return Array.isArray(value) ? value : [value];
}
function nextCursor(document) {
  const pagination = document.meta?.pagination;
  if (!pagination || typeof pagination !== "object") return void 0;
  const cursor = pagination.cursors;
  if (!cursor || typeof cursor !== "object") return void 0;
  const next = cursor.next;
  return typeof next === "string" && next ? next : void 0;
}
function addQuery(url, values) {
  for (const [key, value] of Object.entries(values)) {
    if (value !== void 0 && String(value).trim()) url.searchParams.set(key, String(value));
  }
}
var PatreonClient = class {
  constructor(config) {
    this.config = config;
  }
  config;
  async request(path, query = {}) {
    if (!this.config.accessToken) {
      throw new Error("PATREON_ACCESS_TOKEN is not configured");
    }
    const url = new URL(
      `${this.config.apiBaseUrl?.replace(/\/$/, "") || "https://www.patreon.com/api/oauth2/v2"}/${path.replace(/^\//, "")}`
    );
    addQuery(url, query);
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.config.accessToken}`,
        "User-Agent": this.config.userAgent || "phantasy-patreon-plugin/0.1.0-beta"
      }
    });
    const text = await response.text();
    let body = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text.slice(0, 500) };
    }
    if (!response.ok) {
      const retryHeader = response.headers.get("retry-after");
      const retryFromBody = body && typeof body === "object" && "retry_after_seconds" in body ? Number(body.retry_after_seconds) : void 0;
      const retryAfter = Number(retryHeader || retryFromBody);
      const detail = body && typeof body === "object" ? JSON.stringify(body).slice(0, 500) : String(body);
      throw new PatreonApiError(
        `Patreon API ${response.status}: ${detail}`,
        response.status,
        Number.isFinite(retryAfter) ? retryAfter : void 0
      );
    }
    return body;
  }
  async identity() {
    return this.request("identity", {
      "fields[user]": "full_name,vanity"
    });
  }
  async campaigns() {
    const document = await this.request("campaigns", {
      "fields[campaign]": "created_at,creation_name,image_url,name,patron_count,pledge_url,summary,url,vanity",
      include: "tiers",
      "fields[tier]": "amount_cents,description,patron_count,title",
      "page[count]": 100
    });
    return asResourceArray(document.data);
  }
  async campaign(campaignId2) {
    return this.request(`campaigns/${encodeURIComponent(campaignId2)}`, {
      "fields[campaign]": "created_at,creation_name,image_url,name,patron_count,pledge_url,summary,url,vanity",
      include: "tiers",
      "fields[tier]": "amount_cents,description,patron_count,title"
    });
  }
  async membersPage(options) {
    const document = await this.request(
      `campaigns/${encodeURIComponent(options.campaignId)}/members`,
      {
        "fields[member]": "currently_entitled_amount_cents,patron_status,pledge_relationship_start,last_charge_status,last_charge_date",
        "fields[user]": "full_name,vanity",
        include: "currently_entitled_tiers,user",
        "page[count]": options.count || 50,
        "page[cursor]": options.cursor
      }
    );
    return {
      data: asResourceArray(document.data),
      included: document.included || [],
      nextCursor: nextCursor(document)
    };
  }
  async postsPage(options) {
    const document = await this.request(
      `campaigns/${encodeURIComponent(options.campaignId)}/posts`,
      {
        "fields[post]": "content,created_at,edited_at,is_paid,is_public,published_at,title,url",
        "fields[tier]": "amount_cents,description,title",
        include: "tiers",
        "page[count]": options.count || 50,
        "page[cursor]": options.cursor
      }
    );
    return {
      data: asResourceArray(document.data),
      included: document.included || [],
      nextCursor: nextCursor(document)
    };
  }
  async member(memberId) {
    return this.request(`members/${encodeURIComponent(memberId)}`, {
      "fields[member]": "currently_entitled_amount_cents,patron_status,pledge_relationship_start,last_charge_status,last_charge_date",
      "fields[user]": "full_name,vanity",
      include: "currently_entitled_tiers,user"
    });
  }
};

// src/types.ts
function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function stringValue(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return void 0;
}
function numberValue(...values) {
  for (const value of values) {
    const number = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(number)) return number;
  }
  return void 0;
}
function getRuntimeEnv(context) {
  return context?.env || (typeof process !== "undefined" ? process.env : {});
}
function resolvePatreonConfig(pluginConfig, context) {
  const configured = asRecord(pluginConfig);
  const contextual = asRecord(context?.metadata?.pluginConfig);
  const env = getRuntimeEnv(context);
  const audience = stringValue(
    contextual.defaultAudience,
    configured.defaultAudience,
    env.PATREON_DEFAULT_AUDIENCE
  );
  return {
    enabled: configured.enabled !== false,
    accessToken: stringValue(
      contextual.accessToken,
      configured.accessToken,
      env.PATREON_ACCESS_TOKEN
    ),
    campaignId: stringValue(
      contextual.campaignId,
      configured.campaignId,
      env.PATREON_CAMPAIGN_ID
    ),
    apiBaseUrl: stringValue(contextual.apiBaseUrl, configured.apiBaseUrl) || "https://www.patreon.com/api/oauth2/v2",
    userAgent: stringValue(contextual.userAgent, configured.userAgent, env.PATREON_USER_AGENT) || "phantasy-patreon-plugin/0.1.0-beta",
    defaultAudience: audience === "members" || audience === "tiers" ? audience : "public",
    defaultTierId: stringValue(
      contextual.defaultTierId,
      configured.defaultTierId,
      env.PATREON_DEFAULT_TIER_ID
    ),
    maxPages: Math.min(
      100,
      Math.max(
        1,
        Math.round(
          numberValue(
            contextual.maxPages,
            configured.maxPages,
            env.PATREON_MAX_PAGES
          ) || 10
        )
      )
    )
  };
}
function requiredCampaignId(input, config) {
  const campaignId2 = stringValue(input.campaignId, config.campaignId);
  if (!campaignId2) {
    throw new Error(
      "Patreon campaignId is required (set PATREON_CAMPAIGN_ID or pass campaignId)"
    );
  }
  return campaignId2;
}
function boundedCount(value, fallback = 50) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.min(100, Math.max(1, Math.round(number))) : fallback;
}
function boundedPages(value, fallback) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.min(100, Math.max(1, Math.round(number))) : fallback;
}
function stringArray(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean) : [];
}

// src/patreon-tools.ts
function inputRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function resourceView(resource) {
  return {
    type: resource.type,
    id: resource.id,
    ...resource.attributes ? { attributes: resource.attributes } : {},
    ...resource.relationships ? { relationships: resource.relationships } : {}
  };
}
function pageView(page) {
  return {
    data: page.data.map(resourceView),
    included: page.included.map(resourceView),
    ...page.nextCursor ? { nextCursor: page.nextCursor } : {}
  };
}
function campaignId(host, input, context) {
  return requiredCampaignId(input, host.getSettings(context));
}
function campaignParams(host, input, context) {
  return { campaignId: campaignId(host, input, context) };
}
function createPatreonTools(host) {
  return [
    {
      name: "patreon_test_connection",
      description: "Verify the Patreon v2 token and list the creator's available campaigns.",
      access: { category: "read", risk: "safe" },
      parameters: { type: "object", properties: {} },
      handler: async (_input, context) => {
        const client = host.getClient(context);
        const [identity, campaigns] = await Promise.all([client.identity(), client.campaigns()]);
        return {
          connected: true,
          identity: resourceView(identity.data),
          campaigns: campaigns.map(resourceView)
        };
      }
    },
    {
      name: "patreon_get_campaign",
      description: "Read campaign metadata and tiers from Patreon API v2.",
      access: { category: "read", risk: "safe" },
      parameters: {
        type: "object",
        properties: { campaignId: { type: "string", description: "Patreon campaign id." } }
      },
      handler: async (value, context) => {
        const input = inputRecord(value);
        const document = await host.getClient(context).campaign(campaignId(host, input, context));
        return {
          data: resourceView(document.data),
          included: (document.included || []).map(resourceView)
        };
      }
    },
    {
      name: "patreon_list_members",
      description: "List Patreon members and current entitlement status without requesting member email addresses.",
      access: { category: "read", risk: "safe" },
      parameters: {
        type: "object",
        properties: {
          campaignId: { type: "string" },
          cursor: { type: "string" },
          pageSize: { type: "number", default: 50 }
        }
      },
      handler: async (value, context) => {
        const input = inputRecord(value);
        const page = await host.getClient(context).membersPage({
          ...campaignParams(host, input, context),
          cursor: typeof input.cursor === "string" ? input.cursor : void 0,
          count: boundedCount(input.pageSize)
        });
        return pageView(page);
      }
    },
    {
      name: "patreon_get_member_access",
      description: "Read one Patreon member's current patron status and entitled tiers.",
      access: { category: "read", risk: "safe" },
      parameters: {
        type: "object",
        required: ["memberId"],
        properties: { memberId: { type: "string" } }
      },
      handler: async (value, context) => {
        const input = inputRecord(value);
        const memberId = typeof input.memberId === "string" ? input.memberId.trim() : "";
        if (!memberId) throw new Error("memberId is required");
        const document = await host.getClient(context).member(memberId);
        return {
          data: resourceView(document.data),
          included: (document.included || []).map(resourceView)
        };
      }
    },
    {
      name: "patreon_list_posts",
      description: "List Patreon posts with public/paid flags and tier relationships.",
      access: { category: "read", risk: "safe" },
      parameters: {
        type: "object",
        properties: {
          campaignId: { type: "string" },
          cursor: { type: "string" },
          pageSize: { type: "number", default: 50 }
        }
      },
      handler: async (value, context) => {
        const input = inputRecord(value);
        const page = await host.getClient(context).postsPage({
          ...campaignParams(host, input, context),
          cursor: typeof input.cursor === "string" ? input.cursor : void 0,
          count: boundedCount(input.pageSize)
        });
        return pageView(page);
      }
    },
    {
      name: "patreon_sync_audience",
      description: "Read a bounded set of Patreon member pages and summarize active, former, and entitled audiences.",
      access: { category: "read", risk: "safe" },
      parameters: {
        type: "object",
        properties: {
          campaignId: { type: "string" },
          pageSize: { type: "number", default: 100 },
          maxPages: { type: "number", default: 10 }
        }
      },
      handler: async (value, context) => {
        const input = inputRecord(value);
        const settings = host.getSettings(context);
        let cursor;
        let pages = 0;
        let members = 0;
        const statuses = {};
        const entitledTierIds = /* @__PURE__ */ new Set();
        do {
          const page = await host.getClient(context).membersPage({
            ...campaignParams(host, input, context),
            cursor,
            count: boundedCount(input.pageSize, 100)
          });
          pages += 1;
          members += page.data.length;
          for (const member of page.data) {
            const status = String(member.attributes?.patron_status || "unknown");
            statuses[status] = (statuses[status] || 0) + 1;
            const tiers = member.relationships?.currently_entitled_tiers?.data;
            for (const tier of Array.isArray(tiers) ? tiers : tiers ? [tiers] : []) {
              entitledTierIds.add(tier.id);
            }
          }
          cursor = page.nextCursor;
        } while (cursor && pages < boundedPages(input.maxPages, settings.maxPages || 10));
        return {
          campaignId: campaignId(host, input, context),
          pages,
          members,
          statuses,
          entitledTierIds: [...entitledTierIds],
          complete: !cursor,
          nextCursor: cursor
        };
      }
    },
    {
      name: "patreon_create_post_plan",
      description: "Prepare a free or paid Patreon post payload for operator review. Current Patreon v2 docs do not expose a documented post-create endpoint, so this tool never publishes.",
      access: { category: "write", risk: "caution" },
      parameters: {
        type: "object",
        required: ["title", "content"],
        properties: {
          title: { type: "string" },
          content: { type: "string" },
          audience: { type: "string", enum: ["public", "members", "tiers"] },
          tierIds: { type: "array", items: { type: "string" } },
          isPaid: { type: "boolean", default: false },
          mediaUrls: { type: "array", items: { type: "string" } }
        }
      },
      handler: async (value, context) => {
        const input = inputRecord(value);
        const settings = host.getSettings(context);
        const title = typeof input.title === "string" ? input.title.trim() : "";
        const content = typeof input.content === "string" ? input.content.trim() : "";
        if (!title || !content) throw new Error("title and content are required");
        const audience = input.audience === "members" || input.audience === "tiers" ? input.audience : input.audience === "public" ? "public" : settings.defaultAudience || "public";
        const tierIds = stringArray(input.tierIds);
        if (audience === "tiers" && tierIds.length === 0 && settings.defaultTierId) {
          tierIds.push(settings.defaultTierId);
        }
        if (audience === "tiers" && tierIds.length === 0) {
          throw new Error("tierIds or PATREON_DEFAULT_TIER_ID is required for tiers audience");
        }
        return {
          publishable: false,
          reason: "Patreon API v2 currently documents post reads/webhooks but no post-create endpoint; review this plan and publish through Patreon until an official write endpoint is available.",
          payload: {
            title,
            content,
            is_public: audience === "public",
            is_paid: input.isPaid === true,
            ...tierIds.length ? { tier_ids: tierIds } : {},
            ...stringArray(input.mediaUrls).length ? { media_urls: stringArray(input.mediaUrls) } : {}
          }
        };
      }
    }
  ];
}

// src/index.ts
var PatreonPlugin = class extends BasePlugin {
  name = "patreon";
  version = "0.1.0-beta";
  description = "Patreon API v2 audience sync, entitlement reads, and reviewed free/paid post plans for Phantasy creator companions.";
  author = "Phantasy";
  homepage = "https://www.patreon.com/portal/registration/register-clients";
  repository = "https://github.com/phantasy-bot/plugin-patreon";
  license = "MIT";
  displayName = "Patreon";
  category = "creator-business";
  tags = ["patreon", "creator", "members", "tiers", "publishing"];
  permissions = ["internet"];
  workspace = "business";
  extensionKind = "integration";
  configSchema = {
    type: "object",
    properties: {
      enabled: { type: "boolean", default: true },
      campaignId: { type: "string", description: "Default Patreon campaign id." },
      defaultAudience: {
        type: "string",
        enum: ["public", "members", "tiers"],
        default: "public"
      },
      defaultTierId: { type: "string", description: "Default tier for tier-only plans." },
      maxPages: { type: "number", default: 10 }
    }
  };
  dataRetention = {
    stores: [
      {
        name: "patreonConnectionConfig",
        kind: "config",
        description: "Campaign and publishing defaults; access tokens remain environment-managed.",
        erasable: false
      }
    ],
    dataCategories: [
      "campaign and tier metadata",
      "member entitlement metadata in transient tool results",
      "post metadata in transient tool results"
    ],
    externalServices: ["www.patreon.com"],
    retentionDefault: "persist",
    erasable: false
  };
  async onInit(agentConfig, config) {
    await super.onInit(agentConfig, config);
  }
  getSettings(context) {
    return resolvePatreonConfig(this.getConfig(), context);
  }
  getClient(context) {
    return new PatreonClient(this.getSettings(context));
  }
  getTools() {
    return createPatreonTools(this);
  }
  getManifest() {
    return {
      ...super.getManifest(),
      capabilities: ["patreon.api", "patreon.audience", "patreon.post-planning"],
      supportedHooks: []
    };
  }
  async healthCheck() {
    const settings = this.getSettings();
    return settings.accessToken ? { status: "healthy", message: "Patreon v2 access token is configured." } : { status: "unhealthy", message: "PATREON_ACCESS_TOKEN is not configured." };
  }
};
var index_default = PatreonPlugin;
export {
  PatreonApiError,
  PatreonClient,
  PatreonPlugin,
  index_default as default
};
//# sourceMappingURL=index.js.map