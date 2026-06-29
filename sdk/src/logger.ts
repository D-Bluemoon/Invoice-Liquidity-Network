import debug from "debug";

const isDebugEnabled =
  typeof process !== "undefined" &&
  typeof process.env !== "undefined" &&
  process.env.ILN_DEBUG === "1";

if (isDebugEnabled) {
  debug.log = console.debug?.bind(console) ?? console.log.bind(console);
  debug.enable("iln:sdk:*");
}

function createNoopDebugger(): debug.Debugger {
  return Object.assign(() => {}, { enabled: false }) as debug.Debugger;
}

/**
 * Create a debug logger for the SDK.
 * Logging is enabled when `ILN_DEBUG=1` is set in the environment.
 *
 * @param namespace - The logger namespace (e.g. "client", "signers").
 * @returns A debug.Debugger instance (noop when debugging is disabled).
 *
 * @example
 * ```ts
 * const logger = createLogger("client");
 * if (logger.enabled) {
 *   logger("Submitting invoice", { params });
 * }
 * ```
 */
export function createLogger(namespace: string): debug.Debugger {
  return isDebugEnabled ? debug(`iln:sdk:${namespace}`) : createNoopDebugger();
}
