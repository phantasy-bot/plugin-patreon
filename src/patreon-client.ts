import type { PatreonPluginConfig } from "./types.js";

export interface PatreonResource {
  type: string;
  id: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, { data?: PatreonResource | PatreonResource[] }>;
}

export interface PatreonDocument {
  data: PatreonResource | PatreonResource[];
  included?: PatreonResource[];
  meta?: Record<string, unknown>;
  links?: Record<string, unknown>;
}

export interface PatreonPage {
  data: PatreonResource[];
  included: PatreonResource[];
  nextCursor?: string;
}

export class PatreonApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "PatreonApiError";
  }
}

function asResourceArray(value: PatreonResource | PatreonResource[]): PatreonResource[] {
  return Array.isArray(value) ? value : [value];
}

function nextCursor(document: PatreonDocument): string | undefined {
  const pagination = document.meta?.pagination;
  if (!pagination || typeof pagination !== "object") return undefined;
  const cursor = (pagination as Record<string, unknown>).cursors;
  if (!cursor || typeof cursor !== "object") return undefined;
  const next = (cursor as Record<string, unknown>).next;
  return typeof next === "string" && next ? next : undefined;
}

function addQuery(
  url: URL,
  values: Record<string, string | number | undefined>,
): void {
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && String(value).trim()) url.searchParams.set(key, String(value));
  }
}

export class PatreonClient {
  constructor(private readonly config: PatreonPluginConfig) {}

  private async request<T extends PatreonDocument | PatreonResource>(
    path: string,
    query: Record<string, string | number | undefined> = {},
  ): Promise<T> {
    if (!this.config.accessToken) {
      throw new Error("PATREON_ACCESS_TOKEN is not configured");
    }

    const url = new URL(
      `${this.config.apiBaseUrl?.replace(/\/$/, "") || "https://www.patreon.com/api/oauth2/v2"}/${path.replace(/^\//, "")}`,
    );
    addQuery(url, query);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.config.accessToken}`,
        "User-Agent": this.config.userAgent || "phantasy-patreon-plugin/0.1.0-beta",
      },
    });
    const text = await response.text();
    let body: unknown = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text.slice(0, 500) };
    }

    if (!response.ok) {
      const retryHeader = response.headers.get("retry-after");
      const retryFromBody =
        body && typeof body === "object" && "retry_after_seconds" in body
          ? Number((body as Record<string, unknown>).retry_after_seconds)
          : undefined;
      const retryAfter = Number(retryHeader || retryFromBody);
      const detail =
        body && typeof body === "object" ? JSON.stringify(body).slice(0, 500) : String(body);
      throw new PatreonApiError(
        `Patreon API ${response.status}: ${detail}`,
        response.status,
        Number.isFinite(retryAfter) ? retryAfter : undefined,
      );
    }

    return body as T;
  }

  async identity(): Promise<PatreonDocument> {
    return this.request<PatreonDocument>("identity", {
      "fields[user]": "full_name,vanity",
    });
  }

  async campaigns(): Promise<PatreonResource[]> {
    const document = await this.request<PatreonDocument>("campaigns", {
      "fields[campaign]":
        "created_at,creation_name,image_url,name,patron_count,pledge_url,summary,url,vanity",
      include: "tiers",
      "fields[tier]": "amount_cents,description,patron_count,title",
      "page[count]": 100,
    });
    return asResourceArray(document.data);
  }

  async campaign(campaignId: string): Promise<PatreonDocument> {
    return this.request<PatreonDocument>(`campaigns/${encodeURIComponent(campaignId)}`, {
      "fields[campaign]":
        "created_at,creation_name,image_url,name,patron_count,pledge_url,summary,url,vanity",
      include: "tiers",
      "fields[tier]": "amount_cents,description,patron_count,title",
    });
  }

  async membersPage(options: {
    campaignId: string;
    cursor?: string;
    count?: number;
  }): Promise<PatreonPage> {
    const document = await this.request<PatreonDocument>(
      `campaigns/${encodeURIComponent(options.campaignId)}/members`,
      {
        "fields[member]":
          "currently_entitled_amount_cents,patron_status,pledge_relationship_start,last_charge_status,last_charge_date",
        "fields[user]": "full_name,vanity",
        include: "currently_entitled_tiers,user",
        "page[count]": options.count || 50,
        "page[cursor]": options.cursor,
      },
    );
    return {
      data: asResourceArray(document.data),
      included: document.included || [],
      nextCursor: nextCursor(document),
    };
  }

  async postsPage(options: {
    campaignId: string;
    cursor?: string;
    count?: number;
  }): Promise<PatreonPage> {
    const document = await this.request<PatreonDocument>(
      `campaigns/${encodeURIComponent(options.campaignId)}/posts`,
      {
        "fields[post]":
          "content,created_at,edited_at,is_paid,is_public,published_at,title,url",
        "fields[tier]": "amount_cents,description,title",
        include: "tiers",
        "page[count]": options.count || 50,
        "page[cursor]": options.cursor,
      },
    );
    return {
      data: asResourceArray(document.data),
      included: document.included || [],
      nextCursor: nextCursor(document),
    };
  }

  async member(memberId: string): Promise<PatreonDocument> {
    return this.request<PatreonDocument>(`members/${encodeURIComponent(memberId)}`, {
      "fields[member]":
        "currently_entitled_amount_cents,patron_status,pledge_relationship_start,last_charge_status,last_charge_date",
      "fields[user]": "full_name,vanity",
      include: "currently_entitled_tiers,user",
    });
  }
}
