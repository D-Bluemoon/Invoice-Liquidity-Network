/**
 * CLI progress indicators — spinners, progress bars, and status messages.
 *
 * Supports TTY animation with clean completion; falls back to plain status
 * lines when stdout is not a TTY (tests, pipes, CI).
 */

import pc from "picocolors";

export interface ProgressOptions {
  /** Output stream (defaults to process.stdout). */
  output?: NodeJS.WritableStream;
  /** When false, suppress progress output entirely. */
  enabled?: boolean;
}

export interface Spinner {
  /** Replace the current status message. */
  update(message: string): void;
  /** Stop and print a green success line. */
  succeed(message?: string): void;
  /** Stop and print a red failure line. */
  fail(message?: string): void;
  /** Stop without printing a completion line. */
  stop(): void;
}

export interface ProgressBar {
  /** Set absolute progress and optionally update the status message. */
  update(current: number, message?: string): void;
  /** Advance progress by `step` (default 1) and optionally update the message. */
  increment(step?: number, message?: string): void;
  /** Complete the bar and print a green success line. */
  succeed(message?: string): void;
  /** Stop the bar and print a red failure line. */
  fail(message?: string): void;
  /** Stop without printing a completion line. */
  stop(): void;
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPINNER_INTERVAL_MS = 80;
const BAR_WIDTH = 24;

function resolveEnabled(options?: ProgressOptions): boolean {
  if (options?.enabled === false) return false;
  const stream = options?.output ?? process.stdout;
  return Boolean((stream as NodeJS.WriteStream).isTTY);
}

function writeLine(output: NodeJS.WritableStream, line: string): void {
  output.write(`${line}\n`);
}

function clearLine(output: NodeJS.WritableStream, width: number): void {
  output.write(`\r${" ".repeat(width)}\r`);
}

function formatBar(current: number, total: number): string {
  const ratio = total > 0 ? Math.min(current / total, 1) : 0;
  const filled = Math.round(ratio * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  const percent = Math.round(ratio * 100);
  const bar = `${pc.green("█".repeat(filled))}${pc.dim("░".repeat(empty))}`;
  return `[${bar}] ${pc.bold(String(percent).padStart(3))}% (${current}/${total})`;
}

/**
 * Start an indeterminate spinner for long-running operations.
 */
export function createSpinner(message: string, options?: ProgressOptions): Spinner {
  const output = options?.output ?? process.stdout;
  const silent = options?.enabled === false;
  const animated = resolveEnabled(options);
  let messageText = message;
  let frame = 0;
  let active = true;
  let interval: ReturnType<typeof setInterval> | undefined;

  const renderFrame = (): string => `${pc.cyan(SPINNER_FRAMES[frame])} ${messageText}`;

  const renderLine = (): void => {
    if (!active) return;
    if (animated) {
      output.write(`\r${renderFrame()}`);
    }
  };

  const emitStatic = (): void => {
    writeLine(output, `${pc.cyan(SPINNER_FRAMES[0])} ${messageText}`);
  };

  if (animated) {
    output.write(`\r${renderFrame()}`);
    interval = setInterval(() => {
      frame = (frame + 1) % SPINNER_FRAMES.length;
      renderLine();
    }, SPINNER_INTERVAL_MS);
  } else if (!silent) {
    emitStatic();
  }

  const finish = (line?: string): void => {
    if (!active) return;
    active = false;
    if (interval) clearInterval(interval);
    if (animated) {
      clearLine(output, messageText.length + 6);
    }
    if (line && !silent) writeLine(output, line);
  };

  return {
    update(nextMessage: string) {
      messageText = nextMessage;
      if (!active) return;
      if (animated) {
        renderLine();
      } else if (!silent) {
        writeLine(output, `${pc.cyan("→")} ${nextMessage}`);
      }
    },
    succeed(message?: string) {
      finish(message ? `${pc.green("✓")} ${message}` : undefined);
    },
    fail(message?: string) {
      finish(message ? `${pc.red("✗")} ${message}` : undefined);
    },
    stop() {
      finish();
    },
  };
}

/**
 * Start a determinate progress bar for multi-step operations.
 */
export function createProgressBar(
  total: number,
  message: string,
  options?: ProgressOptions,
): ProgressBar {
  const output = options?.output ?? process.stdout;
  const silent = options?.enabled === false;
  const animated = resolveEnabled(options);
  let messageText = message;
  let current = 0;
  let active = true;

  const render = (): string => `${formatBar(current, total)} ${messageText}`;

  const paint = (): void => {
    if (!active) return;
    if (animated) {
      output.write(`\r${render()}`);
    }
  };

  if (animated) {
    paint();
  } else if (!silent) {
    writeLine(output, render());
  }

  const finish = (line?: string): void => {
    if (!active) return;
    active = false;
    if (animated) {
      clearLine(output, messageText.length + BAR_WIDTH + 24);
    }
    if (line && !silent) writeLine(output, line);
  };

  const setProgress = (next: number, nextMessage?: string): void => {
    current = Math.max(0, Math.min(next, total));
    if (nextMessage !== undefined) messageText = nextMessage;
    if (!active) return;
    if (animated) {
      paint();
    } else if (!silent) {
      writeLine(output, render());
    }
  };

  return {
    update(next: number, nextMessage?: string) {
      setProgress(next, nextMessage);
    },
    increment(step = 1, nextMessage?: string) {
      setProgress(current + step, nextMessage);
    },
    succeed(message?: string) {
      if (current < total) setProgress(total);
      finish(message ? `${pc.green("✓")} ${message}` : undefined);
    },
    fail(message?: string) {
      finish(message ? `${pc.red("✗")} ${message}` : undefined);
    },
    stop() {
      finish();
    },
  };
}

/**
 * Run `fn` behind a spinner that stops on success or failure.
 */
export async function withSpinner<T>(
  message: string,
  fn: () => Promise<T>,
  options?: ProgressOptions,
): Promise<T> {
  const spinner = createSpinner(message, options);
  try {
    const result = await fn();
    spinner.stop();
    return result;
  } catch (error) {
    spinner.fail(message);
    throw error;
  }
}

/**
 * Run `fn` behind a progress bar; call `bar.increment()` inside `fn` as steps complete.
 */
export async function withProgressBar<T>(
  total: number,
  message: string,
  fn: (bar: ProgressBar) => Promise<T>,
  options?: ProgressOptions,
): Promise<T> {
  const bar = createProgressBar(total, message, options);
  try {
    const result = await fn(bar);
    bar.stop();
    return result;
  } catch (error) {
    bar.fail(message);
    throw error;
  }
}
