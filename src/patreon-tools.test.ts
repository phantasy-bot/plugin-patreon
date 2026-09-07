import { describe, expect, it, vi } from "vitest";
import { createPatreonTools, type PatreonToolHost } from "./patreon-tools.js";
import type { PatreonClient } from "./patreon-client.js";
import type { PatreonPluginConfig } from "./types.js";

function tool(name: string) {
  const tools = createPatreonTools(host);
  const found = tools.find((entry) => entry.name === name);
  if (!found) throw new Error(`missing tool ${name}`);
  return found;
}

const settings: PatreonPluginConfig = {
  campaignId: "campaign-1",
  defaultAudience: "public",
  maxPages: 10,
};

let client: {
  identity: ReturnType<typeof vi.fn>;
  campaigns: ReturnType<typeof vi.fn>;
  campaign: ReturnType<typeof vi.fn>;
  membersPage: ReturnType<typeof vi.fn>;
  member: ReturnType<typeof vi.fn>;
  postsPage: ReturnType<typeof vi.fn>;
};

let host: PatreonToolHost;
let getClient: ReturnType<typeof vi.fn>;

function resetHost(options?: { failClosed?: boolean }) {
  client = {
    identity: vi.fn(),
    campaigns: vi.fn(),
    campaign: vi.fn(),
    membersPage: vi.fn(),
    member: vi.fn(),
    postsPage: vi.fn(),
  };

  getClient = options?.failClosed
    ? vi.fn(() => {
        throw new Error("PATREON_ACCESS_TOKEN is not configured");
      })
    : vi.fn(() => client as unknown as PatreonClient);

  host = {
    getClient,
    getSettings: vi.fn(() => settings),
  };
}

describe("createPatreonTools", () => {
  it("fail-closed when the Patreon connection is not configured", async () => {
    resetHost({ failClosed: true });
    await expect(tool("patreon_test_connection").handler({}, undefined)).rejects.toThrow(
      /PATREON_ACCESS_TOKEN is not configured/,
    );
    expect(getClient).toHaveBeenCalled();
  });

  it("tests connection successfully with identity and campaigns", async () => {
    resetHost();
    client.identity.mockResolvedValue({
      data: { type: "user", id: "u-1", attributes: { vanity: "miyu" } },
    });
    client.campaigns.mockResolvedValue([
      { type: "campaign", id: "campaign-1", attributes: { creation_name: "Miyu" } },
    ]);

    const result = await tool("patreon_test_connection").handler({}, undefined);
    expect(result).toMatchObject({
      connected: true,
      identity: { type: "user", id: "u-1" },
      campaigns: [{ type: "campaign", id: "campaign-1" }],
    });
    expect(client.identity).toHaveBeenCalledOnce();
    expect(client.campaigns).toHaveBeenCalledOnce();
  });

  it("reads a campaign document", async () => {
    resetHost();
    client.campaign.mockResolvedValue({
      data: { type: "campaign", id: "campaign-1", attributes: { creation_name: "Miyu" } },
      included: [{ type: "tier", id: "tier-1", attributes: { title: "Fans" } }],
    });

    const result = await tool("patreon_get_campaign").handler(
      { campaignId: "campaign-1" },
      undefined,
    );
    expect(result).toMatchObject({
      data: { type: "campaign", id: "campaign-1" },
      included: [{ type: "tier", id: "tier-1" }],
    });
    expect(client.campaign).toHaveBeenCalledWith("campaign-1");
  });

  it("lists members and posts pages", async () => {
    resetHost();
    client.membersPage.mockResolvedValue({
      data: [{ type: "member", id: "m-1", attributes: { patron_status: "active_patron" } }],
      included: [],
      nextCursor: "members-next",
    });
    client.postsPage.mockResolvedValue({
      data: [{ type: "post", id: "p-1", attributes: { title: "Hello" } }],
      included: [],
      nextCursor: "posts-next",
    });

    const members = await tool("patreon_list_members").handler(
      { campaignId: "campaign-1", pageSize: 25, cursor: "start" },
      undefined,
    );
    const posts = await tool("patreon_list_posts").handler(
      { campaignId: "campaign-1", pageSize: 10 },
      undefined,
    );

    expect(members).toMatchObject({
      data: [{ id: "m-1" }],
      nextCursor: "members-next",
    });
    expect(posts).toMatchObject({
      data: [{ id: "p-1" }],
      nextCursor: "posts-next",
    });
    expect(client.membersPage).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      cursor: "start",
      count: 25,
    });
    expect(client.postsPage).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      cursor: undefined,
      count: 10,
    });
  });

  it("bounds sync audience pagination to maxPages", async () => {
    resetHost();
    client.membersPage
      .mockResolvedValueOnce({
        data: [
          {
            type: "member",
            id: "m-1",
            attributes: { patron_status: "active_patron" },
            relationships: {
              currently_entitled_tiers: { data: [{ type: "tier", id: "tier-1" }] },
            },
          },
        ],
        included: [],
        nextCursor: "c2",
      })
      .mockResolvedValueOnce({
        data: [
          {
            type: "member",
            id: "m-2",
            attributes: { patron_status: "former_patron" },
          },
        ],
        included: [],
        nextCursor: "c3",
      })
      .mockResolvedValueOnce({
        data: [{ type: "member", id: "m-3", attributes: { patron_status: "active_patron" } }],
        included: [],
        nextCursor: "c4",
      });

    const result = await tool("patreon_sync_audience").handler(
      { campaignId: "campaign-1", pageSize: 100, maxPages: 2 },
      undefined,
    );

    expect(client.membersPage).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      campaignId: "campaign-1",
      pages: 2,
      members: 2,
      complete: false,
      nextCursor: "c3",
      entitledTierIds: ["tier-1"],
    });
    expect(result).toMatchObject({
      statuses: { active_patron: 1, former_patron: 1 },
    });
  });

  it("create_post_plan is plan-only and never calls the client", async () => {
    resetHost();
    const result = await tool("patreon_create_post_plan").handler(
      {
        title: "Launch note",
        content: "Thanks for the support.",
        audience: "public",
        isPaid: false,
      },
      undefined,
    );

    expect(result).toMatchObject({
      publishable: false,
      payload: {
        title: "Launch note",
        content: "Thanks for the support.",
        is_public: true,
        is_paid: false,
      },
    });
    expect(getClient).not.toHaveBeenCalled();
    expect(client.identity).not.toHaveBeenCalled();
    expect(client.campaigns).not.toHaveBeenCalled();
    expect(client.campaign).not.toHaveBeenCalled();
    expect(client.membersPage).not.toHaveBeenCalled();
    expect(client.member).not.toHaveBeenCalled();
    expect(client.postsPage).not.toHaveBeenCalled();
  });
});
