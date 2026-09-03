import { afterEach, describe, expect, it, vi } from "vitest";
import { PatreonApiError, PatreonClient } from "./patreon-client.js";

afterEach(() => vi.unstubAllGlobals());

describe("PatreonClient", () => {
  it("requests explicit v2 fields and exposes cursor pagination", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ type: "member", id: "m-1", attributes: { patron_status: "active_patron" } }],
          meta: { pagination: { cursors: { next: "next-cursor" } } },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const page = await new PatreonClient({
      accessToken: "test-token",
      apiBaseUrl: "https://patreon.test/api/oauth2/v2",
      userAgent: "test-client",
    }).membersPage({ campaignId: "campaign-1", count: 25 });

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toContain("/campaigns/campaign-1/members?");
    expect(url.searchParams.get("fields[member]")).toContain("patron_status");
    expect(url.searchParams.get("page[count]")).toBe("25");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer test-token",
      "User-Agent": "test-client",
    });
    expect(page.nextCursor).toBe("next-cursor");
    expect(page.data[0]?.id).toBe("m-1");
  });

  it("preserves Patreon retry information on rate limits", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ retry_after_seconds: 12 }), {
          status: 429,
          headers: { "retry-after": "12" },
        }),
      ),
    );

    await expect(
      new PatreonClient({ accessToken: "test-token" }).identity(),
    ).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 12,
    });
  });

  it("preserves the JSON:API identity document", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { type: "user", id: "u-1", attributes: { vanity: "miyu" } } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const document = await new PatreonClient({ accessToken: "test-token" }).identity();
    expect(document.data).toMatchObject({ type: "user", id: "u-1" });
  });
});
