# Hacker News Plugin for Claude Code and Cowork

Read-only Hacker News tools packaged as a Claude Code plugin.

The plugin adds a local Model Context Protocol server with tools for Hacker News search, stories, comment threads, users, favorites, active discussions, hiring threads, updates, and replies.

No Hacker News account, API key, manual JSON config, or separate Node.js install is required for normal plugin use. Claude Code provides the Node.js runtime used by the plugin.

Repository: [m-ghalib/hackernews-claude-desktop](https://github.com/m-ghalib/hackernews-claude-desktop)

## Install

From Claude Code, add the GitHub repository as a plugin marketplace:

```text
/plugin marketplace add m-ghalib/hackernews-claude-desktop
```

Install the plugin:

```text
/plugin install m-ghalib@hackernews
```

Reload plugins or restart Claude Code if prompted:

```text
/reload-plugins
```

The plugin is now available as the `hackernews` Model Context Protocol server.

## Configure your Hacker News handle (optional)

When the plugin is enabled, Claude Code prompts for an optional Hacker News username. If you set it:

- `get_user`, `get_user_favorites`, and `get_replies_to_user` can be called without a `username` argument and fall back to your handle.
- `search` rewrites the literal tag `author_me` to `author_<your-handle>`, so prompts like `search HN for my recent comments about vector databases` work without quoting your handle.

Leave the field blank to require an explicit `username` on every call. The handle is stored in `settings.json` (non-sensitive) and is passed to the MCP server as the environment variable `HN_DEFAULT_USERNAME`. To change it later, run `/plugin` and reconfigure, then `/reload-plugins` or restart Claude Code.

Example prompts once configured:

- `Analyze my Hacker News profile: karma, top 10 submissions, themes in last 50 comments.`
- `Show recent replies to me and summarize the sentiment.`
- `List my favorites grouped by domain.`
- `Search HN for my comments about Postgres in the last 90 days.` (uses `tags=["comment", "author_me"]`)

## Use

Ask Claude:

- `Search Hacker News for recent Show HN posts about vector databases.`
- `Get the top 10 Hacker News stories.`
- `Fetch item 8863 with comments.`
- `Find remote posts in the latest Who is Hiring thread that mention product manager.`
- `Show active Hacker News discussions with the most comment activity.`

## Tools

| Tool | What it does |
| --- | --- |
| `search` | Search stories, comments, jobs, polls, Ask HN, Show HN, domains, authors, and date ranges. |
| `get_item` | Fetch a story, comment, job, or poll by ID. Can include a bounded comment tree. |
| `get_user` | Fetch a Hacker News user profile. Can include recent stories and comments. |
| `list_stories` | List top, new, best, Ask HN, Show HN, or job stories. |
| `get_hiring_thread` | Fetch and filter monthly Who is Hiring, Who Wants to Be Hired, and Freelancer threads. |
| `get_updates` | Fetch recently changed Hacker News items and user profiles. |
| `get_user_favorites` | Parse a user's favorited stories from the Hacker News website. |
| `get_active_discussions` | Parse the Hacker News active page. |
| `get_replies_to_user` | Find recent comments that reply directly to a given user. |

## Plugin Layout

```text
hackernews-claude-desktop/
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json
├── .mcp.json
├── dist/
│   └── index.cjs
└── README.md
```

Claude Code discovers the plugin from `.claude-plugin/plugin.json`. It starts the bundled Hacker News server from `.mcp.json` when the plugin is enabled.

Cowork uses the same plugin format through the Claude plugin directory. Submit the plugin to the directory when it is ready for public distribution.

## Troubleshooting

Validate the plugin:

```bash
claude plugin validate .
```

List marketplaces:

```bash
claude plugin marketplace list
```

If the plugin does not load:

- Confirm `.claude-plugin/plugin.json` exists at the plugin root.
- Confirm `.mcp.json` exists at the plugin root.
- Confirm `dist/index.cjs` exists.
- Run `/reload-plugins`.
- Restart Claude Code.

## Maintainer Commands

Build the bundled server:

```bash
npm install
npm run build
```

Run tests:

```bash
npm test
npm run test:network
```

## References

- [Create plugins](https://code.claude.com/docs/en/plugins)
- [Create and distribute a plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces)
- [Plugins reference](https://code.claude.com/docs/en/plugins-reference)
- [Submit your plugin](https://claude.com/docs/plugins/submit)
