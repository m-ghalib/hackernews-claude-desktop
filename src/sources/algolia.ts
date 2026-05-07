// Algolia HN Search API client
// Base: https://hn.algolia.com/api/v1/

import { fetchJSON, Semaphore } from "../http.js";
import type { AlgoliaHit, AlgoliaResponse } from "../types.js";

const BASE = "https://hn.algolia.com/api/v1";

export interface SearchOptions {
  query: string;
  tags?: string[];
  // Domain filter: uses restrictSearchableAttributes=url with query=domain
  // Tested: https://hn.algolia.com/api/v1/search?query=github.com&restrictSearchableAttributes=url&tags=story
  // returns 2M+ hits correctly filtered by domain in URL. The site:domain.com query approach
  // does NOT work (returns unrelated hits). We combine domain into query when restrictSearchableAttributes=url.
  domain?: string;
  searchable_attributes?: string;
  min_points?: number;
  min_comments?: number;
  date_start?: string;
  date_end?: string;
  sort?: "relevance" | "recent";
  limit?: number;
  page?: number;
}

function buildNumericFilters(opts: SearchOptions): string[] {
  const filters: string[] = [];
  if (opts.min_points != null) filters.push(`points>=${opts.min_points}`);
  if (opts.date_start) {
    const ts = Math.floor(new Date(opts.date_start).getTime() / 1000);
    filters.push(`created_at_i>=${ts}`);
  }
  if (opts.date_end) {
    const ts = Math.floor(new Date(opts.date_end).getTime() / 1000);
    filters.push(`created_at_i<=${ts}`);
  }
  return filters;
}

export async function algoliaSearch(opts: SearchOptions): Promise<AlgoliaResponse> {
  const endpoint = opts.sort === "recent" ? `${BASE}/search_by_date` : `${BASE}/search`;

  const params = new URLSearchParams();

  // When domain filter is set, use restrictSearchableAttributes=url and domain as query
  // This is the only reliable way to filter by domain in Algolia HN API
  if (opts.domain) {
    params.set("query", opts.domain);
    params.set("restrictSearchableAttributes", "url");
  } else {
    params.set("query", opts.query);
    if (opts.searchable_attributes && opts.searchable_attributes !== "all") {
      params.set("restrictSearchableAttributes", opts.searchable_attributes);
    }
  }

  if (opts.tags && opts.tags.length > 0) {
    params.set("tags", opts.tags.join(","));
  }

  const numericFilters = buildNumericFilters(opts);
  if (numericFilters.length > 0) {
    params.set("numericFilters", numericFilters.join(","));
  }

  params.set("hitsPerPage", String(opts.limit ?? 20));
  params.set("page", String(opts.page ?? 0));

  const url = `${endpoint}?${params.toString()}`;
  const data = await fetchJSON<AlgoliaResponse>(url);
  return data;
}

export async function algoliaSearchByDate(opts: {
  tags?: string[];
  query?: string;
  date_start?: string;
  date_end?: string;
  limit?: number;
  page?: number;
}): Promise<AlgoliaResponse> {
  const params = new URLSearchParams();
  params.set("query", opts.query ?? "");
  if (opts.tags) params.set("tags", opts.tags.join(","));

  const filters: string[] = [];
  if (opts.date_start) {
    const ts = Math.floor(new Date(opts.date_start).getTime() / 1000);
    filters.push(`created_at_i>=${ts}`);
  }
  if (opts.date_end) {
    const ts = Math.floor(new Date(opts.date_end).getTime() / 1000);
    filters.push(`created_at_i<=${ts}`);
  }
  if (filters.length > 0) params.set("numericFilters", filters.join(","));

  params.set("hitsPerPage", String(opts.limit ?? 20));
  params.set("page", String(opts.page ?? 0));

  return fetchJSON<AlgoliaResponse>(`${BASE}/search_by_date?${params.toString()}`);
}

export async function findHiringThread(kind: string, month?: string): Promise<AlgoliaHit | null> {
  const titlePrefixMap: Record<string, string> = {
    whos_hiring: "Ask HN: Who is hiring?",
    wants_to_be_hired: "Ask HN: Who wants to be hired?",
    freelancer: "Ask HN: Freelancer?",
  };

  const titlePrefix = titlePrefixMap[kind] ?? titlePrefixMap["whos_hiring"];

  // Search for threads posted by whoishiring account
  const params = new URLSearchParams({
    query: titlePrefix,
    tags: "story,author_whoishiring",
    hitsPerPage: "20",
    page: "0",
  });

  if (month) {
    // Filter to the specific month
    const [year, mon] = month.split("-").map(Number);
    const startTs = Math.floor(new Date(year, mon - 1, 1).getTime() / 1000);
    const endTs = Math.floor(new Date(year, mon, 1).getTime() / 1000); // first of next month
    params.set("numericFilters", `created_at_i>=${startTs},created_at_i<${endTs}`);
  }

  const data = await fetchJSON<AlgoliaResponse>(
    `${BASE}/search_by_date?${params.toString()}`
  );

  if (!data || data.hits.length === 0) return null;

  // Pick the most recent hit whose title starts with the prefix
  const matching = data.hits.filter((h) =>
    h.title?.startsWith(titlePrefix)
  );

  return matching[0] ?? null;
}
