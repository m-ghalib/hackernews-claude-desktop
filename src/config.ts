import { makeError } from "./http.js";
import type { ErrorEnvelope } from "./types.js";

export type ResolvedUsername =
  | { ok: true; username: string }
  | { ok: false; error: ErrorEnvelope };

export function getDefaultUsername(): string | undefined {
  const raw = process.env.HN_DEFAULT_USERNAME?.trim();
  if (!raw) return undefined;
  if (raw.startsWith("${")) return undefined;
  return raw;
}

export function resolveUsername(provided: string | undefined): ResolvedUsername {
  const value = provided?.trim() || getDefaultUsername();
  if (!value) {
    return {
      ok: false,
      error: makeError(
        "INVALID_INPUT",
        "username is required: pass it explicitly or set the plugin's Hacker News username in the configuration dialog.",
        false
      ),
    };
  }
  return { ok: true, username: value };
}
