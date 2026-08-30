# Record collection

The "Vinyl collection" section of [`/music/`](../src/pages/music.astro) (formerly its own
`/vinyl-collection/` page — see [`docs/lastfm.md`](./lastfm.md) for the rest of that page) renders
a searchable, filterable grid of my vinyl collection, pulled from Discogs at build time via the
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
  `RecordCard`'s cover and its artist/title/meta text (`.info`) are two separate click targets: the
  image opens the lightbox, the text links out to the Discogs release page. Cover art is no longer
  purely decorative (it's its own interactive element now), so it carries a real, per-cover alt
  describing the artwork itself — see "Cover art alt text" below — falling back to
  `"{artist} – {title}"` for any release that hasn't been backfilled yet. The rare case where a
  release's cover hasn't been cached locally yet gets a hand-rolled lightbox around the plain
  `<img>` pointed at the remote `coverImageUrl` instead of `LightboxImage.astro` — see
  lightbox.md's "hand-rolled path" section for why.
- The artist/title/meta link only shows in the card from `sm` down — `hasLightbox` in
  `RecordCard.astro` conditionally adds a plain `sm:hidden` Tailwind utility to it. That utility
  used to silently lose to a same-file scoped `<style>` rule: Astro tacks a `[data-astro-cid-xxxx]`
  attribute selector onto every rule in a component's scoped `<style>`, so a `.info { display: block }`
  defined there outranked a plain `.sm\:hidden` utility class on specificity regardless of source
  order, even though its media query matched correctly. `RecordCard.astro` no longer has a scoped
  `<style>` block at all (its CSS was ported to inline Tailwind utilities), which is what actually
  fixes this — `sm:hidden` now competes with an equally-specific plain `block` utility instead of a
  boosted-specificity scoped one, so ordinary cascade order resolves it correctly, same as this
  pattern works everywhere else in the codebase. From `sm` up, the same three pieces of info
  reappear inside the cover's lightbox dialog instead — the same markup passed via
  `LightboxImage.astro`'s `dialog-caption` slot (or written directly into the dialog markup, for the
  hand-rolled remote-cover path) — see [`docs/lightbox.md`](./lightbox.md)'s "Dialog-only, richer
  captions". A dense grid of just covers reads better at desktop widths, but a release without any
  cover art at all has no dialog to hold that info instead, so the no-cover `placeholder` path is
  exempt: its info stays visible there at every width, since it's the only place that information
  ever appears.
- Covers inside `VinylCollection.astro`'s grid navigate as one gallery — Next/Previous buttons and
  ArrowLeft/ArrowRight inside the dialog, wrapping at either end, skipping anything currently
  filtered out — via a plain `data-lightbox-gallery` attribute on `.grid`. See
  [`docs/lightbox.md`](./lightbox.md)'s "Gallery grouping and navigation" for how that's detected
  (structurally, not a per-image prop) and why filtered-out records are excluded.
- `RecordCard`'s title renders as an `<h2>` by default, via a `titleLevel?: 1 | 2 | 3 | 4 | 5 | 6 |
  false` prop (`false` renders a plain `<p>` instead). `VinylCollection.astro` passes
  `titleLevel={3}` since cards sit under that section's own "Vinyl collection" `<h2>` (rendered by
  `music.astro`, one level up), not directly under the page's `<h1>` — reach for the prop again if
  `RecordCard` ever moves to yet another heading depth.

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
  `{ "<id>": { artist, title, alt, reviewed: false, model, generatedAt } }`. `artist`/`title` are
  written for human scanning only (a JSON object keyed by opaque numeric IDs is otherwise
  unreadable) — nothing at runtime reads them. `RecordCard.astro` imports this directly for `alt`
  and falls back to `"{artist} – {title}"` for any release missing an entry (a fresh checkout, or
  one added since the last run).
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
`src/components/VinylCollection.astro` (rendered by `music.astro`, which does the Discogs fetch/
sort and passes the result down as props) renders every release into the grid up front, each `<li>`
carrying lowercased `data-*` attributes (`data-search`, `data-genres`, `data-formats`,
`data-artist`, `data-title`, `data-year`, `data-date-added`) that a `<record-collection>` custom
element (colocated with that markup in the same file, following the `ThemeToggle.astro` pattern
documented in [`docs/README.md`](./README.md)) reads to show/hide and reorder items in response to
the search box, genre/format `<select>`s, and sort `<select>`. Nothing is removed from the DOM —
filtering just toggles the `hidden` attribute — so the "N of M records" count and the empty-state
message just reflect what's currently visible.

This is a different search mechanism from the site's Pagefind-based content search — see
[`docs/search.md`](./search.md) — because Pagefind only indexes prose inside a
`data-pagefind-body` element (blog posts and notes) and doesn't fit a filterable data grid.

## Cover size toggle

A radio group (`.size-toggle`, styled as a segmented button toggle — same dashed-border look as
the search/filter controls) lets a visitor pick the grid's cover size: 10rem/13rem/18rem, driving
`--cover-size` in `.grid`'s `grid-template-columns: repeat(auto-fill, minmax(var(--cover-size),
1fr))`. Only shown from `sm` up — below that breakpoint the grid isn't a grid at all, it's
`RecordCard.astro`'s own fixed-size single-column row layout (see its "Mobile-first" comment), so
there'd be nothing for the control to do.

Picked via native radio inputs, not a custom click handler on styled `<button>`s (contrast the
period tabs in `docs/lastfm.md`) — a `type="radio"` group gets mutually-exclusive selection and
arrow-key navigation for free, which fits a "pick one of three" control better than tabs (which
imply switching between different *content*, not a display preference). The inputs themselves are
visually hidden (clipped, not `display: none`, so they stay focusable) via `.size-option input`;
`.size-option:has(input:checked)` gives the checked one the same active look the tabs use.

The choice persists to `localStorage` (`vinyl-cover-size`) via `RecordCollection`'s
`#setCoverSize()`/`#readStoredCoverSize()`, read back and re-applied — to both the CSS variable and
which radio is `checked` — in `connectedCallback()`. Server-rendered markup always checks "Medium"
(`DEFAULT_COVER_SIZE`, `13rem`); a returning visitor with a different stored size gets one brief
reflow to the right column width on load rather than a blocking inline script to avoid it — the
same trade-off this component already makes for search/filter/sort state, none of which is
persisted either. `localStorage` calls are wrapped in `try`/`catch` (private browsing/disabled
storage) — the toggle still works for that pageview, it just won't stick for the next one.

## Gotchas

- `queryCollection()`'s `where.format`/`where.genre` filters match against **any** of the values a
  release has, and would need query-string state to work as URL-shareable filters — the current
  page deliberately keeps filter state client-only and unshared, favoring simplicity.
- The format `<select>` lists every distinct token across all releases' `formats` arrays (e.g.
  `"Vinyl"`, `"LP"`, `"Album"`, `"Reissue"` are separate options) since the package doesn't
  distinguish "physical format" from format descriptors — see `DiscogsRelease.formats` in
  `astro-discogs-collection`'s `types.d.ts`.
- `/music/` is listed in `menuLinks` in `src/site.config.ts`; if `DISCOGS_USERNAME`/`DISCOGS_TOKEN`
  are never set in an environment, the page still loads (the Last.fm sections above render
  independently) but its vinyl section shows the setup notice instead of the grid.
- `/vinyl-collection/` used to be this page's own URL; `public/_redirects` 301s it to `/music/`
  now that the vinyl grid is a section of that page instead.
