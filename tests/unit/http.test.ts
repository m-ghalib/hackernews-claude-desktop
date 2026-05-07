import { describe, it, expect } from "vitest";
import { classifyError, makeError, Semaphore } from "../../src/http.js";

describe("makeError", () => {
  it("creates an error envelope", () => {
    const err = makeError("TIMEOUT", "timed out", true);
    expect(err.error.code).toBe("TIMEOUT");
    expect(err.error.message).toBe("timed out");
    expect(err.error.retryable).toBe(true);
  });
});

describe("classifyError", () => {
  it("classifies timeout errors", () => {
    const err = new Error("Request timed out after 30000ms");
    const result = classifyError(err);
    expect(result.error.code).toBe("TIMEOUT");
    expect(result.error.retryable).toBe(true);
  });

  it("classifies TimeoutError by name", () => {
    const err = new Error("timeout");
    err.name = "TimeoutError";
    const result = classifyError(err);
    expect(result.error.code).toBe("TIMEOUT");
  });

  it("classifies AbortError", () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    const result = classifyError(err);
    expect(result.error.code).toBe("TIMEOUT");
  });

  it("classifies unknown errors", () => {
    const err = new Error("something weird happened");
    const result = classifyError(err);
    expect(result.error.code).toBe("UNKNOWN");
    expect(result.error.retryable).toBe(false);
  });

  it("classifies 5xx via statusCode property as UPSTREAM_5XX (retryable)", () => {
    const err = Object.assign(new Error("HTTP 503 after retry"), { statusCode: 503 });
    const result = classifyError(err);
    expect(result.error.code).toBe("UPSTREAM_5XX");
    expect(result.error.retryable).toBe(true);
  });

  it("classifies 404 via statusCode as NOT_FOUND (not retryable)", () => {
    const err = Object.assign(new Error("HTTP 404"), { statusCode: 404 });
    const result = classifyError(err);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.retryable).toBe(false);
  });

  it("classifies other 4xx via statusCode as INVALID_INPUT", () => {
    const err = Object.assign(new Error("HTTP 400"), { statusCode: 400 });
    const result = classifyError(err);
    expect(result.error.code).toBe("INVALID_INPUT");
    expect(result.error.retryable).toBe(false);
  });

  it("handles non-Error objects", () => {
    const result = classifyError("string error");
    expect(result.error.code).toBe("UNKNOWN");
    expect(result.error.message).toBe("string error");
  });
});

describe("Semaphore", () => {
  it("allows concurrent work up to limit", async () => {
    const sem = new Semaphore(3);
    let running = 0;
    let maxRunning = 0;

    const tasks = Array.from({ length: 10 }, () =>
      sem.run(async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((r) => setTimeout(r, 10));
        running--;
      })
    );

    await Promise.all(tasks);
    expect(maxRunning).toBeLessThanOrEqual(3);
  });

  it("processes all tasks", async () => {
    const sem = new Semaphore(2);
    const results: number[] = [];
    await Promise.all(
      [1, 2, 3, 4, 5].map((n) =>
        sem.run(async () => {
          results.push(n);
        })
      )
    );
    expect(results.sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
