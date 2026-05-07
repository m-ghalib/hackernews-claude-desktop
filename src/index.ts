// HackerNews MCP Server
// STDIO transport — all logging goes to stderr, stdout is reserved for JSON-RPC

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  SearchSchema,
  GetItemSchema,
  GetUserSchema,
  ListStoriesSchema,
  GetHiringThreadSchema,
  GetUpdatesSchema,
  GetUserFavoritesSchema,
  GetActiveDiscussionsSchema,
  GetRepliesToUserSchema,
} from "./schemas.js";

import { toolSearch } from "./tools/search.js";
import { toolGetItem } from "./tools/get_item.js";
import { toolGetUser } from "./tools/get_user.js";
import { toolListStories } from "./tools/list_stories.js";
import { toolGetHiringThread } from "./tools/get_hiring_thread.js";
import { toolGetUpdates } from "./tools/get_updates.js";
import { toolGetUserFavorites } from "./tools/get_user_favorites.js";
import { toolGetActiveDiscussions } from "./tools/get_active_discussions.js";
import { toolGetRepliesToUser } from "./tools/get_replies_to_user.js";

const server = new McpServer({
  name: "hackernews",
  version: "1.0.0",
});

// Helper: wrap tool result as MCP CallToolResult content
function toContent(result: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
  };
}

server.registerTool(
  "search",
  {
    description:
      "Full-text search over HackerNews stories, comments, jobs, and polls via Algolia. Supports filters by date, points, domain, tags (story/comment/show_hn/ask_hn/job etc.), and sort order.",
    inputSchema: SearchSchema,
  },
  async (input) => toContent(await toolSearch(input))
);

server.registerTool(
  "get_item",
  {
    description:
      "Fetch a single HackerNews item by ID (story, comment, job, poll). Optionally expand the full comment thread up to configurable depth and count caps.",
    inputSchema: GetItemSchema,
  },
  async (input) => toContent(await toolGetItem(input))
);

server.registerTool(
  "get_user",
  {
    description:
      "Fetch a HackerNews user profile (karma, about, account age). Optionally include recent stories and comments via Algolia.",
    inputSchema: GetUserSchema,
  },
  async (input) => toContent(await toolGetUser(input))
);

server.registerTool(
  "list_stories",
  {
    description:
      "Fetch stories from a HackerNews feed: top, new, best, ask, show, or job. Returns full story details by default.",
    inputSchema: ListStoriesSchema,
  },
  async (input) => toContent(await toolListStories(input))
);

server.registerTool(
  "get_hiring_thread",
  {
    description:
      "Fetch and filter the monthly 'Who is Hiring' / 'Who Wants to Be Hired' / 'Freelancer' threads. Supports text search and tag filters (REMOTE, ONSITE, VISA, etc.).",
    inputSchema: GetHiringThreadSchema,
  },
  async (input) => toContent(await toolGetHiringThread(input))
);

server.registerTool(
  "get_updates",
  {
    description:
      "Fetch the most recently changed HackerNews items and user profiles from Firebase. Use as a starting point for chaining to get_item or get_user.",
    inputSchema: GetUpdatesSchema,
  },
  async (input) => toContent(await toolGetUpdates(input))
);

server.registerTool(
  "get_user_favorites",
  {
    description:
      "Scrape a HackerNews user's favorited stories. Not available via API; parsed from the HN web interface.",
    inputSchema: GetUserFavoritesSchema,
  },
  async (input) => toContent(await toolGetUserFavorites(input))
);

server.registerTool(
  "get_active_discussions",
  {
    description:
      "Fetch the HackerNews /active page — most active discussions ranked by recent comment velocity. Distinct from /best or /top.",
    inputSchema: GetActiveDiscussionsSchema,
  },
  async (input) => toContent(await toolGetActiveDiscussions(input))
);

server.registerTool(
  "get_replies_to_user",
  {
    description:
      "Find all comments that are direct replies to a specific HackerNews user within a date range. Useful for mention tracking and engagement analysis.",
    inputSchema: GetRepliesToUserSchema,
  },
  async (input) => toContent(await toolGetRepliesToUser(input))
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("HackerNews MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
