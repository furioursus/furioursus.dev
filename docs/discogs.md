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
  release ID and falls back to the Discogs-hosted `coverImageUrl`, then a text placeholder. Cover
  art is decorative (`alt=""`) since the artist/title render as visible text right below it in the
  same link.
- `RecordCard`'s title renders as an `<h2>` by default, via a `titleLevel?: 1 | 2 | 3 | 4 | 5 | 6 |
  false` prop (`false` renders a plain `<p>` instead). `h2` is correct as long as the card sits
  directly under the page's one `<h1>`, as it does on `/vinyl-collection/` today — reach for the
  prop if `RecordCard` ever gets reused somewhere with a different heading structure.

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
