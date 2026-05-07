# HackerNews MCP Server — Design Spec

**Date:** 2026-05-07
**Owner:** momin
**Status:** Approved (brainstorming phase complete)
**Repo:** hackernews-claude-desktop

## Summary

A local STDIO MCP server that gives Claude Desktop a complete primitive layer over HackerNews. Combines the Firebase HN API (authoritative items), the Algolia HN Search API (search + filters), and two HTML scrape paths (favorites, /active). Read-only. No auth.

## Goals

Expose enough primitives that Claude can compose answers to questions across these personas: investor, product manager, journalist, OSS maintainer, recruiter, VC scout, Show HN launcher, indie hacker, marketer, job seeker, hiring manager, engineer, researcher, community manager, security pro, educator, newcomer, engagement-maximizing power user.

Non-goals:
- Server-side sentiment / theme analysis (Claude does it on returned text).
- Persistent storage or cross-session state.
- Pre-baked persona-specific tools (e.g. `find_show_hn_launches_for_investors`). Composition wins.

## Stack

- TypeScript on Node 22 LTS
- `@modelcontextprotocol/sdk` for MCP wire protocol (STDIO transport)
- `undici` for HTTP (connection pooling)
- `cheerio` for HTML parsing (favorites, /active)
- `zod` for input schema validation
- `vitest` for tests

## Architecture

Single Node process, launched on demand by Claude Desktop. STDIO transport. Stateless across requests. In-process LRU dedup (size=500, TTL=60s) only for repeated item fetches inside a single tool call.

### Data sources

| Source | Base URL | Used by |
|---|---|---|
| Firebase HN API | `https://hacker-news.firebaseio.com/v0/` | get_item, get_user (profile), list_stories, get_updates |
| Algolia HN Search | `https://hn.algolia.com/api/v1/` | search, get_user (recent activity), get_hiring_thread, get_replies_to_user |
| HN web HTML | `https://news.ycombinator.com/` | get_user_favorites, get_active_discussions |

### Concurrency rules

- Per tool call: fan-out fetches with semaphore concurrency = 8.
- Hard cap on total fetches per tool call: 200 (configurable per-tool below).
- Each tool returns within 30 seconds or errors with a clear timeout message.
- Retries: 1 retry on 5xx / network errors, exponential backoff starting at 200ms.

## Tool surface (9 tools)

All tools return JSON. All inputs validated with zod.

### 1. `search`

Algolia full-text search. The workhorse.

**Inputs:**
- `query` (string, required) — search terms; supports `+OR+` between terms
- `tags` (string[], optional) — any of: `story`, `comment`, `show_hn`, `ask_hn`, `launch_hn`, `front_page`, `poll`, `pollopt`, `job`, `author_<username>`. Multiple tags AND together.
- `domain` (string, optional) — filter by URL domain (e.g. `github.com`)
- `searchable_attributes` (enum, optional, default `all`) — `title` | `url` | `story_text` | `comment_text` | `all`
- `min_points` (number, optional)
- `min_comments` (number, optional)
- `date_start` (ISO date, optional)
- `date_end` (ISO date, optional)
- `sort` (enum, optional, default `relevance`) — `relevance` | `recent`
- `limit` (number, default 20, max 100)
- `page` (number, default 0)

**Output:** `{ hits: [...], total: number, page: number, pages: number }`. Each hit includes `objectID`, `title`, `url`, `author`, `points`, `num_comments`, `created_at`, `story_text`, `comment_text` (if comment).

**Algolia mapping:**
- relevance → `/api/v1/search`
- recent → `/api/v1/search_by_date`
- date filters → `numericFilters=created_at_i>=...`
- tags → `tags=...`
- domain → `numericFilters` not applicable; use `restrictSearchableAttributes=url` plus query, OR pass `tags=story&query=site:domain.com` (verify which Algolia supports)
- min_points → `numericFilters=points>=N`

### 2. `get_item`

Fetch a single item with optional thread expansion.

**Inputs:**
- `id` (number, required)
- `include_comments` (boolean, default false)
- `max_depth` (number, default 5, max 10) — only used if `include_comments`
- `max_comments` (number, default 100, max 500) — total comments returned across all depths

**Output:** Item object with normalized shape. If `include_comments`, descendants included as a tree under `comments`. Truncation flagged with `truncated: true` and counts.

**Source:** Firebase `/v0/item/{id}.json`. Recursively fetch kids breadth-first up to caps.

### 3. `get_user`

User profile + optional recent activity.

**Inputs:**
- `username` (string, required)
- `include_recent` (boolean, default false)
- `recent_limit` (number, default 20, max 100)

**Output:** `{ id, karma, about, created_at, submitted_count, recent?: { stories: [...], comments: [...] } }`.

**Sources:** Firebase `/v0/user/{username}.json` for profile. Algolia `search_by_date?tags=author_USERNAME` for recent activity (much cheaper than walking `submitted[]`).

### 4. `list_stories`

Front-page lists.

**Inputs:**
- `feed` (enum, required) — `top` | `new` | `best` | `ask` | `show` | `job`
- `limit` (number, default 30, max 100)
- `offset` (number, default 0)
- `expand` (boolean, default true) — fetch full item details for each ID; when false return IDs only

**Output:** `{ feed, stories: [...] }`. Each story includes id, title, url, author, points, num_comments, created_at.

**Source:** Firebase `/v0/{feed}stories.json` returns ID array; expand by parallel fetches.

### 5. `get_hiring_thread`

Parsed monthly hiring / freelancer threads.

