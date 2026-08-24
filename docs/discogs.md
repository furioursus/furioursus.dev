# Record collection

`/vinyl-collection/` ([src/pages/vinyl-collection.astro](../src/pages/vinyl-collection.astro)) renders a searchable,
filterable grid of my vinyl collection, pulled from Discogs at build time via the
[`astro-discogs-collection`](https://www.npmjs.com/package/astro-discogs-collection) integration.

## How it's wired

- `astroDiscogsCollection()` is registered in `astro.config.mjs`. It reads `DISCOGS_USERNAME` and
  `DISCOGS_TOKEN` from the environment (see the comment above `process.loadEnvFile()` in
  `astro.config.mjs` for why that call exists — Vite 6+ stopped populating `process.env` from
  `.env` automatically, and the integration reads `process.env` directly, not `import.meta.env`).
- `loadCollection()` (from `astro-discogs-collection/collection`) fetches the collection once at
  build time and returns `{ releases, missingConfig, error }`. Without the two env vars set,
  `missingConfig` is `true` and the page renders a setup notice instead of the grid.
- `queryCollection()` does the initial server-side sort (`sortBy: "artist"`); `summarize()` derives
  the total/artist counts and the sorted, deduped genre list used to populate the genre `<select>`.
- Cover art is served locally when available — `getLocalCoverImage()` (from
  `astro-discogs-collection/images`) in `src/components/RecordCard.astro` looks up a cached image by
  release ID and falls back to the Discogs-hosted `coverImageUrl`, then a text placeholder.
- Cover art opens in the [lightbox](./lightbox.md) at click, enlarging to the release's full
  resolution — not just the 500×500 thumbnail — since `getLocalCoverImage()` returns Astro image
  metadata for the originally-cached (uncropped, undownsized) file. Because a lightbox trigger
  renders as a `<button>`, which can't legally nest inside the card's own `<a href={releaseUrl}>`,
  `RecordCard`'s cover and its artist/title/meta text are two separate click targets: the image
  opens the lightbox, the text still links out to the Discogs release page. Cover art is no longer
  purely decorative (it's its own interactive element now), so it carries a real, per-cover alt
  describing the artwork itself — see "Cover art alt text" below — falling back to
  `"{artist} – {title}"` for any release that hasn't been backfilled yet. The rare case where a
  release's cover hasn't been cached locally yet gets a hand-rolled lightbox around the plain
  `<img>` pointed at the remote `coverImageUrl` instead of `LightboxImage.astro` — see
  lightbox.md's "hand-rolled path" section for why.
- `RecordCard`'s title renders as an `<h2>` by default, via a `titleLevel?: 1 | 2 | 3 | 4 | 5 | 6 |
  false` prop (`false` renders a plain `<p>` instead). `h2` is correct as long as the card sits
  directly under the page's one `<h1>`, as it does on `/vinyl-collection/` today — reach for the
  prop if `RecordCard` ever gets reused somewhere with a different heading structure.

## Cover art alt text

Once cover art became its own clickable lightbox trigger (see above), `"{artist} – {title}"` as
its alt stopped being enough — that's metadata already sitting as visible text right next to the
image, not a description of what's actually on the cover. `scripts/generate-cover-alt.mjs` backfills
real, per-release descriptions of the artwork itself (subject, color, composition) using Claude
Opus 5's vision, one sentence each, generated from the same locally-cached cover file the lightbox
enlarges.

- **Run it manually** (`pnpm generate:cover-alt`) after adding new records — it's not wired into
  `astro dev`/`astro build`. Needs `ANTHROPIC_API_KEY` (and the usual `DISCOGS_USERNAME`/
  `DISCOGS_TOKEN`) in `.env`.
- **Output**: `src/data/discogs-cover-alt.json`, keyed by release ID —
  `{ "<id>": { alt, reviewed: false, model, generatedAt } }`. `RecordCard.astro` imports this
  directly and falls back to `"{artist} – {title}"` for any release missing an entry (a fresh
  checkout, or one added since the last run).
- **Committed to the repo on purpose** — unlike `src/assets/discogs-collection/` (the cover-image
  cache), which is gitignored and rebuilt from scratch every build. Netlify's production build
  never calls the Anthropic API or needs the key; it just reads whatever's already committed. Only
  a local run needs the key, and only when new records exist without an entry yet.
- **Never overwrites an existing entry**, including ones still flagged `reviewed: false` — a
  human's hand-edit to the `alt` text always sticks, re-running only fills gaps for new releases.
  `reviewed: false` is purely informational (nothing reads it at runtime); it's the punch list for
  a human pass — the script's own summary line reports how many entries still need one.
- **Cover-file lookup matches by ID, not by reconstructing the filename**: the image cache names
  files `{artist-slug}_{title-slug}-{id}.jpg` (`astro-discogs-collection`'s internal `slug.js`,
  not part of its public `exports`), so the script lists `imageCacheDir` once and matches the
  trailing `-{id}.jpg`, rather than re-implementing that package's slugify logic and risking a
  mismatch (accented names, etc.).

## Search/filter/sort is all client-side, no re-fetch

Because the whole collection is static at build time, filtering doesn't need a server round trip.
`src/pages/vinyl-collection.astro` renders every release into the grid up front, each `<li>` carrying
lowercased `data-*` attributes (`data-search`, `data-genres`, `data-formats`, `data-artist`,
`data-title`, `data-year`, `data-date-added`) that a `<record-collection>` custom element (defined
in a `<script>` in the same file, following the `ThemeToggle.astro` pattern documented in
[`docs/README.md`](./README.md)) reads to show/hide and reorder items in response to the search
box, genre/format `<select>`s, and sort `<select>`. Nothing is removed from the DOM — filtering
just toggles the `hidden` attribute — so the "N of M records" count and the empty-state message
just reflect what's currently visible.

This is a different search mechanism from the site's Pagefind-based content search — see
[`docs/search.md`](./search.md) — because Pagefind only indexes prose inside a
`data-pagefind-body` element (blog posts and notes) and doesn't fit a filterable data grid.

## Gotchas

- `queryCollection()`'s `where.format`/`where.genre` filters match against **any** of the values a
  release has, and would need query-string state to work as URL-shareable filters — the current
  page deliberately keeps filter state client-only and unshared, favoring simplicity.
- The format `<select>` lists every distinct token across all releases' `formats` arrays (e.g.
  `"Vinyl"`, `"LP"`, `"Album"`, `"Reissue"` are separate options) since the package doesn't
  distinguish "physical format" from format descriptors — see `DiscogsRelease.formats` in
  `astro-discogs-collection`'s `types.d.ts`.
- `/vinyl-collection/` is listed in `menuLinks` in `src/site.config.ts`; if `DISCOGS_USERNAME`/
  `DISCOGS_TOKEN` are never set in an environment, the nav link still appears but leads to the
  setup-notice state described above rather than a 404.
