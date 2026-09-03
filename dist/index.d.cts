import { PluginConfig, PluginContext, BasePlugin, ConfigSchema, PluginTool, PluginManifest } from '@phantasy/agent/plugins';

type PatreonAudience = "public" | "members" | "tiers";
interface PatreonPluginConfig extends PluginConfig {
    accessToken?: string;
    campaignId?: string;
    apiBaseUrl?: string;
    userAgent?: string;
    defaultAudience?: PatreonAudience;
    defaultTierId?: string;
    maxPages?: number;
}

interface PatreonResource {
    type: string;
    id: string;
    attributes?: Record<string, unknown>;
    relationships?: Record<string, {
        data?: PatreonResource | PatreonResource[];
    }>;
}
interface PatreonDocument {
    data: PatreonResource | PatreonResource[];
    included?: PatreonResource[];
    meta?: Record<string, unknown>;
    links?: Record<string, unknown>;
}
interface PatreonPage {
    data: PatreonResource[];
    included: PatreonResource[];
    nextCursor?: string;
}
declare class PatreonApiError extends Error {
    readonly status: number;
    readonly retryAfterSeconds?: number | undefined;
    constructor(message: string, status: number, retryAfterSeconds?: number | undefined);
}
declare class PatreonClient {
    private readonly config;
    constructor(config: PatreonPluginConfig);
    private request;
    identity(): Promise<PatreonDocument>;
    campaigns(): Promise<PatreonResource[]>;
    campaign(campaignId: string): Promise<PatreonDocument>;
    membersPage(options: {
        campaignId: string;
        cursor?: string;
        count?: number;
    }): Promise<PatreonPage>;
    postsPage(options: {
        campaignId: string;
        cursor?: string;
        count?: number;
    }): Promise<PatreonPage>;
    member(memberId: string): Promise<PatreonDocument>;
}

interface PatreonToolHost {
    getClient(context?: PluginContext): PatreonClient;
    getSettings(context?: PluginContext): PatreonPluginConfig;
}

declare class PatreonPlugin extends BasePlugin implements PatreonToolHost {
    name: string;
    version: string;
    description: string;
    protected author: string;
    protected homepage: string;
    protected repository: string;
    protected license: string;
    protected displayName: string;
    protected category: string;
    protected tags: string[];
    protected permissions: string[];
    protected workspace: "business";
    protected extensionKind: "integration";
    protected configSchema: ConfigSchema;
    protected dataRetention: {
        stores: {
            name: string;
            kind: "config";
            description: string;
            erasable: boolean;
        }[];
        dataCategories: string[];
        externalServices: string[];
        retentionDefault: "persist";
        erasable: boolean;
    };
    onInit(agentConfig: Parameters<BasePlugin["onInit"]>[0], config?: PluginConfig): Promise<void>;
    getSettings(context?: PluginContext): PatreonPluginConfig;
    getClient(context?: PluginContext): PatreonClient;
    getTools(): PluginTool[];
    getManifest(): PluginManifest;
    healthCheck(): Promise<{
        status: "healthy" | "unhealthy";
        message?: string;
    }>;
}

export { PatreonApiError, type PatreonAudience, PatreonClient, type PatreonDocument, type PatreonPage, PatreonPlugin, type PatreonPluginConfig, type PatreonResource, PatreonPlugin as default };