**Inputs:**
- `kind` (enum, default `whos_hiring`) — `whos_hiring` | `wants_to_be_hired` | `freelancer`
- `month` (ISO yyyy-mm, optional, defaults to most recent)
- `query` (string, optional) — filter top-level comments by substring (case-insensitive)
- `tags_filter` (string[], optional) — match any of: `REMOTE`, `ONSITE`, `VISA`, `INTERN`, `FULLTIME`, `CONTRACT` (regex-derived)
- `limit` (number, default 50, max 200)

**Output:** `{ thread_id, month, posts: [{ id, author, posted_at, text, tags: [...] }], total }`.

**Source:** Algolia search `tags=story,author_whoishiring` filtered by date and title prefix (`Ask HN: Who is hiring?` etc.) to find the thread, then Firebase `get_item` for top-level comment IDs, then per-comment text fetch (parallel, capped). Extract tags via regex on first 200 chars of each comment.

### 6. `get_updates`

Recent changed items + profiles.

**Inputs:** none.

**Output:** `{ items: [number], profiles: [string] }` — pass through Firebase response. Caller can chain to `get_item` / `get_user`.

**Source:** Firebase `/v0/updates.json`.

### 7. `get_user_favorites` *(HTML scrape)*

A user's favorited stories. Not in any API.

**Inputs:**
- `username` (string, required)
- `limit` (number, default 30, max 100)
- `offset` (number, default 0) — paginates by HN's `p` query param if present

**Output:** `{ username, favorites: [{ id, title, url, author, points, num_comments, posted_at }], has_more: boolean }`.

**Source:** `https://news.ycombinator.com/favorites?id={username}`. Parse with cheerio: rows of `tr.athing`, then sibling `tr` for subtext (points, author, comments).

### 8. `get_active_discussions` *(HTML scrape)*

HN's `/active` page — most active discussions ranked by recent comment velocity. Distinct from `/best`.

**Inputs:**
- `limit` (number, default 30, max 100)

**Output:** `{ discussions: [{ id, title, url, author, points, num_comments, posted_at }] }`.

**Source:** `https://news.ycombinator.com/active`. Same parse pattern as favorites.

### 9. `get_replies_to_user`

All comments where the parent comment's author equals a given username. Powers mention tracking.

**Inputs:**
- `username` (string, required)
- `date_start` (ISO date, optional, default 30 days ago)
- `date_end` (ISO date, optional)
- `limit` (number, default 50, max 200)

**Output:** `{ username, replies: [{ id, author, text, posted_at, parent_id, parent_excerpt, story_id, story_title }], total_scanned: number }`.

**Algorithm:**
1. Algolia `search_by_date?tags=comment` filtered to date range, paginate up to scanned cap (default 500 candidates).
2. For each candidate, fetch `parent_id` from Algolia hit (no extra fetch needed; Algolia includes `parent_id`).
3. Resolve each unique `parent_id` via Firebase `get_item` (parallelized, deduped by LRU).
4. Keep only candidates where the resolved parent's `by` matches `username`.
5. Return up to `limit`.

Note: this is bounded; if the user is very active, the date window may need to shrink. Surface `total_scanned` so caller knows whether the result is exhaustive.

## Server bootstrap

```
src/
  index.ts            # MCP server entrypoint, registers tools
  http.ts             # undici client, retry, timeout, semaphore
  cache.ts            # LRU dedup cache
  sources/
    firebase.ts       # Firebase HN API client
    algolia.ts        # Algolia HN client
    hn-html.ts        # cheerio scraping helpers
  tools/
    search.ts
    get_item.ts
    get_user.ts
    list_stories.ts
    get_hiring_thread.ts
    get_updates.ts
    get_user_favorites.ts
    get_active_discussions.ts
    get_replies_to_user.ts
  schemas.ts          # zod schemas for all tool inputs
  types.ts            # shared types
```

## Error handling

Every tool catches and returns structured errors. Error shape:

```json
{ "error": { "code": "UPSTREAM_5XX" | "TIMEOUT" | "NOT_FOUND" | "INVALID_INPUT" | "PARSE_FAILED" | "UNKNOWN", "message": "...", "retryable": true|false } }
```

- Upstream 4xx (e.g. Firebase returns null for missing items) → `NOT_FOUND` with the requested key.
- Upstream 5xx after one retry → `UPSTREAM_5XX`, retryable=true.
- 30s deadline exceeded → `TIMEOUT`, retryable=true.
- HTML parse failures (selectors changed) → `PARSE_FAILED`, retryable=false. Log structure dump to stderr for debugging.
- Zod validation failure → `INVALID_INPUT` with the offending field.

## Testing

`vitest` with two layers:

1. **Unit tests** — pure functions: HTML parsers (golden HTML fixtures), error classification, LRU cache, schema validation.
2. **Integration tests** — hit real upstream APIs against known fixtures: `get_item(1)` (the first ever HN item), `get_user("pg")`, `list_stories({ feed: "top", limit: 5 })`, `search({ query: "show hn ai", limit: 3 })`. Marked `@network`; run separately from unit tests. Skip in CI if offline.

No mocks for Firebase/Algolia in unit layer; integration tests use real network. The HN APIs are stable and free; this beats fragile mocking.

Pre-deploy smoke test: run the server via `npx @modelcontextprotocol/inspector` and exercise each tool once.

## Distribution

- Built artifact: `dist/index.js` (single bundled file via `tsup` or `esbuild`).
- Run command for Claude Desktop config:
  ```json
  {
    "mcpServers": {
      "hackernews": {
        "command": "node",
        "args": ["/absolute/path/to/dist/index.js"]
      }
    }
  }
  ```
- README documents the install + Claude Desktop config.
- Future upgrade path: package as `.mcpb` so users don't need Node installed (deferred; not in scope).

## Out of scope

- MCPB packaging
- Sentiment analysis tools
- Persistent caching across sessions
- Push / subscription primitives
- Auth (HN APIs don't need any)
- Resources or prompts (tools-only server)
