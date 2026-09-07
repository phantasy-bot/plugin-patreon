
export type PluginConfig = Record<string, unknown> & { enabled?: boolean };
export type PluginContext = { env?: Record<string, string | undefined>; metadata?: Record<string, unknown> };
export type PluginTool = {
  name: string;
  description?: string;
  access?: unknown;
  parameters?: unknown;
  handler: (input: unknown, context?: PluginContext) => Promise<unknown> | unknown;
};
export type PluginManifest = Record<string, unknown>;
export type ConfigSchema = Record<string, unknown>;
export declare class BasePlugin {
  name?: string;
  version?: string;
  description?: string;
  onInit(...args: unknown[]): Promise<void>;
  getConfig(): PluginConfig;
  isEnabled(): boolean;
  onConfigUpdated(config: PluginConfig): Promise<void>;
  getManifest(): PluginManifest;
}
