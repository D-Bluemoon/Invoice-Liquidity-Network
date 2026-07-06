import { createLogger } from "./logger";
import type { ILNEventEmitter } from "./event-emitter";

const logger = createLogger("plugins");

export interface PluginContext {
  readonly logger: (msg: string, data?: unknown) => void;
  readonly emitter: ILNEventEmitter;
  readonly config: Record<string, unknown>;
}

export interface ILNPlugin {
  name: string;
  version?: string;
  install?(ctx: PluginContext): void | Promise<void>;
  onBeforeOperation?(name: string, params: unknown): void | Promise<void>;
  onAfterOperation?(name: string, result: unknown): void | Promise<void>;
  onError?(name: string, error: unknown): void | Promise<void>;
  destroy?(): void | Promise<void>;
}

type RegistryEntry = { plugin: ILNPlugin; ctx: PluginContext };

type DispatchableHook = keyof Pick<
  ILNPlugin,
  "onBeforeOperation" | "onAfterOperation" | "onError"
>;

export class PluginRegistry {
  private readonly plugins: Map<string, RegistryEntry> = new Map();
  private readonly emitter: ILNEventEmitter;

  constructor(emitter: ILNEventEmitter) {
    this.emitter = emitter;
  }

  async register(
    plugin: ILNPlugin,
    config?: Record<string, unknown>,
  ): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already registered.`);
    }

    const ctx: PluginContext = {
      logger: (msg, data) => {
        if (logger.enabled) logger(`[${plugin.name}] ${msg}`, data);
      },
      emitter: this.emitter,
      config: config ?? {},
    };

    await plugin.install?.(ctx);
    this.plugins.set(plugin.name, { plugin, ctx });
    logger(
      `registered: ${plugin.name}${plugin.version ? `@${plugin.version}` : ""}`,
    );
  }

  async unregister(name: string): Promise<void> {
    const entry = this.plugins.get(name);
    if (!entry) {
      throw new Error(`Plugin "${name}" is not registered.`);
    }
    await entry.plugin.destroy?.();
    this.plugins.delete(name);
    logger(`unregistered: ${name}`);
  }

  has(name: string): boolean {
    return this.plugins.has(name);
  }

  list(): string[] {
    return Array.from(this.plugins.keys());
  }

  private async runHook(
    hookName: DispatchableHook,
    ...args: unknown[]
  ): Promise<void> {
    for (const { plugin } of this.plugins.values()) {
      const hook = plugin[hookName] as
        | ((...a: unknown[]) => void | Promise<void>)
        | undefined;
      if (!hook) continue;
      try {
        await hook.call(plugin, ...args);
      } catch {
        // swallow per-plugin errors — one bad plugin must not affect others
      }
    }
  }

  async runBeforeOperation(name: string, params: unknown): Promise<void> {
    return this.runHook("onBeforeOperation", name, params);
  }

  async runAfterOperation(name: string, result: unknown): Promise<void> {
    return this.runHook("onAfterOperation", name, result);
  }

  async runOnError(name: string, error: unknown): Promise<void> {
    return this.runHook("onError", name, error);
  }
}
