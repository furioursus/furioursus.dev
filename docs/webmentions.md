# Webmentions

Likes, reposts, and replies from around the web, pulled from [Webmention.io](https://webmention.io/)
and rendered under each post. Webmention.io does the actual receiving (someone else's site pings it
when they link to a post here); this repo only fetches and displays what's accumulated.

## Fetching + caching — `src/utils/webmentions.ts`

- Calls `https://webmention.io/api/mentions.jf2`, filtered to `like-of` / `repost-of` / `mention-of` / `in-reply-to`
  types, authenticated via `WEBMENTION_API_KEY` (see `.example.env` / repo root `README.md`).
- Domain used for the lookup defaults to the `site` hostname in `astro.config.ts`, overridable via
  `WEBMENTION_DOMAIN` for cases like a verified `www.` subdomain differing from the canonical host.
- **Cached at `.data/webmentions.json`** (git-ignored), not under Astro's `cacheDir` — deliberately,
  since `cacheDir` lives under `node_modules` and gets wiped on every `npm install`. Each fetch
  requests only mentions newer than the cache's last-seen timestamp and merges by `wm-id`, so
  rebuilds don't re-fetch the full history every time.
- **This caching strategy assumes a writable, persistent filesystem** (true for this site's static
  build, and for a long-lived SSR server). It would break on serverless/edge SSR (ephemeral,
  sometimes read-only filesystem) — noted in a comment at the top of the file for whoever migrates
  hosting later.

## Rendering — `src/components/blog/webmentions/`

- **`index.astro`** — fetches for the current URL, bails out entirely (renders nothing, not even the
  "Webmentions for this post" heading) if there are none.
- **`AvatarMentions.astro`** — the avatar-only strip, rendered twice from `index.astro`: once with
  `property="like-of"` / `mf2="p-like"`, once with `property="repost-of"` / `mf2="p-repost"`. The
  source post's content isn't the point for these, so only the author photo is shown.
  It replaced separate `Likes.astro` / `Reposts.astro`, which were the same forty lines twice and
  had drifted: reposts had lost the microformats markup (`p-repost h-cite` on the `li`, `u-url` on
  the anchor) that likes still carried, so parsers couldn't read them at all.
- **`Comments.astro`** — replies, rendered as actual reply content rather than avatars.

Note the coupling worth remembering: a `property` passed here must also appear in
`validWebmentionTypes` (`src/utils/webmentions.ts`), which filters _before_ the cache is written.
`repost-of` was missing from it, so reposts were silently dead in production while local dev — which
still had pre-filter entries in its gitignored `.data/` cache — looked fine.

## Adding webmentions to a new domain

Sign in to Webmention.io with the domain, get an endpoint + token, set `WEBMENTION_API_KEY` (and
`WEBMENTION_DOMAIN` if needed) in `.env`. Full walkthrough in the repo root `README.md`'s Configure
section.
