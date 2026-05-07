---
name: set-default-username
description: Use when the user states their Hacker News username, asks to set their HN handle as the default for the session, or refers to "my" Hacker News profile, comments, submissions, replies, or favorites without naming a username (for example, "my HN handle is pg", "set HN user to pg", "show my recent HN comments", "summarize my HN profile"). Captures the username and reuses it as the default for hackernews MCP tools that require it.
---

# Default Hacker News username

The `hackernews` MCP server tools `get_user`, `get_user_favorites`, and `get_replies_to_user` require a `username` argument. The `search` tool accepts an `author_<handle>` tag. This skill captures the user's HN handle once per conversation and reuses it so the user does not have to repeat it on every call.

## Capture

Recognize a handle when the user says any of:

- "My HN username is `pg`"
- "I'm `pg` on Hacker News"
- "Set HN user to `pg`"
- "Use `pg` for HN queries"

Extract the handle (case sensitive, exactly as the user wrote it) and remember it for the rest of the conversation.

## Apply

For every subsequent HN tool call:

- `get_user`, `get_user_favorites`, `get_replies_to_user` → pass the captured handle as `username` unless the user explicitly names a different user.
- `search` → if the user says "my comments", "my submissions", "my activity", "my posts", or similar self-reference, expand it to `author_<captured_handle>` in the `tags` parameter (for example, `tags: ["comment", "author_pg"]`).

If the user gives a new handle later, replace the captured value.

## When the user has not set a handle

If a tool errors with `username is required` and no handle has been captured, ask the user once for their HN handle, capture it via the rules above, then retry the call.
