import { describe, it, expect, beforeAll } from "vitest";
import { toolGetItem } from "../../src/tools/get_item.js";
import { toolGetUser } from "../../src/tools/get_user.js";
import { toolListStories } from "../../src/tools/list_stories.js";
import { toolSearch } from "../../src/tools/search.js";

// Skip all network tests if NO_NETWORK env var is set to a truthy value
// Empty string is falsy in JS, so `NO_NETWORK=` (empty) does NOT skip
const skipNetwork = !!process.env.NO_NETWORK;

describe.skipIf(skipNetwork)("Integration: get_item", () => {
  it("get_item({ id: 1 }) returns the first HN item", async () => {
    const result = await toolGetItem({ id: 1 });
    // Item 1 is the first item — a story titled "Y Combinator" by pg
    expect(result).not.toHaveProperty("error");
    const r = result as Record<string, unknown>;
    expect(r.id).toBe(1);
    expect(typeof r.title).toBe("string");
    expect((r.title as string).toLowerCase()).toContain("y combinator");
    expect(r.author).toBe("pg");
  }, 30_000);
});

describe.skipIf(skipNetwork)("Integration: get_user", () => {
  it("get_user({ username: 'pg' }) returns Paul Graham's profile", async () => {
    const result = await toolGetUser({ username: "pg" });
    expect(result).not.toHaveProperty("error");
    const r = result as Record<string, unknown>;
    expect(r.id).toBe("pg");
    expect(typeof r.karma).toBe("number");
    expect(r.karma as number).toBeGreaterThan(0);
  }, 30_000);
});

describe.skipIf(skipNetwork)("Integration: list_stories", () => {
  it("list_stories({ feed: 'top', limit: 5 }) returns 5 stories", async () => {
    const result = await toolListStories({ feed: "top", limit: 5 });
    expect(result).not.toHaveProperty("error");
    const r = result as { feed: string; stories: unknown[] };
    expect(r.feed).toBe("top");
    expect(r.stories).toHaveLength(5);
    const first = r.stories[0] as Record<string, unknown>;
    expect(typeof first.id).toBe("number");
    expect(typeof first.title).toBe("string");
  }, 30_000);
});

describe.skipIf(skipNetwork)("Integration: search", () => {
  it("search({ query: 'show hn', limit: 3 }) returns hits", async () => {
    const result = await toolSearch({ query: "show hn", limit: 3 });
    expect(result).not.toHaveProperty("error");
    const r = result as { hits: unknown[]; total: number };
    expect(r.hits.length).toBeGreaterThan(0);
    expect(r.hits.length).toBeLessThanOrEqual(3);
    expect(r.total).toBeGreaterThan(0);
  }, 30_000);
});
