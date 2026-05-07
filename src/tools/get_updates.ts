import { GetUpdatesSchema, zodError } from "../schemas.js";
import { fetchUpdates } from "../sources/firebase.js";
import { classifyError } from "../http.js";

export async function toolGetUpdates(rawInput: unknown) {
  const parsed = GetUpdatesSchema.safeParse(rawInput);
  if (!parsed.success) return zodError(parsed.error);

  try {
    return await fetchUpdates();
  } catch (err) {
    return classifyError(err);
  }
}
