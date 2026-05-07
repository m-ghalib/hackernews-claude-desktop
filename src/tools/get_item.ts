import { z } from "zod";
import { GetItemSchema, zodError } from "../schemas.js";
import { fetchItem, normalizeItem, buildCommentTree } from "../sources/firebase.js";
import { classifyError, makeError, Semaphore } from "../http.js";
import { Cache } from "../cache.js";
import type { HNItem } from "../types.js";

type Input = z.infer<typeof GetItemSchema>;

export async function toolGetItem(rawInput: unknown) {
  const parsed = GetItemSchema.safeParse(rawInput);
  if (!parsed.success) return zodError(parsed.error);

  const input = parsed.data;
  const semaphore = new Semaphore(8);
  const cache = new Cache<HNItem | null>();

  try {
    const item = await fetchItem(input.id, semaphore, cache);

    if (!item) {
      return makeError("NOT_FOUND", `Item ${input.id} not found`, false);
    }

    const normalized = normalizeItem(item);

    if (!input.include_comments || !item.kids || item.kids.length === 0) {
      return { ...normalized, comments: [], truncated: false };
    }

    const { comments, truncated, total } = await buildCommentTree(
      item.kids,
      input.max_depth,
      input.max_comments,
      semaphore,
      cache
    );

    return {
      ...normalized,
      comments,
      truncated,
      comment_count_fetched: total,
    };
  } catch (err) {
    return classifyError(err);
  }
}
