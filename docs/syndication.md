# Syndication

Posts and notes flagged with `syndicate: true` are posted to Bluesky and Mastodon automatically, once, on the first production deploy that contains them. A local Netlify Build Plugin (`plugins/syndicate/`) does the posting; Threads is not wired up yet. Nothing posts until `SYNDICATE_ENABLED=true` is set in Netlify. Until then every run is a dry run.

## Flagging an entry

Both the `blog` and `note` collections accept two fields (`src/content.config.ts`):

```yaml
syndicate: true # default false
syndicateText: "optional custom copy, max 300 characters"
```

- Without `syndicateText`, the post text is the title and description separated by a blank line. A note with no description posts just its title.
- A blank or whitespace-only `syndicateText` counts as unset. An editor can write `""` for an emptied field, so the schema trims it to `undefined`.
- The 300-character cap is Bluesky's limit. Exceeding it fails the build rather than truncating silently. Default text that's too long (a long note description) is truncated with `…` per network instead.
- Draft blog posts never appear in the manifest, flagged or not, because the endpoint uses `getAllPosts()`.

## How a deploy decides what to post

1. **`src/pages/syndicate.json.ts`** builds `/syndicate.json`: one entry per flagged post/note with its absolute `url`, `title`, `description`, composed `text`, and `image` (the post's OG image, or `/social-card.png` for notes).
2. **`onPostBuild`**, before Netlify publishes, reads the freshly built `dist/syndicate.json`, fetches the _live_ site's `/syndicate.json`, and keeps every entry whose `url` isn't live yet. The result goes to a temp file, because the live manifest is overwritten once the deploy publishes.
3. **`onSuccess`**, after the deploy is live, HEAD-checks each entry's URL (3 tries, 5s apart). Then it posts to every network that has credentials and sends a summary to the Telegram bot from [deploy notifications](./deploy-notifications.md).

The live site is the record of what's been posted. There is no state file, no build cache, and no git diff. Rebuilding, redeploying, or editing an already-flagged entry never re-posts it.

## Safety rails

| Situation                                                    | Behavior                                                   |
| ------------------------------------------------------------ | ---------------------------------------------------------- |
| Not a production deploy (`CONTEXT` ≠ `production`)           | Skips entirely, silently.                                  |
| `SYNDICATE_ENABLED` isn't exactly `true`                     | Dry run: logs each composed post, Telegram shows 🧪 lines. |
| Live `/syndicate.json` errors or 404s                        | Posts nothing, Telegram warns.                             |
| More new entries than `SYNDICATE_MAX_PER_DEPLOY` (default 3) | Posts nothing, Telegram lists them.                        |
| Entry URL isn't live after the retries                       | Skips that entry, Telegram reports ❌.                     |
| One network fails                                            | The others still post; the failure is reported.            |
| Mastodon request retried within an hour                      | Deduplicated by the `Idempotency-Key: <entry url>` header. |

Nothing in the plugin throws, so a syndication problem can never fail the deploy.

**Gotcha: posts are not retried.** Once a deploy publishes, the entry is in the live manifest, so a failed post stays failed. Post it by hand from the URL in the Telegram ❌ line.

**Gotcha: the first deploy of this feature posts nothing.** The live site has no `/syndicate.json` yet, which triggers the 404 rail. Ship the plugin first, then flag the first entry in a later deploy.

**Gotcha: renaming a flagged entry's slug re-posts it**, because the diff key is the URL. Unflag it before renaming if that's unwanted.

## Setup (Netlify → Site settings → Environment variables)

| Variable                   | Value                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| `BLUESKY_HANDLE`           | e.g. `furioursus.dev`                                                                                  |
| `BLUESKY_APP_PASSWORD`     | Bluesky → Settings → Privacy and security → App passwords. Never the account password.                 |
| `BLUESKY_SERVICE`          | Optional, default `https://bsky.social`. Posting goes to the PDS listed in the session's DID document. |
| `MASTODON_INSTANCE`        | e.g. `https://mastodon.social`                                                                         |
| `MASTODON_ACCESS_TOKEN`    | Instance → Preferences → Development → New application, scope `write:statuses` only.                   |
| `SYNDICATE_ENABLED`        | `true` to post for real. Leave unset for the first deploy to watch a dry run.                          |
| `SYNDICATE_MAX_PER_DEPLOY` | Optional, default `3`.                                                                                 |

A network without its credentials is skipped. With none set, flagged entries produce a Telegram warning.

## Previewing locally

```bash
npm run build && npm run syndicate:preview
```

`scripts/syndicate-preview.mjs` diffs `dist/syndicate.json` against the live site and prints each post exactly as each network would receive it. It is read-only and needs no credentials. Pass `-- --site=<url>` to diff against a different deploy.

## Per-network details

- **Bluesky** (`createBluesky` in `plugins/syndicate/lib.js`): raw XRPC over `fetch`, no SDK. One `createSession` per deploy, then for each entry `uploadBlob` (the thumbnail, skipped if over ~976 KB or unreachable) and `createRecord` with an `app.bsky.embed.external` link card. Bluesky doesn't unfurl links, so the URL lives in the card rather than in the text, which is why the text has the full 300 graphemes to itself.
- **Mastodon** (`createMastodon`): one `POST /api/v1/statuses`, text then a blank line then the URL. Mastodon counts every URL as 23 characters, so the text is truncated to 475 code points. Mastodon builds its own preview card from the page's OG tags.
- **Threads**: not built. It needs a Meta developer app, a two-step container/publish call, and a long-lived token that expires every 60 days, so it would need a token-refresh story first.

The shared Telegram sender lives in `plugins/shared/telegram.js`, used by both this plugin and `telegram-notify`.
