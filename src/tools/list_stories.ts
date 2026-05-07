import { z } from "zod";
import { ListStoriesSchema, zodError } from "../schemas.js";
import { fetchFeedIds, fetchItems, normalizeItem } from "../sources/firebase.js";
import { classifyError, Semaphore } from "../http.js";
import { Cache } from "../cache.js";
import type { HNItem } from "../types.js";

type Input = z.infer<typeof ListStoriesSchema>;

export async function toolListStories(rawInput: unknown) {
  const parsed = ListStoriesSchema.safeParse(rawInput);
  if (!parsed.success) return zodError(parsed.error);

  const input = parsed.data;

  try {
    const allIds = await fetchFeedIds(input.feed);
    const pageIds = allIds.slice(input.offset, input.offset + input.limit);

    if (!input.expand) {
      return { feed: input.feed, stories: pageIds };
    }

    const semaphore = new Semaphore(8);
    const cache = new Cache<HNItem | null>();
    const items = await fetchItems(pageIds, semaphore, cache);

    const stories = items
      .filter((item): item is HNItem => item !== null && !item.deleted && !item.dead)
      .map(normalizeItem);

    return { feed: input.feed, stories };
  } catch (err) {
    return classifyError(err);
  }
}
