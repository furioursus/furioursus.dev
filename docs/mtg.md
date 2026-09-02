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
- Card art renders straight from Scryfall's own hosted `imageUrl` — a plain `<img>`, not
  `getLocalCardImage()`/astro:assets the way `RecordCard.astro`'s cover art works. See "Card images
  load directly from Scryfall" below for why.
- Card art opens in the [lightbox](./lightbox.md) at click, same two-click-target split as
  `RecordCard.astro` (see [`docs/discogs.md`](./discogs.md)): the art opens the lightbox, the
  name/set/price text below links out to the card's Scryfall page — except for the rare unresolved
  row, which has no Scryfall match to link to and renders as plain text instead of a dead link.
  This markup is built client-side by `renderCardHTML()` in `CardCollection.astro`'s script — see
  "Rendering is client-side too, not just filtering" below for why there's no `CardTile.astro`
  anymore.
- Cards inside `CardCollection.astro`'s grid navigate as one gallery (Next/Previous, arrow keys,
  wrapping) via the same `data-lightbox-gallery` attribute pattern — see
  [`docs/lightbox.md`](./lightbox.md). Skipping filtered-out or off-page cards falls out for free
  now: they're never in the DOM to begin with (see below), rather than present-but-`hidden`.

## Card images load directly from Scryfall

