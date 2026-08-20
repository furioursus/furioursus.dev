# Webmentions

Likes, reposts, and replies from around the web, pulled from [Webmention.io](https://webmention.io/)
and rendered under each post. Webmention.io does the actual receiving (someone else's site pings it
when they link to a post here); this repo only fetches and displays what's accumulated.

## Fetching + caching — `src/utils/webmentions.ts`

- Calls `https://webmention.io/api/mentions.jf2`, filtered to `like-of` / `mention-of` / `in-reply-to`
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
- **`Likes.astro`**, **`Reposts.astro`**, **`Comments.astro`** — one component per mention type,
  each rendering its own slice of the fetched list. Comments render as actual reply content;
  likes/reposts render as an avatar-only strip (the source post's content isn't the point there).

## Adding webmentions to a new domain

Sign in to Webmention.io with the domain, get an endpoint + token, set `WEBMENTION_API_KEY` (and
`WEBMENTION_DOMAIN` if needed) in `.env`. Full walkthrough in the repo root `README.md`'s Configure
section.
