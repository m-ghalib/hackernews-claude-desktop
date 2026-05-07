import { z } from "zod";
import { GetUserSchema, zodError } from "../schemas.js";
import { fetchUser } from "../sources/firebase.js";
import { algoliaSearchByDate } from "../sources/algolia.js";
import { classifyError, makeError } from "../http.js";

type Input = z.infer<typeof GetUserSchema>;

export async function toolGetUser(rawInput: unknown) {
  const parsed = GetUserSchema.safeParse(rawInput);
  if (!parsed.success) return zodError(parsed.error);

  const input = parsed.data;

  try {
    const user = await fetchUser(input.username);

    if (!user) {
      return makeError("NOT_FOUND", `User "${input.username}" not found`, false);
    }

    const result: Record<string, unknown> = {
      id: user.id,
      karma: user.karma,
      about: user.about,
      created_at: new Date(user.created * 1000).toISOString(),
      submitted_count: user.submitted?.length ?? 0,
    };

    if (input.include_recent) {
      const [storiesResp, commentsResp] = await Promise.all([
        algoliaSearchByDate({
          tags: [`story`, `author_${input.username}`],
          limit: input.recent_limit,
        }),
        algoliaSearchByDate({
          tags: [`comment`, `author_${input.username}`],
          limit: input.recent_limit,
        }),
      ]);

      result.recent = {
        stories: storiesResp.hits.map((h) => ({
          objectID: h.objectID,
          title: h.title,
          url: h.url,
          points: h.points,
          num_comments: h.num_comments,
          created_at: h.created_at,
        })),
        comments: commentsResp.hits.map((h) => ({
          objectID: h.objectID,
          comment_text: h.comment_text,
          story_id: h.story_id,
          story_title: h.story_title,
          created_at: h.created_at,
          parent_id: h.parent_id,
        })),
      };
    }

    return result;
  } catch (err) {
    return classifyError(err);
  }
}
