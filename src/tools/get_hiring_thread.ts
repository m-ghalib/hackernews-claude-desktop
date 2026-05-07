import { z } from "zod";
import { GetHiringThreadSchema, zodError } from "../schemas.js";
import { findHiringThread } from "../sources/algolia.js";
import { fetchItem, fetchItems } from "../sources/firebase.js";
import { classifyError, makeError, Semaphore } from "../http.js";
import { Cache } from "../cache.js";
import type { HNItem } from "../types.js";

type Input = z.infer<typeof GetHiringThreadSchema>;

// Tag regexes applied to first 200 chars of comment
const TAG_PATTERNS: Record<string, RegExp> = {
  REMOTE: /\bREMOTE\b/i,
  ONSITE: /\bONSITE\b/i,
  VISA: /\bVISA\b/i,
  INTERN: /\bINTERN\b/i,
  FULLTIME: /\bFULL.?TIME\b/i,
  CONTRACT: /\bCONTRACT\b/i,
};

function extractTags(text: string): string[] {
  const sample = text.slice(0, 200);
  return Object.entries(TAG_PATTERNS)
    .filter(([, re]) => re.test(sample))
    .map(([tag]) => tag);
}

export async function toolGetHiringThread(rawInput: unknown) {
  const parsed = GetHiringThreadSchema.safeParse(rawInput);
  if (!parsed.success) return zodError(parsed.error);

  const input = parsed.data;

  try {
    const thread = await findHiringThread(input.kind, input.month);

    if (!thread) {
      return makeError(
        "NOT_FOUND",
        `No hiring thread found for kind="${input.kind}" month="${input.month ?? "latest"}"`,
        false
      );
    }

    const threadId = parseInt(thread.objectID, 10);
    const semaphore = new Semaphore(8);
    const cache = new Cache<HNItem | null>();

    const threadItem = await fetchItem(threadId, semaphore, cache);
    if (!threadItem || !threadItem.kids) {
      return makeError("NOT_FOUND", `Hiring thread item ${threadId} has no comments`, false);
    }

    // Fetch top-level comments (direct kids only), capped at input.limit
    const topLevelIds = threadItem.kids.slice(0, Math.min(input.limit * 2, 400));
    const commentItems = await fetchItems(topLevelIds, semaphore, cache);

    const monthStr =
      input.month ??
      (thread.created_at
        ? thread.created_at.slice(0, 7)
        : new Date().toISOString().slice(0, 7));

    let posts = commentItems
      .filter((item): item is HNItem => item !== null && !item.deleted && !item.dead)
      .map((item) => {
        const text = item.text ?? "";
        const tags = extractTags(text);
        return {
          id: item.id,
          author: item.by,
          posted_at: item.time ? new Date(item.time * 1000).toISOString() : undefined,
          text,
          tags,
        };
      });

    // Apply query filter
    if (input.query) {
      const q = input.query.toLowerCase();
      posts = posts.filter((p) => p.text.toLowerCase().includes(q));
    }

    // Apply tags_filter (match any)
    if (input.tags_filter && input.tags_filter.length > 0) {
      const wanted = new Set(input.tags_filter);
      posts = posts.filter((p) => p.tags.some((t) => wanted.has(t)));
    }

    const total = posts.length;
    posts = posts.slice(0, input.limit);

    return {
      thread_id: threadId,
      month: monthStr,
      title: thread.title,
      posts,
      total,
    };
  } catch (err) {
    return classifyError(err);
  }
}
