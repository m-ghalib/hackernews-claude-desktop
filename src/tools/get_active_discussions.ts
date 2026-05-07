import { z } from "zod";
import { GetActiveDiscussionsSchema, zodError } from "../schemas.js";
import { fetchHTML, classifyError, makeError } from "../http.js";
import { parseHNListPage, debugParseFailure } from "../sources/hn-html.js";

type Input = z.infer<typeof GetActiveDiscussionsSchema>;

export async function toolGetActiveDiscussions(rawInput: unknown) {
  const parsed = GetActiveDiscussionsSchema.safeParse(rawInput);
  if (!parsed.success) return zodError(parsed.error);

  const input = parsed.data;

  try {
    const html = await fetchHTML("https://news.ycombinator.com/active");
    const { items } = parseHNListPage(html);

    if (items.length === 0) {
      debugParseFailure(html);
      return makeError(
        "PARSE_FAILED",
        "Could not parse /active page. HTML structure may have changed.",
        false
      );
    }

    return {
      discussions: items.slice(0, input.limit),
    };
  } catch (err) {
    return classifyError(err);
  }
}
