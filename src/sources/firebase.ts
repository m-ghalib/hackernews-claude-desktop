// Firebase HN API client
// Base: https://hacker-news.firebaseio.com/v0/

import { fetchJSON, Semaphore, makeError } from "../http.js";
import type { HNItem, HNUser, ErrorEnvelope } from "../types.js";
import { Cache } from "../cache.js";

const BASE = "https://hacker-news.firebaseio.com/v0";

export async function fetchItem(
  id: number,
  semaphore: Semaphore,
  cache: Cache<HNItem | null>
): Promise<HNItem | null> {
  return cache.getOrFetch(String(id), () =>
    fetchJSON<HNItem | null>(`${BASE}/item/${id}.json`, semaphore)
  );
}

export async function fetchUser(username: string): Promise<HNUser | null> {
  return fetchJSON<HNUser | null>(`${BASE}/user/${username}.json`);
}

export async function fetchFeedIds(feed: string): Promise<number[]> {
  const feedMap: Record<string, string> = {
    top: "topstories",
    new: "newstories",
    best: "beststories",
    ask: "askstories",
    show: "showstories",
    job: "jobstories",
  };
  const endpoint = feedMap[feed];
  if (!endpoint) throw new Error(`Unknown feed: ${feed}`);
  const ids = await fetchJSON<number[]>(`${BASE}/${endpoint}.json`);
  return ids ?? [];
}

export async function fetchUpdates(): Promise<{ items: number[]; profiles: string[] }> {
  const data = await fetchJSON<{ items: number[]; profiles: string[] }>(`${BASE}/updates.json`);
  return data ?? { items: [], profiles: [] };
}

// Fetch multiple items in parallel, respecting semaphore and cache
export async function fetchItems(
  ids: number[],
  semaphore: Semaphore,
  cache: Cache<HNItem | null>
): Promise<(HNItem | null)[]> {
  return Promise.all(ids.map((id) => fetchItem(id, semaphore, cache)));
}

// Normalize a Firebase item into a consistent shape
export function normalizeItem(item: HNItem) {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    url: item.url,
    author: item.by,
    points: item.score,
    num_comments: item.descendants,
    created_at: item.time ? new Date(item.time * 1000).toISOString() : undefined,
    text: item.text,
    parent: item.parent,
    kids: item.kids,
    deleted: item.deleted,
    dead: item.dead,
  };
}

// Build a comment tree breadth-first up to caps
export async function buildCommentTree(
  rootKids: number[],
  maxDepth: number,
  maxComments: number,
  semaphore: Semaphore,
  cache: Cache<HNItem | null>
): Promise<{ comments: ReturnType<typeof normalizeComment>[]; truncated: boolean; total: number }> {
  type QueueItem = { ids: number[]; depth: number; parentList: ReturnType<typeof normalizeComment>[] };

  const comments: ReturnType<typeof normalizeComment>[] = [];
  let total = 0;
  let truncated = false;

  const queue: QueueItem[] = [{ ids: rootKids, depth: 1, parentList: comments }];

  while (queue.length > 0 && total < maxComments) {
    const batch = queue.shift()!;
    if (batch.depth > maxDepth) {
      truncated = true;
      continue;
    }

    const remaining = maxComments - total;
    const idsToFetch = batch.ids.slice(0, remaining);
    if (batch.ids.length > remaining) truncated = true;

    const items = await fetchItems(idsToFetch, semaphore, cache);

    for (const item of items) {
      if (!item || item.deleted || item.dead) continue;
      const comment = normalizeComment(item);
      batch.parentList.push(comment);
      total++;

      if (item.kids && item.kids.length > 0 && batch.depth < maxDepth) {
        queue.push({
          ids: item.kids,
          depth: batch.depth + 1,
          parentList: comment.comments!,
        });
      }
    }
  }

  if (queue.length > 0) truncated = true;

  return { comments, truncated, total };
}

function normalizeComment(item: HNItem) {
  return {
    id: item.id,
    author: item.by,
    text: item.text,
    created_at: item.time ? new Date(item.time * 1000).toISOString() : undefined,
    parent: item.parent,
    comments: [] as ReturnType<typeof normalizeComment>[],
  };
}
