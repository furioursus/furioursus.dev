# Music listening (Last.fm)

[`/music/`](../src/pages/music.astro) — the same page that hosts the [vinyl collection](./discogs.md) —
also shows what I'm currently/last listening to and my Last.fm stats. Unlike the vinyl section,
which is entirely build-time, the now-playing widget is genuinely live: it polls Last.fm from the
visitor's own browser.

## Why client-side, not build-time

This site has no server runtime — no Astro `output: "server"`, no adapter, no Netlify Functions
(`astro.config.ts` registers zero of those). A "now playing" element that only updated on the next
deploy wouldn't be live at all, so it has to fetch from wherever the page is actually being viewed:
the browser.

That's a deliberate trade-off: `LASTFM_API_KEY` and `LASTFM_USERNAME` are declared with
`context: "client", access: "public"` in `astro.config.ts`'s `env.schema`, meaning they ship in the
client JS bundle, readable by anyone who looks. This is fine because a bare Last.fm `api_key` is
**read-only** — Last.fm's write/session-authenticated calls need a separate user-auth handshake
(session key) that isn't involved here at all. Worst case someone borrows the key for their own
read-only calls against the (generous) shared rate limit; nothing about this account is at risk.

Because the vars are `context: "client"` (not `"server"`), the same `astro:env/client` import
resolves identically in `music.astro`'s frontmatter (build time, for the top-stats fetch below) and
in a browser `<script>` (the live widget) — see `src/utils/lastfm.ts`'s top comment.

## `src/utils/lastfm.ts`

The shared client for `ws.audioscrobbler.com`'s `user.*` methods. Two entry points:

- **`loadMusicStats()`** — called once from `music.astro`'s frontmatter at build time. Fetches
  `user.gettopartists`/`gettopalbums`/`gettoptracks` for every range in `LASTFM_PERIODS` (`7day`,
  `1month`, `12month`, `overall` — the same ranges Last.fm's own profile page offers), 10 items
  each. Returns `{ missingConfig, error, periods }` — the same three-state shape
  `astro-discogs-collection`'s `loadCollection()` uses (see [`docs/discogs.md`](./discogs.md)), so
  the page's setup-notice / error / content branches read the same way for both sections.
- **`fetchNowPlaying()`** — called repeatedly from the browser (`LastfmNowPlaying.astro`'s
  `<script>`). Fetches `user.getrecenttracks&limit=1` and normalizes the single most recent
  scrobble: `nowPlaying: true` if Last.fm's `@attr.nowplaying` flag is set (nothing sets a `date`
  on the currently-playing track), otherwise `playedAt` is the scrobble's timestamp.

Neither entry point fetches or renders cover art — both the ranked lists and the now-playing strip
are text-only (rank/name/artist/playcount for one, track/artist/album for the other). That's
deliberate, not an oversight: Last.fm retired real per-artist photos site-wide years ago —
`artist.image` is now *always* the same gray-star placeholder
(`2a96cbd8b46e442fc41c2b86b821562f.png`, identical hash for literally every artist, verified
against Madonna/Gorillaz/Daft Punk-tier names, not just obscure ones) — and `user.gettoptracks`/
`user.getrecenttracks` have the same dead-placeholder problem on their own `track.image`. Real art
*was* recoverable in a couple of places (`user.gettopalbums`' own `image`, and a `track.getinfo`
lookup for a track's album cover), but between those and the artist/track fields that never had
anything, art showed up inconsistently — some rows with a cover, most without. Dropped entirely
rather than kept partial; simpler and more compact besides.

## Live now-playing widget

`src/components/LastfmNowPlaying.astro` defines a `<lastfm-now-playing>` custom element (same
pattern as `ThemeToggle.astro` / `record-collection` — see `docs/README.md`'s conventions section).

- Starts `hidden`; the first successful `fetchNowPlaying()` reveals it. Renders nothing (stays
  hidden) if the fetch fails or Last.fm has no scrobbles at all — this is a quiet corner of the
  page, not something that should show a visible error state.
- Polls every 30s (`POLL_INTERVAL_MS`) via `setInterval`, paused while the tab is hidden
  (`document.visibilitychange`) and immediately refreshed on becoming visible again, since a
  backgrounded tab could be stale by hours.
- On a fetch failure mid-poll, keeps showing the last-known state rather than clearing it — a
  transient Last.fm hiccup shouldn't make the widget flicker away.
- Swaps between a play glyph ("Now playing") and a history glyph ("Last played 3 hours ago", via
  `getRelativeTime()` in `src/utils/date.ts`) with a CSS class (`.is-playing`) rather than changing
  the icon's `name` prop, so there's no extra request mid-poll — both `<Icon>`s are in the DOM from
  first render, one hidden by CSS.

## Listening stats

`src/components/LastfmListeningStats.astro` (rendered by `music.astro`, which does the
`loadMusicStats()` fetch and passes `musicStats.periods` down as a prop) renders one
`.period-panel` per `LASTFM_PERIODS` entry (each holding three `LastfmRankedList.astro` lists —
artists/albums/tracks), all server-rendered up front. A `<lastfm-period-tabs>` custom element,
colocated with that markup in the same file (same `ThemeToggle.astro` pattern as
`record-collection` — see `docs/README.md`'s conventions section), just toggles which panel is
visible on tab click — no re-fetch, same "everything's already in the DOM, JS only shows/hides"
philosophy as the vinyl grid's client-side filtering (see [`docs/discogs.md`](./discogs.md)'s
"Search/filter/sort" section). That keeps the build-time API call count fixed at 4 periods × 3
endpoints = 12 calls regardless of how often a visitor flips between tabs — there's no per-track
art backfill here (see above), so this is the *whole* cost of the section, not just the primary
fetch.

Each panel also shows a totals line ("91 artists · 99 albums · 122 tracks") above the three lists —
that's `MusicStatsPeriod.totalArtists`/`totalAlbums`/`totalTracks`, read off each response's own
`@attr.total`. Last.fm computes that as the *unique* count for the whole period (paging metadata
for a list-of-10-per-category-per-period we only ever fetch page 1 of, per `TOP_LIMIT`), not the
sum of the top 10's playcounts — so it's a real "how many different artists/albums/tracks did I
hear this period" number, free of any extra request beyond the primary fetch above.

## Gotchas

- If `LASTFM_API_KEY`/`LASTFM_USERNAME` are unset, `music.astro` shows a setup notice for the
  Last.fm sections and skips rendering `<LastfmNowPlaying />` and the stats tabs entirely — the
  vinyl section below still renders independently (it has its own `DISCOGS_*` config check).
- `fetchNowPlaying()` and `loadMusicStats()` both throw on a Last.fm API error response (`data.error`
  present in the JSON) rather than returning a partial result — `loadMusicStats()` catches that
  itself and surfaces it as `{ error }`; `fetchNowPlaying()` lets it propagate, and
  `LastfmNowPlayingElement#refresh()` catches it per-poll so one bad tick doesn't unmount the widget.
- Last.fm's `format=json` endpoint supports CORS for `GET` requests, which is what makes the
  client-side polling possible at all — there's no proxy in front of it.
