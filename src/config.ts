import { makeError } from "./http.js";
import type { ErrorEnvelope } from "./types.js";

export type ResolvedUsername =
  | { ok: true; username: string }
  | { ok: false; error: ErrorEnvelope };

export function resolveUsername(provided: string | undefined): ResolvedUsername {
  const value = provided?.trim();
  if (!value) {
    return {
      ok: false,
      error: makeError(
        "INVALID_INPUT",
        "username is required: pass it explicitly. Tip: tell Claude your Hacker News handle once and the set-default-username skill will reuse it for the rest of the conversation.",
        false
      ),
    };
  }
  return { ok: true, username: value };
}
