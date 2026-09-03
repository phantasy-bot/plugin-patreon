import type { PluginContext, PluginTool } from "@phantasy/agent/plugins";
import type { PatreonClient, PatreonResource } from "./patreon-client.js";
import {
  boundedCount,
  boundedPages,
  requiredCampaignId,
  stringArray,
  type PatreonAudience,
  type PatreonPluginConfig,
} from "./types.js";

type Input = Record<string, unknown>;

export interface PatreonToolHost {
  getClient(context?: PluginContext): PatreonClient;
  getSettings(context?: PluginContext): PatreonPluginConfig;
}

function inputRecord(value: unknown): Input {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Input)
    : {};
}

function resourceView(resource: PatreonResource): Record<string, unknown> {
  return {
    type: resource.type,
    id: resource.id,
    ...(resource.attributes ? { attributes: resource.attributes } : {}),
    ...(resource.relationships ? { relationships: resource.relationships } : {}),
  };
}

function pageView(page: { data: PatreonResource[]; included: PatreonResource[]; nextCursor?: string }) {
  return {
    data: page.data.map(resourceView),
    included: page.included.map(resourceView),
    ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
  };
}

function campaignId(host: PatreonToolHost, input: Input, context?: PluginContext): string {
  return requiredCampaignId(input, host.getSettings(context));
}

function campaignParams(host: PatreonToolHost, input: Input, context?: PluginContext) {
  return { campaignId: campaignId(host, input, context) };
}

export function createPatreonTools(host: PatreonToolHost): PluginTool[] {
  return [
    {
      name: "patreon_test_connection",
      description: "Verify the Patreon v2 token and list the creator's available campaigns.",
      access: { category: "read", risk: "safe" },
      parameters: { type: "object", properties: {} },
      handler: async (_input: unknown, context?: PluginContext) => {
        const client = host.getClient(context);
        const [identity, campaigns] = await Promise.all([client.identity(), client.campaigns()]);
        return {
          connected: true,
          identity: resourceView(identity.data as PatreonResource),
          campaigns: campaigns.map(resourceView),
        };
      },
    },
    {
      name: "patreon_get_campaign",
      description: "Read campaign metadata and tiers from Patreon API v2.",
      access: { category: "read", risk: "safe" },
      parameters: {
        type: "object",
        properties: { campaignId: { type: "string", description: "Patreon campaign id." } },
      },
      handler: async (value: unknown, context?: PluginContext) => {
        const input = inputRecord(value);
        const document = await host.getClient(context).campaign(campaignId(host, input, context));
        return {
          data: resourceView(document.data as PatreonResource),
          included: (document.included || []).map(resourceView),
        };
      },
    },
    {
      name: "patreon_list_members",
      description:
        "List Patreon members and current entitlement status without requesting member email addresses.",
      access: { category: "read", risk: "safe" },
      parameters: {
        type: "object",
        properties: {
          campaignId: { type: "string" },
          cursor: { type: "string" },
          pageSize: { type: "number", default: 50 },
        },
      },
      handler: async (value: unknown, context?: PluginContext) => {
        const input = inputRecord(value);
        const page = await host.getClient(context).membersPage({
          ...campaignParams(host, input, context),
          cursor: typeof input.cursor === "string" ? input.cursor : undefined,
          count: boundedCount(input.pageSize),
        });
        return pageView(page);
      },
    },
    {
      name: "patreon_get_member_access",
      description: "Read one Patreon member's current patron status and entitled tiers.",
      access: { category: "read", risk: "safe" },
      parameters: {
        type: "object",
        required: ["memberId"],
        properties: { memberId: { type: "string" } },
      },
      handler: async (value: unknown, context?: PluginContext) => {
        const input = inputRecord(value);
        const memberId = typeof input.memberId === "string" ? input.memberId.trim() : "";
        if (!memberId) throw new Error("memberId is required");
        const document = await host.getClient(context).member(memberId);
        return {
          data: resourceView(document.data as PatreonResource),
          included: (document.included || []).map(resourceView),
        };
      },
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
          pageSize: { type: "number", default: 50 },
        },
      },
      handler: async (value: unknown, context?: PluginContext) => {
        const input = inputRecord(value);
        const page = await host.getClient(context).postsPage({
          ...campaignParams(host, input, context),
          cursor: typeof input.cursor === "string" ? input.cursor : undefined,
          count: boundedCount(input.pageSize),
        });
        return pageView(page);
      },
    },
    {
      name: "patreon_sync_audience",
      description:
        "Read a bounded set of Patreon member pages and summarize active, former, and entitled audiences.",
      access: { category: "read", risk: "safe" },
      parameters: {
        type: "object",
        properties: {
          campaignId: { type: "string" },
          pageSize: { type: "number", default: 100 },
          maxPages: { type: "number", default: 10 },
        },
      },
      handler: async (value: unknown, context?: PluginContext) => {
        const input = inputRecord(value);
        const settings = host.getSettings(context);
        let cursor: string | undefined;
        let pages = 0;
        let members = 0;
        const statuses: Record<string, number> = {};
        const entitledTierIds = new Set<string>();
        do {
          const page = await host.getClient(context).membersPage({
            ...campaignParams(host, input, context),
            cursor,
            count: boundedCount(input.pageSize, 100),
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
          nextCursor: cursor,
        };
      },
    },
    {
      name: "patreon_create_post_plan",
      description:
        "Prepare a free or paid Patreon post payload for operator review. Current Patreon v2 docs do not expose a documented post-create endpoint, so this tool never publishes.",
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
          mediaUrls: { type: "array", items: { type: "string" } },
        },
      },
      handler: async (value: unknown, context?: PluginContext) => {
        const input = inputRecord(value);
        const settings = host.getSettings(context);
        const title = typeof input.title === "string" ? input.title.trim() : "";
        const content = typeof input.content === "string" ? input.content.trim() : "";
        if (!title || !content) throw new Error("title and content are required");
        const audience = (
          input.audience === "members" || input.audience === "tiers"
            ? input.audience
            : input.audience === "public"
              ? "public"
              : settings.defaultAudience || "public"
        ) as PatreonAudience;
        const tierIds = stringArray(input.tierIds);
        if (audience === "tiers" && tierIds.length === 0 && settings.defaultTierId) {
          tierIds.push(settings.defaultTierId);
        }
        if (audience === "tiers" && tierIds.length === 0) {
          throw new Error("tierIds or PATREON_DEFAULT_TIER_ID is required for tiers audience");
        }
        return {
          publishable: false,
          reason:
            "Patreon API v2 currently documents post reads/webhooks but no post-create endpoint; review this plan and publish through Patreon until an official write endpoint is available.",
          payload: {
            title,
            content,
            is_public: audience === "public",
            is_paid: input.isPaid === true,
            ...(tierIds.length ? { tier_ids: tierIds } : {}),
            ...(stringArray(input.mediaUrls).length
              ? { media_urls: stringArray(input.mediaUrls) }
              : {}),
          },
        };
      },
    },
  ];
}
