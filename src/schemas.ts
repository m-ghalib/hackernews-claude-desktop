// Zod schemas for all tool inputs

import { z } from "zod";
import type { ErrorEnvelope } from "./types.js";

export const SearchSchema = z.object({
  query: z.string().min(1),
  tags: z.array(z.string()).optional(),
  domain: z.string().optional(),
  searchable_attributes: z
    .enum(["title", "url", "story_text", "comment_text", "all"])
    .optional()
    .default("all"),
  min_points: z.number().int().min(0).optional(),
  min_comments: z.number().int().min(0).optional(),
  date_start: z.string().optional(),
  date_end: z.string().optional(),
  sort: z.enum(["relevance", "recent"]).optional().default("relevance"),
  limit: z.number().int().min(1).max(100).optional().default(20),
  page: z.number().int().min(0).optional().default(0),
});

export const GetItemSchema = z.object({
  id: z.number().int().positive(),
  include_comments: z.boolean().optional().default(false),
  max_depth: z.number().int().min(1).max(10).optional().default(5),
  max_comments: z.number().int().min(1).max(500).optional().default(100),
});

export const GetUserSchema = z.object({
  username: z.string().min(1),
  include_recent: z.boolean().optional().default(false),
  recent_limit: z.number().int().min(1).max(100).optional().default(20),
});

export const ListStoriesSchema = z.object({
  feed: z.enum(["top", "new", "best", "ask", "show", "job"]),
  limit: z.number().int().min(1).max(100).optional().default(30),
  offset: z.number().int().min(0).optional().default(0),
  expand: z.boolean().optional().default(true),
});

export const GetHiringThreadSchema = z.object({
  kind: z.enum(["whos_hiring", "wants_to_be_hired", "freelancer"]).optional().default("whos_hiring"),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  query: z.string().optional(),
  tags_filter: z
    .array(z.enum(["REMOTE", "ONSITE", "VISA", "INTERN", "FULLTIME", "CONTRACT"]))
    .optional(),
  limit: z.number().int().min(1).max(200).optional().default(50),
});

export const GetUpdatesSchema = z.object({});

export const GetUserFavoritesSchema = z.object({
  username: z.string().min(1),
  limit: z.number().int().min(1).max(100).optional().default(30),
  offset: z.number().int().min(0).optional().default(0),
});

export const GetActiveDiscussionsSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(30),
});

export const GetRepliesToUserSchema = z.object({
  username: z.string().min(1),
  date_start: z.string().optional(),
  date_end: z.string().optional(),
  limit: z.number().int().min(1).max(200).optional().default(50),
});

// Convert zod error to INVALID_INPUT envelope
export function zodError(err: z.ZodError): ErrorEnvelope {
  const first = err.errors[0];
  return {
    error: {
      code: "INVALID_INPUT",
      message: `${first.path.join(".")}: ${first.message}`,
      retryable: false,
    },
  };
}
