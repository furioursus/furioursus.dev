# MTG collection

[`/mtg/`](../src/pages/mtg.astro) renders a searchable, filterable grid of my Magic: The Gathering
collection, pulled from a [ManaBox](https://manabox.app/) CSV export and enriched with live
[Scryfall](https://scryfall.com/docs/api) data at build time via the
[`astro-mtg-collection`](https://github.com/furioursus/astro-mtg-collection) integration. It's a
standalone sibling page to [`/music/`](./discogs.md), following the same fetch/render split, not a
section of it — the two collections are unrelated hobbies, unlike Last.fm/vinyl which share one
"Music" page.

## How it's wired

- `mtgCollection({ cacheImages: false })` is registered in `astro.config.ts`. Unlike
  `astro-discogs-collection`, it needs no API credentials — it reads a CSV export directly, no env
  vars. `cacheImages: false` is explained below.
- The collection export lives at `src/data/collection.csv` (the package's default `csvPath`) and
  **is committed to the repo** — unlike its derived Scryfall-data cache below, there's no live
  account to re-fetch from at build time, so the export itself is the source of truth. Re-export
  from ManaBox (Collection → menu → Export → CSV) and overwrite this file to update the collection;
  the next build re-resolves everything from the new rows.
- `loadCollection()`/`queryCollection()`/`summarize()`/`uniqueSorted()`/`RARITY_ORDER` are imported
  from **`astro-mtg-collection/collection`**, not the bare package — see that subpath's own doc
  comment (and the package's README) for why: the main entry also re-exports the Astro integration,
  whose import chain reaches its Vite plugin, and importing data functions from *that* entry once
  broke `astro build` outright (Rollup inlined a broken copy of Vite's own internals into this
  page's build). Fixed at the package level by splitting the two concerns into separate entry
  points — this site just has to keep importing from the right one.
- `loadCollection()` parses the CSV and resolves each row against Scryfall — by Scryfall ID when
  the export has one (ManaBox always does), falling back to set+collector-number or name-only
  matching for thinner export formats. Returns `{ cards, missingFile, error }`; `missingFile` is
  `true` when the CSV doesn't exist (a fresh checkout without the export), and the page renders a
  setup notice instead of the grid.
- `queryCollection()` does the initial server-side sort (`sortBy: "name"`); `summarize()` derives
  the unique-card/total-copies/total-value counts shown above the grid; `uniqueSorted()` builds the
  rarity and foil `<select>` option lists (rarities re-sorted by `RARITY_ORDER` afterwards, so the
  dropdown reads common→mythic instead of alphabetically).
- Card art renders straight from Scryfall's own hosted `imageUrl` — a plain `<img>` in
  `CardTile.astro`, not `getLocalCardImage()`/astro:assets the way `RecordCard.astro`'s cover art
  works. See "Card images load directly from Scryfall" below for why.
- Card art opens in the [lightbox](./lightbox.md) at click, same two-click-target split as
  `RecordCard.astro` (see [`docs/discogs.md`](./discogs.md)): the art opens the lightbox, the
  name/set/price text below links out to the card's Scryfall page — except for the rare unresolved
  row, which has no Scryfall match to link to and renders as plain text instead of a dead link.
- Cards inside `CardCollection.astro`'s grid navigate as one gallery (Next/Previous, arrow keys,
  wrapping, skipping filtered-out cards) via the same `data-lightbox-gallery` attribute pattern —
  see [`docs/lightbox.md`](./lightbox.md).

## Card images load directly from Scryfall

`CardTile.astro` renders a plain `<img src={entry.imageUrl}>` — Scryfall's own hosted "normal"
image — with no local download, resize, or `astro:assets` optimization step at all. Two separate
reasons landed on this, worth keeping apart:

1. **A real build failure, since fixed elsewhere.** `astro build` once failed specifically
   prerendering `/mtg/` (every other route, including `/music/`, built fine), deep inside an
   Astro/Vite internal function that should never run during a static build. The image count
   looked like the obvious suspect at the time (~6,200 unique cards, an order of magnitude beyond
   any other page) and a batch pre-optimization step was built to sidestep it — but swapping every
   card to plain `<img>` and removing `astro:assets` entirely reproduced the *exact same error*,
   which ruled the image-volume theory out. The real cause was a Rollup-bundling bug in how
   `astro-mtg-collection` structured its exports (see "How it's wired" above) — fixed at the
   package level, unrelated to how card art itself is rendered.
2. **Ephemeral hosting makes local caching pointless anyway.** Even with that bug fixed, a local
   image cache (raw JPGs, or a resized/optimized copy) buys nothing on hosts like Netlify — nothing
   persists between builds, so downloading or processing ~6,200 images just to discard the whole
   checkout afterward is pure waste, paid on *every* build, forever. `cacheImages: false` in
   `astro.config.ts`'s `mtgCollection()` call skips the package's own image-download step entirely
   (added specifically to support this — see its README); rendering straight against `imageUrl`
   skips the rest.

The tradeoff: one fixed size for both the grid thumbnail and the lightbox's enlarged view, no
responsive `srcset`, and art depends on Scryfall's own CDN being up — acceptable here since Astro's
per-page image optimization was never buying anything durable in this deployment model to begin
with.

## Full art / extended art

`astro-mtg-collection` flags each card's `EnrichedCard.isFullArt`/`isExtendedArt` booleans
(Scryfall's `full_art`/`border_color`/`frame_effects` fields under the hood — see the package's own
README). `CardTile.astro` appends "Full Art"/"Extended Art" to the existing set/rarity meta line
when either is true (both can apply to the same printing) — no new visual treatment, just extends
the plain-text line already there. `CardCollection.astro` also exposes them as a `data-full-art`/
`data-extended-art` filter (`<select data-art-select>`, values `""`/`"full"`/`"extended"`), the
same client-side `data-*`-attribute pattern the color/rarity/foil filters already use — see
"Search/filter/sort is all client-side, no re-fetch" below.

## Prices are shown

Unlike a purely aesthetic collection, unit price (per the row's foil/nonfoil/etched printing) and,
for stacks of more than one copy, the line total (`unitPrice * quantity`) are both shown on every
card and summed into the page's running total — this is public on the site, not hidden or
summarized-only, by explicit choice. A card Scryfall has no USD price for (rare, unreleased, or a
promo print) shows "Price unknown" instead of `$0.00` or blank.

## Search/filter/sort is all client-side, no re-fetch

Same mechanism as the vinyl collection (see [`docs/discogs.md`](./discogs.md)'s section of the same
name) — `src/components/CardCollection.astro` renders every card into the grid up front, each `<li>`
carrying lowercased `data-*` attributes (`data-search`, `data-color`, `data-rarity`, `data-foil`,
`data-full-art`, `data-extended-art`, `data-name`, `data-price`, `data-set`, `data-collector`,
`data-quantity`) that a `<card-collection>` custom element reads to show/hide and reorder cards in
response to the search box, color/rarity/foil/art `<select>`s, and sort `<select>`. Nothing is
removed from the DOM — filtering (and, below, pagination) just toggles the `hidden` attribute.

- **Pagination** is a second `hidden`-toggling pass layered on top of filtering, not a separate
  mechanism — `#applyFilters()` narrows `#items` down to `#filtered` (still full DOM nodes, just a
  smaller in-memory array), then `#renderPage()` shows only the current `PAGE_SIZE`-card slice of
  *that* array and hides the rest, including everything filtering already excluded. Changing any
  filter or the sort key rebuilds `#filtered` and resets to page one — there's no stored page state
  to reconcile against results that may no longer exist. `[data-pagination]` (the Prev/Next
  controls — one copy above the grid, one below, so a full page's scroll never leaves you far from
  either) hides itself whenever the current filtered set fits on one page, same `hidden`-attribute
  convention as `[data-empty]` above it. Gallery Next/Prev navigation (see
  [`docs/lightbox.md`](./lightbox.md)) already skips `[hidden]` ancestors for filtering's sake, so it
  falls out for pagination for free — the lightbox only ever cycles within the current page's
  visible cards, not the whole filtered set.
- **The grid's height is floored, not just its card count kept constant.** A short last page
  (different cards wrap their name/price text over a different number of lines, so it's not purely a
  card-count thing) would otherwise visibly shrink `.grid` and yank the pagination bar/footer up to
  meet it. `#renderPage()` tracks the tallest `.grid` has actually rendered this visit
  (`#maxGridHeight`) and sets `min-height` to that floor *before* measuring the new page — doing it
  in that order is what stops the browser from laying the shorter page out at its own natural height
  for even one frame first. A column-count change (a resize crossing the mobile/desktop breakpoint)
  invalidates that recorded number outright — a single-column mobile list and a multi-column desktop
  grid have nothing in common height-wise for the same card count — so a `resize` listener drops the
  floor back to zero rather than carrying over a number that's now meaningless; the next page render
  re-establishes one that's actually right for the new layout. An earlier version of this tried
  padding the last page with cloned filler grid cells instead, sized to match a real card — it kept
  the *cell count* constant but not the height, since a page of identical clones can't reproduce the
  natural height variance real cards have from wrapping differently. Measuring and flooring against
  what was actually rendered sidesteps that assumption entirely.

- **Color** filters against `data-color`, a pipe-separated list built from the card's
  `color_identity` (a colorless card gets `["C"]`) — picking "White" matches any card whose identity
  *includes* white, multicolor cards included, mirroring `queryCollection()`'s own `where.color`
  semantics server-side.
- **Sort** keys (`name-asc`/`name-desc`/`price-desc`/`price-asc`/`set`/`quantity-desc`/`rarity`)
  intentionally match `astro-mtg-collection`'s own (type-only exported) `SortKey` union — the
  package's `sortCards()` function itself isn't exported from the package (only the type is, as a
  suggested shape), so `CardCollection.astro`'s client `<script>` hand-rolls its own comparators
  reading `data-*` attributes instead, the same way `VinylCollection.astro` does for its own local
  `SortKey` type. The `rarity` comparator's `RARITY_ORDER` map is a small hand-copied constant for
  the same reason — pulling in the actual package export would mean bundling
  `astro-mtg-collection` into client-side JS for one lookup table.
- No **set** filter, despite `data-set`/`data-collector` existing (for the `set` sort's tie-break) —
  Magic has 900+ sets, too many for a plain `<select>` to be usable without its own search-within
  affordance. `data-set`/`data-collector` exist purely to support the `set` sort key.
- No cover-size toggle (contrast `VinylCollection.astro`'s `.size-toggle`) — cards have one natural
  aspect ratio and the grid's `minmax(13rem, 1fr)` column size is fixed; there's no size preference
  for a toggle to control.

## Gotchas

- **Collection scale.** This export is ~8,300 rows / ~6,200 unique cards — about 20x the size of
  the vinyl collection. Every card still renders into the DOM unpaginated (a deliberate choice, to
  stay consistent with `/music/`'s pattern) — images are lazy-loaded so this doesn't block first
  paint. This scale is also *why* card art skips local caching/`astro:assets` entirely — see "Card
  images load directly from Scryfall" above.
- `.cache/mtg-collection/` (the Scryfall JSON/bulk-data cache — prices, card details) is gitignored
  and regenerable from `src/data/collection.csv`, same treatment as `astro-discogs-collection`'s
  equivalent cache. With `cacheImages: false`, the package's *image* cache directory
  (`imageCacheDir`, `src/assets/mtg-collection/` by default) is never created at all.
- `/mtg/` is listed in `menuLinks` in `src/site.config.ts`. If `src/data/collection.csv` is ever
  removed (e.g. a fork without the real export), the page still builds and loads — `loadCollection()`
  reports `missingFile: true` and the page shows a setup notice instead of the grid, same fallback
  pattern as `/music/`'s vinyl section without Discogs credentials.
- **The pnpm version matters, and has to stay pinned identically everywhere.**
  `astro-mtg-collection` is a `github:`-sourced git dependency with its own `prepare` build script,
  which needs a `pnpm-workspace.yaml` `onlyBuiltDependencies` entry to run at all (git-hosted deps
  aren't covered by pnpm's built-in trusted-package list the way registry packages are — see
  `pnpm-workspace.yaml`'s own comment). That entry's required *shape* isn't stable across pnpm point
  releases: 10.30.3 and 10.33.0 both hard-fail parsing a version-qualified git-URL entry
  (`ERR_PNPM_INVALID_VERSION_UNION`), while 10.34.5 requires exactly that qualified form and
  rejects the plain package name instead (`ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`) — no single
  config value satisfies both. Found the hard way: GitHub Actions (floating `pnpm/action-setup@v4`
  major-version resolution) and Netlify (Corepack, which ignores a `PNPM_VERSION` env var entirely
  and instead reads `package.json`'s `packageManager` field) silently landed on two different pnpm
  versions, so a config shaped for one broke the other regardless of which was chosen. Fixed by
  pinning `packageManager: "pnpm@10.34.5"` in `package.json` as the single source of truth — CI's
  workflow reads it too (no explicit `version` input on `pnpm/action-setup@v4` anymore). If this
  version is ever bumped, `pnpm-workspace.yaml`'s `onlyBuiltDependencies` entry may need its shape
  rechecked against whatever pnpm changelog covers the jump.
