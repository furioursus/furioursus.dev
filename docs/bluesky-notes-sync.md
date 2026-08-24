# Bluesky → notes sync

A [PESOS](https://indieweb.org/PESOS) (Publish Elsewhere, Syndicate to your Own Site) import:
top-level posts from [@furioursus.dev on Bluesky](https://bsky.app/profile/furioursus.dev) get
pulled in on a schedule and written as real notes under `content/notes/`, so they go through the
exact same rendering/RSS/search/CMS pipeline as any hand-written note — see
[content-model.md](./content-model.md) for the `note` collection itself.

This is the opposite direction from the `bskyPostUri` field documented on the `blog` collection —
that one is for a (separate, not-yet-built) integration that announces a _blog post_ on Bluesky.
This feature reads _from_ Bluesky.

## How it's built

- **`scripts/sync-bluesky-notes.mjs`** — a standalone Node script (no dependencies beyond Node's
  own `fetch`/`fs`, deliberately kept out of the app's dependency tree since it doesn't run as
  part of the Astro build). It:
  1. Fetches the author feed from Bluesky's public, unauthenticated AT Protocol endpoint —
     `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed`, `filter=posts_no_replies` —
     so no API key or `.env` entry is needed.
  2. Filters out reposts (`item.reason` present) and anything that isn't the account's own
     top-level post.
  3. For each qualifying post, derives a slug `bsky-<rkey>` from the post's `at://` URI (the
     `rkey` is the URI's last path segment) and skips it if `content/notes/bsky-<rkey>/index.md`
     already exists.
  4. Writes any new post as `content/notes/bsky-<rkey>/index.md`, with images (if any) downloaded
     alongside it — see **Frontmatter & body shape** below.
- **`.github/workflows/sync-bluesky-notes.yml`** — runs the script on a cron schedule (every 6
  hours), and, if it produced new files under `content/notes/`, commits and pushes them as
  `github-actions[bot]`. Netlify is already configured to build on push, so no separate deploy
  trigger is needed — the push alone kicks off the site rebuild.

## Frontmatter & body shape

```yaml
title: "…derived from the post text, truncated to 60 chars…"
description: "…the full post text, single-lined…"
publishDate: "2026-08-24T12:00:00.000Z" # record.createdAt, verbatim
bskyPostUri: "at://did:plc:xxxx/app.bsky.feed.post/<rkey>"
```

- **`bskyPostUri`** does double duty: it's what makes re-runs idempotent (dedupe is just "does
  this slug's folder already exist," no separate cursor/state file to persist across CI runs),
  and it's what `src/components/note/Note.astro` uses to render an "Originally posted on
  Bluesky →" link — built from `siteConfig.bskyHandle` (`src/site.config.ts`) plus the URI's
  `rkey`, since the bsky.app web UI accepts a handle in place of a DID in profile/post URLs.
- **Title** is empty-post-safe: a post with only an image and no text falls back to `Note — <date
formatted as "Aug 24, 2026">`, since `title` is required (`titleSchema`, max 60 chars, in
  `src/content.config.ts`) and there's no text to draw one from otherwise.
- **Body** runs the post's `record.text` through its `record.facets` — AT Protocol's byte-range
  annotations for links/mentions/hashtags — so a link typed into a Bluesky post stays a real
  clickable markdown link in the synced note, not a bare URL. This has to slice `text` as a UTF-8
  `Buffer`, not a JS string: facet offsets are **byte** offsets, and any multi-byte character
  (emoji, etc.) before a facet would otherwise shift everything after it.
- **Images** come from the post's hydrated `embed.images[].fullsize` CDN URLs and are downloaded
  into the note's own folder (`img-0.jpg`, `img-1.jpg`, …) — same colocated-image convention the
  `blog` collection already uses for cover images — rather than hotlinked, since Bluesky's CDN
  makes no durability promise for a URL outliving the post.
- **Quote posts and link cards** get appended as a `> [@handle](url): quoted text` blockquote or a
  trailing markdown link, respectively, rather than being silently dropped.

## Sync scope: incremental by default

Each scheduled run fetches only the **newest page** (up to 100 posts) — fine for a sync running
every few hours on a personal account, and cheap. To backfill deeper history (e.g. the first time
this is set up, or after a long gap), trigger the workflow manually from the Actions tab
("Run workflow") with **backfill** checked — this sets `BSKY_SYNC_ALL=true`, which makes the
script paginate through the entire author feed (capped at 2000 posts as a safety net against a
runaway loop) instead of stopping after one page.

## Editing a synced note afterward

Synced notes are ordinary files once written — editable through Decap CMS like any other note
(`public/admin/config.yml` exposes `bskyPostUri` there too, as a read-only-by-convention hint
field: "set automatically... leave blank for hand-written notes") or by hand. The sync script
never touches a file it already created — there's no "sync back" in the other direction, so
editing a synced note's title/body afterward is safe and permanent.

## Setup / configuration

Nothing to configure for the default account (`furioursus.dev`, hardcoded as the script's
default and as `siteConfig.bskyHandle`). To point this at a different Bluesky account, set the
`BSKY_ACTOR` environment variable on the workflow step (accepts either a handle or a DID) and
update `siteConfig.bskyHandle` in `src/site.config.ts` to match, so the rendered Bluesky links
resolve correctly.

## Gotchas

- **Self-replies are excluded**, not just replies to other accounts — `filter=posts_no_replies`
  drops an entire self-thread down to nothing here. If you want your own reply-chains synced as
  notes too, that needs a deliberate schema/behavior change, not a config flag.
- **No secrets, no rate-limit concerns in practice** — the public AT Protocol endpoint used here
  needs no auth and is meant for exactly this kind of read. If Bluesky ever rate-limits
  unauthenticated traffic more aggressively, switching to an authenticated `@atproto/api` client
  would be the fix, not a workaround in this script.
- **A deleted Bluesky post is never removed here.** The sync only ever adds files — deleting the
  original post on Bluesky doesn't touch the note that was already synced from it. Removing a
  synced note is a manual `content/notes/bsky-<rkey>/` deletion, same as removing any other note.
