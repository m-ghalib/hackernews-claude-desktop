import { describe, it, expect } from "vitest";
import {
  SearchSchema,
  GetItemSchema,
  GetUserSchema,
  ListStoriesSchema,
  GetHiringThreadSchema,
  GetUserFavoritesSchema,
  GetActiveDiscussionsSchema,
  GetRepliesToUserSchema,
  zodError,
} from "../../src/schemas.js";

describe("SearchSchema", () => {
  it("accepts minimal valid input", () => {
    const result = SearchSchema.safeParse({ query: "test" });
    expect(result.success).toBe(true);
  });

  it("rejects empty query", () => {
    const result = SearchSchema.safeParse({ query: "" });
    expect(result.success).toBe(false);
  });

  it("rejects limit > 100", () => {
    const result = SearchSchema.safeParse({ query: "test", limit: 101 });
    expect(result.success).toBe(false);
  });

  it("applies defaults", () => {
    const result = SearchSchema.safeParse({ query: "test" });
    if (!result.success) throw new Error("should succeed");
    expect(result.data.sort).toBe("relevance");
    expect(result.data.limit).toBe(20);
    expect(result.data.page).toBe(0);
    expect(result.data.searchable_attributes).toBe("all");
  });

  it("rejects invalid sort value", () => {
    const result = SearchSchema.safeParse({ query: "test", sort: "popularity" });
    expect(result.success).toBe(false);
  });
});

describe("GetItemSchema", () => {
  it("rejects negative id", () => {
    const result = GetItemSchema.safeParse({ id: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects max_depth > 10", () => {
    const result = GetItemSchema.safeParse({ id: 1, max_depth: 11 });
    expect(result.success).toBe(false);
  });

  it("accepts valid input with defaults", () => {
    const result = GetItemSchema.safeParse({ id: 42 });
    if (!result.success) throw new Error("should succeed");
    expect(result.data.include_comments).toBe(false);
    expect(result.data.max_depth).toBe(5);
    expect(result.data.max_comments).toBe(100);
  });
});

describe("GetUserSchema", () => {
  it("rejects empty username", () => {
    const result = GetUserSchema.safeParse({ username: "" });
    expect(result.success).toBe(false);
  });

  it("rejects recent_limit > 100", () => {
    const result = GetUserSchema.safeParse({ username: "pg", recent_limit: 101 });
    expect(result.success).toBe(false);
  });
});

describe("ListStoriesSchema", () => {
  it("rejects invalid feed", () => {
    const result = ListStoriesSchema.safeParse({ feed: "viral" });
    expect(result.success).toBe(false);
  });

  it("accepts all valid feeds", () => {
    for (const feed of ["top", "new", "best", "ask", "show", "job"]) {
      const result = ListStoriesSchema.safeParse({ feed });
      expect(result.success).toBe(true);
    }
  });
});

describe("GetHiringThreadSchema", () => {
  it("rejects invalid month format", () => {
    const result = GetHiringThreadSchema.safeParse({ month: "2024/05" });
    expect(result.success).toBe(false);
  });

  it("accepts valid month", () => {
    const result = GetHiringThreadSchema.safeParse({ month: "2024-05" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid tags_filter value", () => {
    const result = GetHiringThreadSchema.safeParse({ tags_filter: ["INVALID"] });
    expect(result.success).toBe(false);
  });
});

describe("zodError", () => {
  it("converts zod error to INVALID_INPUT envelope", () => {
    const result = SearchSchema.safeParse({ query: "" });
    if (result.success) throw new Error("should fail");
    const envelope = zodError(result.error);
    expect(envelope.error.code).toBe("INVALID_INPUT");
    expect(envelope.error.retryable).toBe(false);
    expect(envelope.error.message).toBeTruthy();
  });
});
