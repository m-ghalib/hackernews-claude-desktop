import { z } from "zod";
import { GetRepliesToUserSchema, zodError } from "../schemas.js";
import { resolveUsername } from "../config.js";
import { algoliaSearchByDate } from "../sources/algolia.js";
import { fetchItem } from "../sources/firebase.js";
import { classifyError, Semaphore } from "../http.js";
import { Cache } from "../cache.js";
import type { HNItem } from "../types.js";

type Input = z.infer<typeof GetRepliesToUserSchema>;

const SCAN_CAP = 500;
const ALGOLIA_PAGE_SIZE = 100;

export async function toolGetRepliesToUser(rawInput: unknown) {
  const parsed = GetRepliesToUserSchema.safeParse(rawInput);
  if (!parsed.success) return zodError(parsed.error);

  const input = parsed.data;

  const resolved = resolveUsername(input.username);
  if (!resolved.ok) return resolved.error;
  const username = resolved.username;

  // Default date_start to 30 days ago
  const dateStart =
    input.date_start ??
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  try {
    // Step 1: Paginate Algolia comments in date range, up to SCAN_CAP
    const candidates: Array<{ id: number; author: string; text: string; created_at: string; parent_id: number; story_id?: number; story_title?: string }> = [];
    let totalScanned = 0;
    let page = 0;

    while (totalScanned < SCAN_CAP) {
      const remaining = SCAN_CAP - totalScanned;
      const pageSize = Math.min(ALGOLIA_PAGE_SIZE, remaining);

      const resp = await algoliaSearchByDate({
        tags: ["comment"],
        date_start: dateStart,
        date_end: input.date_end,
        limit: pageSize,
        page,
      });

      if (!resp.hits || resp.hits.length === 0) break;

      for (const hit of resp.hits) {
        if (hit.parent_id == null) continue;
        candidates.push({
          id: parseInt(hit.objectID, 10),
          author: hit.author ?? "",
          text: hit.comment_text ?? "",
          created_at: hit.created_at ?? "",
          parent_id: hit.parent_id,
          story_id: hit.story_id,
          story_title: hit.story_title,
        });
      }

      totalScanned += resp.hits.length;
      if (resp.hits.length < pageSize || totalScanned >= resp.nbHits) break;
      page++;
    }

    // Step 2: Resolve unique parent_ids via Firebase (parallelized, deduped by cache)
    const semaphore = new Semaphore(8);
    const cache = new Cache<HNItem | null>();
    const uniqueParentIds = [...new Set(candidates.map((c) => c.parent_id))];

    await Promise.all(
      uniqueParentIds.map((pid) => fetchItem(pid, semaphore, cache))
    );

    // Step 3: Filter by parent author matching username
    const targetUsername = username.toLowerCase();
    const replies: Array<{
      id: number;
      author: string;
      text: string;
      posted_at: string;
      parent_id: number;
      parent_excerpt: string;
      story_id?: number;
      story_title?: string;
    }> = [];

    for (const candidate of candidates) {
      if (replies.length >= input.limit) break;

      const parent = cache.get(String(candidate.parent_id));
      if (!parent || !parent.by) continue;
      if (parent.by.toLowerCase() !== targetUsername) continue;

      replies.push({
        id: candidate.id,
        author: candidate.author,
        text: candidate.text,
        posted_at: candidate.created_at,
        parent_id: candidate.parent_id,
        parent_excerpt: (parent.text ?? "").slice(0, 200),
        story_id: candidate.story_id,
        story_title: candidate.story_title,
      });
    }

    return {
      username,
      replies,
      total_scanned: totalScanned,
    };
  } catch (err) {
    return classifyError(err);
  }
}
