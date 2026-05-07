// Centralized HTTP client using undici
// - 30s timeout per call
// - 1 retry with 200ms exponential backoff on 5xx/network errors
// - Semaphore concurrency = 8 across all in-flight fan-out within a tool call

import { request } from "undici";
import type { ErrorEnvelope } from "./types.js";

const TIMEOUT_MS = 30_000;
const RETRY_DELAY_MS = 200;

// Simple async semaphore (~20 lines, no external dep)
export class Semaphore {
  private _count: number;
  private _queue: Array<() => void> = [];

  constructor(concurrency: number) {
    this._count = concurrency;
  }

  async acquire(): Promise<void> {
    if (this._count > 0) {
      this._count--;
      return;
    }
    await new Promise<void>((resolve) => this._queue.push(resolve));
  }

  release(): void {
    if (this._queue.length > 0) {
      const next = this._queue.shift()!;
      next();
    } else {
      this._count++;
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

export function makeError(
  code: ErrorEnvelope["error"]["code"],
  message: string,
  retryable: boolean
): ErrorEnvelope {
  return { error: { code, message, retryable } };
}

export function classifyError(err: unknown): ErrorEnvelope {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    const statusCode = (err as Error & { statusCode?: number }).statusCode;

    if (typeof statusCode === "number") {
      if (statusCode >= 500) {
        return makeError("UPSTREAM_5XX", `Upstream returned ${statusCode}`, true);
      }
      if (statusCode === 404) {
        return makeError("NOT_FOUND", `Upstream returned 404`, false);
      }
      if (statusCode >= 400) {
        return makeError("INVALID_INPUT", `Upstream returned ${statusCode}`, false);
      }
    }

    if (msg.includes("timeout") || msg.includes("timed out") || err.name === "TimeoutError") {
      return makeError("TIMEOUT", `Request timed out after ${TIMEOUT_MS}ms`, true);
    }
    if (msg.includes("aborted") || err.name === "AbortError") {
      return makeError("TIMEOUT", "Request was aborted", true);
    }
  }
  return makeError("UNKNOWN", err instanceof Error ? err.message : String(err), false);
}

export async function fetchJSON<T>(url: string, semaphore?: Semaphore): Promise<T> {
  const doFetch = async (): Promise<T> => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= 1; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
      }

      try {
        const { statusCode, body } = await request(url, {
          method: "GET",
          headers: { "user-agent": "hackernews-mcp/1.0.0" },
          bodyTimeout: TIMEOUT_MS,
          headersTimeout: TIMEOUT_MS,
        });

        if (statusCode === 404 || statusCode === 204) {
          // Return null-like for Firebase 404 (missing items)
          return null as T;
        }

        if (statusCode >= 500) {
          if (attempt === 0) {
            lastError = new Error(`HTTP ${statusCode}`);
            continue; // retry
          }
          throw Object.assign(new Error(`HTTP ${statusCode} after retry`), { statusCode });
        }

        if (statusCode >= 400) {
          throw Object.assign(new Error(`HTTP ${statusCode}`), { statusCode });
        }

        const text = await body.text();
        return JSON.parse(text) as T;
      } catch (err) {
        lastError = err;
        const isRetryable =
          err instanceof Error &&
          (err.message.includes("ECONNRESET") ||
            err.message.includes("ECONNREFUSED") ||
            err.message.includes("socket hang up"));
        if (!isRetryable || attempt === 1) {
          throw err;
        }
      }
    }

    throw lastError;
  };

  if (semaphore) {
    return semaphore.run(doFetch);
  }
  return doFetch();
}

export async function fetchHTML(url: string, semaphore?: Semaphore): Promise<string> {
  const doFetch = async (): Promise<string> => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= 1; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
      }

      try {
        const { statusCode, body } = await request(url, {
          method: "GET",
          headers: {
            "user-agent": "Mozilla/5.0 (compatible; hackernews-mcp/1.0.0)",
            accept: "text/html",
          },
          bodyTimeout: TIMEOUT_MS,
          headersTimeout: TIMEOUT_MS,
        });

        if (statusCode >= 500) {
          if (attempt === 0) {
            lastError = new Error(`HTTP ${statusCode}`);
            continue;
          }
          throw Object.assign(new Error(`HTTP ${statusCode} after retry`), { statusCode });
        }

        if (statusCode >= 400) {
          throw Object.assign(new Error(`HTTP ${statusCode}`), { statusCode });
        }

        return await body.text();
      } catch (err) {
        lastError = err;
        if (attempt === 1) throw err;
      }
    }

    throw lastError;
  };

  if (semaphore) {
    return semaphore.run(doFetch);
  }
  return doFetch();
}
