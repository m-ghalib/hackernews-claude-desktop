import { z } from "zod";
import { SearchSchema, zodError } from "../schemas.js";
import { algoliaSearch } from "../sources/algolia.js";
import { classifyError } from "../http.js";

type Input = z.infer<typeof SearchSchema>;

export async function toolSearch(rawInput: unknown) {
  const parsed = SearchSchema.safeParse(rawInput);
  if (!parsed.success) return zodError(parsed.error);

  const input = parsed.data;

  try {
    const result = await algoliaSearch({
      query: input.query,
      tags: input.tags,
      domain: input.domain,
      searchable_attributes: input.searchable_attributes,
      min_points: input.min_points,
      min_comments: input.min_comments,
      date_start: input.date_start,
      date_end: input.date_end,
      sort: input.sort,
      limit: input.limit,
      page: input.page,
    });

    return {
      hits: result.hits.map((h) => ({
        objectID: h.objectID,
        title: h.title,
        url: h.url,
        author: h.author,
        points: h.points,
        num_comments: h.num_comments,
        created_at: h.created_at,
        story_text: h.story_text,
        comment_text: h.comment_text,
        story_id: h.story_id,
        story_title: h.story_title,
        parent_id: h.parent_id,
      })),
      total: result.nbHits,
      page: result.page,
      pages: result.nbPages,
    };
  } catch (err) {
    return classifyError(err);
  }
}