`CardCollection.astro`'s client-side `renderCardHTML()` (see "Rendering is client-side too, not
just filtering" below) builds a plain `<img src="...">` pointing straight at Scryfall's own hosted
"normal" image — no local download, resize, or `astro:assets` optimization step at all. Two
separate reasons landed on this, worth keeping apart:

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
README). `renderCardHTML()` (`CardCollection.astro`'s client script — see "Rendering is client-side
too, not just filtering" below) appends "Full Art"/"Extended Art" to the existing set/rarity meta
line when either is true (both can apply to the same printing) — no new visual treatment, just
extends the plain-text line already there. `CardCollection.astro` also exposes them as a
`ClientCard.fullArt`/`extArt` filter (`<select data-art-select>`, values `""`/`"full"`/`"extended"`),
the same filtering pattern the color/rarity/foil `<select>`s already use.

## Prices are shown

Unlike a purely aesthetic collection, unit price (per the row's foil/nonfoil/etched printing) and,
for stacks of more than one copy, the line total (`unitPrice * quantity`) are both shown on every
card and summed into the page's running total — this is public on the site, not hidden or
summarized-only, by explicit choice. A card Scryfall has no USD price for (rare, unreleased, or a
promo print) shows "Price unknown" instead of `$0.00` or blank.

## Rendering is client-side too, not just filtering

Unlike the vinyl collection (see [`docs/discogs.md`](./discogs.md)'s "Search/filter/sort" section,
the pattern this used to follow exactly), `CardCollection.astro` does **not** render every card into
the grid at build time. It did originally — an earlier version had ~8,300 `<li>`s pre-rendered, each
one `hidden` unless on the current page, mirroring how the vinyl collection still works. That turned
out to be the page's actual performance problem, and it's a subtler one than data volume: even with
every off-page card `hidden`, all ~8,300 of them (each a `<lightbox-image>` wrapping a trigger
`<img>` *and* a whole `<dialog>` with close/prev/next buttons — a dozen-plus elements per card) still
had to be parsed into the DOM, and every single `<lightbox-image>` still upgraded (running its own
`connectedCallback` query/listener setup, see [`docs/lightbox.md`](./lightbox.md)) on every page
load, `hidden` or not. `loading="lazy"` on the `<img>`s meant the *images themselves* were never the
bottleneck — DOM node count and custom-element upgrade cost were.

The fix: `entries` gets serialized to a slim JSON payload (a `ClientCard` per row — see
`CardCollection.astro`'s frontmatter, one array of plain objects, not DOM nodes) and embedded in a
`<script type="application/json" data-card-json>` tag, written with `set:html` (Astro's directive
for injecting a string as raw, unescaped content) since a normal `{expr}` interpolation would
HTML-entity-escape it — harmless for a JSON *value*, but a script element's content isn't
HTML-entity-decoded by the browser, so an escaped `&amp;` would land in the parsed JSON as literal
text instead of `&`. The one thing that string *does* need is a manual `<` → `\u003c` escape before
embedding, so a card name or URL can never contain a literal `</script>` sequence and truncate the
tag early — see the frontmatter comment above `cardDataJson` for why that's still needed even with
`set:html` bypassing Astro's own escaping.

The `<card-collection>` custom element parses that payload once, on connect, into `#items` — this
*is* the "paginated cached JavaScript objects" idea, if you're looking for it by that name — and
`#renderPage()` builds real `<li>` markup (via `renderCardHTML()`, a hand-rolled template-string
function mirroring what used to be a separate `CardTile.astro` component — deleted, since this was
its only caller once rendering moved client-side) for only the current page's slice, writing it into
`.grid` with `innerHTML`. The browser's custom-element upgrade reactions pick up the freshly-inserted
`<lightbox-image>`s automatically (no manual re-init needed), and gallery Next/Prev navigation (see
[`docs/lightbox.md`](./lightbox.md)) naturally only ever sees the current page's cards, for the same
reason pagination and filtering fall out for free now: there's nothing else in the DOM to find.

**This dropped the page's no-JS fallback.** A no-JS visitor used to get the full unpaginated grid
(everything rendered, nothing to hide); now nothing in `<card-collection>` renders without JS at
all, so it shows a `<noscript>` notice pointing that out instead of a dead-control page. Given
search/sort/pagination were already 100% JS-only regardless, this was a deliberate trade for the
performance win, not an oversight.

- **Pagination** slices `#filtered` (the current search/color/rarity/foil/art match set, itself
  built by filtering `#items`) down to the current `PAGE_SIZE`-card window and passes only that slice
  to `renderCardHTML()`. Changing any filter or the sort key rebuilds `#filtered` and resets to page
  one — there's no stored page state to reconcile against results that may no longer exist.
  `[data-pagination]` (the Prev/Next controls — one copy above the grid, one below, so a full page's
  scroll never leaves you far from either) hides itself whenever the current filtered set fits on one
  page, same `hidden`-attribute convention as `[data-empty]` above it.
- **The grid's height is floored, not just its card count kept constant.** A short last page
  (different cards wrap their name/price text over a different number of lines, so it's not purely a
  card-count thing) would otherwise visibly shrink `.grid` and yank the pagination bar/footer up to
  meet it. `#renderPage()` tracks the tallest `.grid` has actually rendered this visit
  (`#maxGridHeight`) and sets `min-height` to that floor *before* swapping in the new page's markup —
  doing it in that order is what stops the browser from laying the shorter page out at its own
  natural height for even one frame first. A column-count change (a resize crossing the
  mobile/desktop breakpoint) invalidates that recorded number outright — a single-column mobile list
  and a multi-column desktop grid have nothing in common height-wise for the same card count — so a
  `resize` listener drops the floor back to zero rather than carrying over a number that's now
  meaningless; the next page render re-establishes one that's actually right for the new layout. An
  earlier version of this tried padding the last page with cloned filler grid cells instead, sized to
  match a real card — it kept the *cell count* constant but not the height, since a page of identical
  clones can't reproduce the natural height variance real cards have from wrapping differently.
  Measuring and flooring against what was actually rendered sidesteps that assumption entirely.

- **Color** filters against `item.color`, a pipe-separated list built from the card's
  `color_identity` (a colorless card gets `["C"]`) — picking "White" matches any card whose identity
  *includes* white, multicolor cards included, mirroring `queryCollection()`'s own `where.color`
  semantics server-side.
- **Sort** keys (`name-asc`/`name-desc`/`price-desc`/`price-asc`/`set`/`quantity-desc`/`rarity`)
  intentionally match `astro-mtg-collection`'s own (type-only exported) `SortKey` union — the
  package's `sortCards()` function itself isn't exported from the package (only the type is, as a
  suggested shape), so `CardCollection.astro`'s client `<script>` hand-rolls its own comparators
  reading `ClientCard` fields instead, the same way `VinylCollection.astro` does for its own local
  `SortKey` type. The `rarity` comparator's `RARITY_ORDER` map is a small hand-copied constant for
  the same reason — pulling in the actual package export would mean bundling
  `astro-mtg-collection` into client-side JS for one lookup table.
- No **set** filter, despite `setCode`/`collector` existing on `ClientCard` (for the `set` sort's
  tie-break) — Magic has 900+ sets, too many for a plain `<select>` to be usable without its own
  search-within affordance.
- No cover-size toggle (contrast `VinylCollection.astro`'s `.size-toggle`) — cards have one natural
  aspect ratio and the grid's `minmax(13rem, 1fr)` column size is fixed; there's no size preference
  for a toggle to control.

## Gotchas

- **Collection scale.** This export is ~8,300 rows / ~6,200 unique cards — about 20x the size of
  the vinyl collection, and specifically *why* this page departs from `/music/`'s pattern of
  rendering every entry into the DOM at build time — see "Rendering is client-side too, not just
  filtering" above. This scale is also *why* card art skips local caching/`astro:assets` entirely —
  see "Card images load directly from Scryfall" above.
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
