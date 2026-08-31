# MTG collection

[`/mtg/`](../src/pages/mtg.astro) renders a searchable, filterable grid of my Magic: The Gathering
collection, pulled from a [ManaBox](https://manabox.app/) CSV export and enriched with live
[Scryfall](https://scryfall.com/docs/api) data at build time via the
[`astro-mtg-collection`](https://github.com/furioursus/astro-mtg-collection) integration. It's a
standalone sibling page to [`/music/`](./discogs.md), following the same fetch/render split, not a
section of it — the two collections are unrelated hobbies, unlike Last.fm/vinyl which share one
"Music" page.

## How it's wired

- `mtgCollection()` is registered in `astro.config.ts`. Unlike `astro-discogs-collection`, it needs
  no API credentials — it reads a CSV export directly, no env vars.
- The collection export lives at `src/data/collection.csv` (the package's default `csvPath`) and
  **is committed to the repo** — unlike its derived caches below, there's no live account to
  re-fetch from at build time, so the export itself is the source of truth. Re-export from ManaBox
  (Collection → menu → Export → CSV) and overwrite this file to update the collection; the next
  build re-resolves and re-caches everything from the new rows.
- `loadCollection()` (from `astro-mtg-collection`) parses the CSV and resolves each row against
  Scryfall — by Scryfall ID when the export has one (ManaBox always does), falling back to
  set+collector-number or name-only matching for thinner export formats. Returns
  `{ cards, missingFile, error }`; `missingFile` is `true` when the CSV doesn't exist (a fresh
  checkout without the export), and the page renders a setup notice instead of the grid.
- `queryCollection()` does the initial server-side sort (`sortBy: "name"`); `summarize()` derives
  the unique-card/total-copies/total-value counts shown above the grid; `uniqueSorted()` builds the
  rarity and foil `<select>` option lists (rarities re-sorted by `RARITY_ORDER` afterwards, so the
  dropdown reads common→mythic instead of alphabetically).
- Card art is served locally when available — `src/components/CardTile.astro` checks for a
  pre-optimized `public/mtg-cards/{id}.webp` file, keyed **by the resolved Scryfall card's own
  `id`**, not the CSV row's `scryfallId` (a row without one, or with a stale one, can still resolve
  to a card via set+collector-number or name matching, so the two aren't always the same value).
  Falls back to the card's live Scryfall image URL, then a text placeholder for the rare row
  Scryfall couldn't resolve at all. See "Card images are pre-optimized, not astro:assets" below for
  why this isn't `getLocalCardImage()`/`astro:assets`, unlike `RecordCard.astro`'s cover art.
- Card art opens in the [lightbox](./lightbox.md) at click, same two-click-target split as
  `RecordCard.astro` (see [`docs/discogs.md`](./discogs.md)): the art opens the lightbox, the
  name/set/price text below links out to the card's Scryfall page — except for the rare unresolved
  row, which has no Scryfall match to link to and renders as plain text instead of a dead link.
- Cards inside `CardCollection.astro`'s grid navigate as one gallery (Next/Previous, arrow keys,
  wrapping, skipping filtered-out cards) via the same `data-lightbox-gallery` attribute pattern —
  see [`docs/lightbox.md`](./lightbox.md).

## Card images are pre-optimized, not astro:assets

`RecordCard.astro` (the vinyl collection) resolves cover art through astro:assets — a real
`<Image>`/`getLocalCardImage()`-equivalent, so Astro's own build-time pipeline resizes and
optimizes each cover. The MTG collection deliberately does **not** do this: `astro build` failed
specifically on `/mtg/`, every other route (including `/music/`) built fine, and the error surfaced
deep inside an Astro/Vite internal function (`testCaseInsensitiveFS`, checking for a client entry
file that has nothing to do with this page) that should never run during a static build at all.
The one thing that route does differently from every other page on the site is push ~6,200 unique
images through `<Image>` — one component instance per card, all in a single route's build — an
order of magnitude more than any other page (the vinyl grid's cover count doesn't come close). The
working theory is an upstream scale edge case in Astro/Vite's build-time image pipeline, not a bug
in this repo's own code; rather than chase its exact root cause, `src/integrations/optimize-mtg-images.ts`
sidesteps astro:assets for card art entirely, removing the suspect subsystem instead of just
shrinking it.

That integration is a **local** one (not a published package, unlike `astro-mtg-collection`
itself) registered in `astro.config.ts` right after `mtgCollection()` — order matters, since it
reads the raw JPGs `astro-mtg-collection`'s own `astro:build:start`/`astro:server:setup` hook just
finished downloading into `imageCacheDir` (`src/assets/mtg-collection/card-images/`), rather than
re-downloading them from Scryfall itself, and Astro fires same-named hooks in integration
registration order. For each cached JPG without a matching output file yet, it resizes to 480px
wide and writes a `.webp` to `public/mtg-cards/{scryfallId}.webp` via `sharp` (already a project
dependency, used the same direct way in `src/pages/og-image/[...slug].png.ts`) — a genuine
one-time batch pass, not one Sharp invocation per rendered card. It has to run from
`astro:build:start` specifically (not, say, `mtg.astro`'s own frontmatter) because Astro copies
`public/` to `dist/` as part of the client Vite build, itself before route generation — writing
these files any later would miss that copy and they'd never reach `dist/`.

`CardTile.astro` then just checks whether `public/mtg-cards/{id}.webp` exists on disk (a plain
`fs.existsSync()` at component build time) and renders a hand-rolled `<lightbox-image>` around a
plain `<img src="/mtg-cards/{id}.webp">` if so — the same hand-rolled-lightbox markup
`RecordCard.astro` and the original version of this component used for Scryfall's own remote image
URL as a fallback tier, now the *only* tier here (falling back further to the raw remote
`imageUrl` for any card the optimize pass hasn't reached yet, e.g. one added since the last build).
One fixed size for both the grid thumbnail and the lightbox's enlarged view, no responsive
`srcset` — the same tradeoff `RecordCard.astro`'s own remote-image fallback already makes, just
applied to every card here instead of only the rare un-cached one.

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
`data-name`, `data-price`, `data-set`, `data-collector`, `data-quantity`) that a `<card-collection>`
custom element reads to show/hide and reorder cards in response to the search box, color/rarity/foil
`<select>`s, and sort `<select>`. Nothing is removed from the DOM — filtering just toggles the
`hidden` attribute.

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
  paint, but the initial build downloads and optimizes thousands of card images the first time (or
  after a CSV update introduces new cards); expect a build-time cost `/music/` doesn't have. This
  scale is also *why* card art bypasses astro:assets entirely — see "Card images are pre-optimized,
  not astro:assets" above. Cached images and Scryfall data persist across builds
  (`imageCacheDir`/`scryfallCachePath`/`scryfallBulkCachePath`, all gitignored — see below), so only
  *new* rows pay that cost on subsequent builds — same for `public/mtg-cards/`'s pre-optimized
  webps, which `src/integrations/optimize-mtg-images.ts` also skips regenerating when already
  present.
- `src/assets/mtg-collection/` (the raw card-image cache), `.cache/mtg-collection/` (the Scryfall
  JSON/bulk-data cache), and `public/mtg-cards/` (the pre-optimized webps) are all gitignored —
  every one is fully regenerable from `src/data/collection.csv`, same treatment as
  `astro-discogs-collection`'s equivalent caches.
- `/mtg/` is listed in `menuLinks` in `src/site.config.ts`. If `src/data/collection.csv` is ever
  removed (e.g. a fork without the real export), the page still builds and loads — `loadCollection()`
  reports `missingFile: true` and the page shows a setup notice instead of the grid, same fallback
  pattern as `/music/`'s vinyl section without Discogs credentials.
