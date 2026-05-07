import { z } from "zod";
import { GetUserFavoritesSchema, zodError } from "../schemas.js";
import { resolveUsername } from "../config.js";
import { fetchHTML, classifyError, makeError } from "../http.js";
import { parseHNListPage, debugParseFailure } from "../sources/hn-html.js";

type Input = z.infer<typeof GetUserFavoritesSchema>;

export async function toolGetUserFavorites(rawInput: unknown) {
  const parsed = GetUserFavoritesSchema.safeParse(rawInput);
  if (!parsed.success) return zodError(parsed.error);

  const input = parsed.data;

  const resolved = resolveUsername(input.username);
  if (!resolved.ok) return resolved.error;
  const username = resolved.username;

  try {
    // HN paginates favorites via the `p` param (page number, 1-indexed)
    // Each page has ~30 items. We map offset to pages as needed.
    // For simplicity we fetch page 1 (offset 0-29), page 2 (offset 30-59), etc.
    const pageNum = Math.floor(input.offset / 30) + 1;
    const url = `https://news.ycombinator.com/favorites?id=${encodeURIComponent(username)}&p=${pageNum}`;

    const html = await fetchHTML(url);
    const { items, hasMore } = parseHNListPage(html);

    if (items.length === 0 && !html.includes("athing")) {
      // Log structure for debugging
      debugParseFailure(html);
      return makeError(
        "PARSE_FAILED",
        `Could not parse favorites page for user "${username}". HTML structure may have changed.`,
        false
      );
    }

    // Trim to the requested limit
    const favorites = items.slice(0, input.limit);

    return {
      username,
      favorites,
      has_more: hasMore || items.length > input.limit,
    };
  } catch (err) {
    return classifyError(err);
  }
}
