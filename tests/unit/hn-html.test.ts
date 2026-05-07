import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { parseHNListPage } from "../../src/sources/hn-html.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "../fixtures");

describe("parseHNListPage — active fixture", () => {
  const html = readFileSync(join(fixturesDir, "active.html"), "utf-8");
  const { items, hasMore } = parseHNListPage(html);

  it("parses at least 1 item", () => {
    expect(items.length).toBeGreaterThan(0);
  });

  it("each item has a numeric id", () => {
    for (const item of items) {
      expect(typeof item.id).toBe("number");
      expect(item.id).toBeGreaterThan(0);
    }
  });

  it("each item has a non-empty title", () => {
    for (const item of items) {
      expect(item.title).toBeTruthy();
    }
  });

  it("first item has points or undefined", () => {
    const first = items[0];
    if (first.points !== undefined) {
      expect(typeof first.points).toBe("number");
    }
  });

  it("first item has an author or undefined", () => {
    const first = items[0];
    if (first.author !== undefined) {
      expect(typeof first.author).toBe("string");
    }
  });

  it("returns boolean hasMore", () => {
    expect(typeof hasMore).toBe("boolean");
  });
});

describe("parseHNListPage — favorites fixture", () => {
  const html = readFileSync(join(fixturesDir, "favorites.html"), "utf-8");
  const { items } = parseHNListPage(html);

  it("parses at least 1 item from dang's favorites", () => {
    // dang has at least 1 favorite (we confirmed this during fixture capture)
    expect(items.length).toBeGreaterThan(0);
  });

  it("item has id and title", () => {
    expect(items[0].id).toBeGreaterThan(0);
    expect(items[0].title).toBeTruthy();
  });
});

describe("parseHNListPage — empty page", () => {
  it("returns empty items for empty page", () => {
    const html = "<html><body><p>nothing here</p></body></html>";
    const { items, hasMore } = parseHNListPage(html);
    expect(items).toEqual([]);
    expect(hasMore).toBe(false);
  });
});
