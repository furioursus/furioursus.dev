# Theming

Dark/light mode plus the design tokens both themes draw from.

## Design tokens

The tokens aren't defined in this repo any more. They come from
[`@furioursus/ui`](https://github.com/furioursus/furioursus-ui), the package shared with the MTG
tools, installed from GitHub at a pinned tag (`package.json`). Its `src/tokens.json` is the source
of truth for every color, type size, spacing step, radius and texture; its
[`docs/reference.md`](https://github.com/furioursus/furioursus-ui/blob/main/docs/reference.md) lists
them all with contrast ratios. `src/styles/global.css` pulls them in with two imports:

```css
@import "@furioursus/ui/tailwind.css";            /* tokens, Tailwind names, dark: variant */
@import "@furioursus/ui/base.css" layer(base);     /* paper + dots on <html>, theme cross-fade */
```

The colors this site uses:

```css
--color-page / --color-ink / --color-muted / --color-heading
--color-accent / --color-link / --color-highlight / --color-hairline
```

Every themed color is a variable registered with `@property`, so components mostly don't need
`dark:` variants: `bg-page`, `text-ink` and so on resolve differently per theme, and `base.css`
cross-fades them on a switch.

**Changing a token** means changing the package (edit `src/tokens.json`, `npm run build`,
`npm test`, tag a release), then bumping the tag in this repo's `package.json`. Don't redefine a
token here to "fix" it locally: the MTG tools would drift.

**Overriding one for this site only** goes in the unlayered `:root` block in `global.css`, which
is how the self-hosted fonts replace the package's font stacks:

```css
:root {
	--font-mono: var(--font-monolisa);
	--font-display: var(--font-bricolage);
	--font-read: var(--font-bricolage);
}
```

- **Footgun:** that block must stay unlayered. The package's `tokens.css` is unlayered (so it
  beats Tailwind's theme layer in both themes), and an unlayered rule beats anything in
  `@layer base`/`components`, so a layered override silently loses.
- **Footgun:** don't re-add `fontSize`/`spacing`/`letterSpacing` entries for `2xs`, `title`,
  `title-lg`, `tight-*` or `label` to `tailwind.config.ts`. They come from the package now, and a
  second definition can drift from it without anything failing.

Dark mode follows `data-theme` on `<html>`, falling back to `prefers-color-scheme` when the
attribute is missing. The `dark:` variant is defined by the package with the same rule, so
`dark:` classes and the tokens can never disagree.

Old names, for reading history: `global-bg` → `page`, `global-text` → `ink`, `accent-2` →
`heading`, `nav-hover` → `highlight`, `quote` → `link`, literal `#666` → `hairline`.

### Current palette

Queer-punk direction, SILENCE=DEATH-inspired: dark mode is near-black with warm off-white ink;
light mode is a bleached xerox-paper ground (a faintly warm pink-gray, not a flat white/cream) with
near-black ink — and that ground is no longer picked by hand, it is the paper texture's own average
color (see below). Both themes share the same two accent hues rather than mirroring one theme's
values into the other — `--color-accent` is hot pink (headings-as-links, hover states, focus
rings and the blockquote's 2px left rule) and `--color-link` is acid green (link hover underlines). Each hue is retuned per background, not reused verbatim: a pink/green saturated enough to
read as neon on black goes muddy or fails WCAG AA contrast on paper, so the light-mode values are
darker and more saturated than their dark-mode counterparts. `--color-heading` (the heading
color via `.title`) deliberately stays a plain near-black/near-white in both themes — it's doing
bold-gothic-type contrast, not carrying a hue.

`--color-highlight` is the exception to "both themes share the same hues": it's a no-op in light
mode (defined as the same literal value as `--color-accent`, so `hover:text-highlight` there
changes nothing) and a vivid caution-tape yellow in dark mode — a third, distinct interaction color
for the header nav links (`Header.astro`) rather than a tint of the pink/green pair, applied via
`hover:text-highlight active:text-highlight` alongside their normal `text-accent`. Not tuned to a
specific contrast ratio the way `--color-muted` is — at this lightness/chroma against the
dark-mode near-black bg, contrast clears WCAG AAA (~14:1) by such a wide margin that hue-specific
tuning wasn't necessary.

### Hover is never color alone

christopher has protanopia, so every hover pairs its color change with a change of shape, the rule
`@furioursus/ui`'s `docs/components.md` sets for the shared components. On this site the shape is an
underline, with no boxes, shadows or lifts:

- Text links add `hover:underline` (`underline-offset-2`): nav, footer, the TOC links,
  NowPlaying's track, the tags link on `/blog/`, and the record and card captions in the lightbox
  (`group-hover:underline`). Body links (`.site-link`, prose) already thicken theirs to 2px green.
- Bigger type takes a 2px underline (`decoration-2 underline-offset-4`): the header wordmark and
  post headings (their `#` link).
- Icon-only links (SocialList, a webmention's source link) can't underline, so they get a 2px bar
  under the icon: `border-b-2 border-transparent hover:border-current`. The border is always there,
  so nothing shifts on hover.
- The header's icon buttons thicken their strokes from 1.5 to 2 instead, and press 1px down: the
  theme toggle (from `@furioursus/ui`), the menu button (`group-hover:stroke-2`) and the search
  button. Search's glyph is a CSS mask, so `src/styles/blocks/search.css` swaps `--pf-icon-search`
  for a copy drawn at stroke 2 on hover. **Footgun:** change the glyph in both copies.
- Tailwind's `hover:` only applies under `@media (hover: hover)`, so touch devices never see these.
  The pane's phone emulation reports no hover too; check them at a desktop width.
- **Footgun:** `hover:text-accent` (or `-link`, `-highlight`) on its own fails the rule. Add the
  underline in the same change.

### The flat background color is derived, not chosen

`--color-page` is **not a hand-picked paper white**. It is each paper tile's own average
color, so the flat fill and the texture painted over it are the same tone:

| theme | tile               | `--color-page`                   |
| ----- | ------------------ | ------------------------------------- |
| light | `paper-light.webp` | `hsla(10, 12%, 89.8%, 1)` — `#e8e3e2` |
| dark  | `paper-dark.webp`  | `hsla(0, 0%, 7.8%, 1)` — `#141414`    |

That matters in the two places the flat color shows on its own: before the tile has decoded, and
on any surface using `bg-page` that sits _over_ the textured page (the mobile nav panel, the
lightbox controls, the missing-artwork placeholders in the record/card grids). Pick the color by
eye instead and those panels read as slightly brighter patches floating on the texture; derive it
and they sit flush.

Regenerate it after changing a tile — don't retype it from memory:

```bash
npm run paper:average
```

[`scripts/paper-average.mjs`](../scripts/paper-average.mjs) prints both a hex and an hsla literal
for each tile. Paste the hsla into the `page` token in `@furioursus/ui`'s `src/tokens.json` and
release the package. That's now the only place it's written: the package generates the
`@property` registration, both theme blocks and `theme.js`'s theme-color map from it, and
`BaseHead.astro` reads the light hex from the package's `tokens.json`. (Until the script moves into
the package, it still reads this repo's copies of the tiles in `src/assets/images/`. Keep them
identical to the package's `assets/`.)

Two gotchas worth knowing:

- **The average is taken in linear light, not over the raw bytes.** Optical mixing is linear, so
  linear-light averaging is what the tile actually blurs to; a mean of the gamma-encoded sRGB bytes
  is the classic gamma-incorrect-downscale mistake. On the current low-contrast tiles both methods
  agree to the same byte, which makes this an easy thing to "simplify" into a bug — it stops being
  true the moment a tile's range widens.
- **The printed hsla is derived from the rounded bytes, not the float average.** Off the floats the
  two forms disagree by a byte and the hsla no longer round-trips to the hex.

Moving the background also moves every contrast ratio that was tuned against it. Both `--color-muted`
values still clear WCAG AA on the derived colors — 6.16:1 light, 6.45:1 dark, down from 6.76 and
6.71 — and neither cleared AAA before the change either, so no grade was lost. Re-check these if you
move the tiles much further.

## The paper + dot texture

Two tiling background layers on the **root element**, giving the site a photocopy-grain tooth under
a fine dot grid. It's **ambient**: global, colorless, and underneath everything. It's the only print
treatment on the site now; see [Print effects (removed)](#print-effects-removed).

The whole implementation is four declarations, in `@furioursus/ui`'s `base.css` (imported into
`@layer base` by `global.css`):

```css
html {
	background-color: var(--color-page);
	background-image: var(--texture-dots), var(--texture-paper);
	background-repeat: repeat;
	background-size: var(--texture-dots-size) var(--texture-dots-size), auto;
}
```

Four files back it, and nothing else: `paper-light.webp` / `paper-dark.webp` and
`grid-dots-light.svg` / `grid-dots-dark.svg`, in the package's `assets/`. Swapping theme swaps
those two URLs. There is no
pseudo-element, no `mix-blend-mode`, no `filter`, no `mask`, no per-layer `opacity`, and no
media-queried image tier anywhere in the stack.

### Both textures are baked

The paper tiles **already contain the page color** with the grain composited into them, at the
intensity that used to come from `mix-blend-mode` plus `opacity`. The dot SVGs carry their own fill
color and `fill-opacity`. Background layers have no per-layer opacity and take no filter, so every
knob that used to be live at runtime now lives in the asset.

The practical consequence, and the thing to internalize before editing: **you cannot retune this
from CSS.** Changing the grain's strength or the dot color means regenerating a file. In exchange,
the runtime cost is two ordinary background layers instead of two composited pseudo-elements, and
the theme switch is a URL swap rather than a blend-mode flip.

The dot fills are not arbitrary — each is exactly its theme's `--color-ink`:

| theme | dot fill  | `fill-opacity` | equals                                          |
| ----- | --------- | -------------- | ----------------------------------------------- |
| light | `#1C1821` | `0.75`         | `--color-ink`, `hsla(273, 16%, 11%, 1)` |
| dark  | `#F3F1E8` | `0.25`         | `--color-ink`, `hsla(49, 31%, 93%, 1)`  |

The alpha is deliberately **not** symmetric, and that asymmetry long predates the bake: light
speckles on a near-black ground are simply more visually assertive than dark speckles on a
near-white one. A single shared value doesn't serve both — tuned low enough for dark, the tooth is
too faint to read in light; tuned up until light reads properly, dark looks blown out. The ratio is
empirical, set by eye rather than derived.

### Why the root element, not a pinned layer

Painting on `html` is what finally fixed iOS Safari's rubber-band region. A viewport-pinned layer
can never reach it — the bounce scrolls past `body`'s actual edges entirely — so the overscroll
sliver always showed flat color against a textured page, which read as a seam above the footer.

The root's background positioning area is still its own box; what carries the texture out into the
overscroll region is `background-repeat: repeat`. **This only works because both images tile.** Swap
either for a non-repeating image and the seam comes straight back.

FOOTGUN: **`body` must stay background-transparent.** `Base.astro`'s `<body>` dropped its
`bg-page` class for this. Put any opaque background back on `body` and it paints over both
layers everywhere _except_ the overscroll sliver — the exact inverse of the bug this fixed, and a
confusing one to read, because the only textured part left is the strip you can only see mid-bounce.

`isolate` is still on `body` in `Base.astro`, but **the texture no longer depends on it.** It was
required when these were `z-index: -1` pseudo-elements that would otherwise escape body's stacking
context and paint behind `<html>`. Nothing in the texture stack uses a negative z-index now.

### Tiling, and how to actually measure a seam

Both paper tiles are 500x200 and repeat at native size, so the grain's scale is fixed in CSS pixels
and does not change with the viewport. `paper-light.webp` is 4.7 KB, `paper-dark.webp` 2.6 KB.

The dot SVGs are a **single 24x24 cell holding one circle** at `cx="1.2" cy="1.2" r="0.48"`, tiled by
`--texture-dots-size: 24px`. Because the file is one cell rather than a grid, that value _is_ the
pitch: change it and the spacing changes, not just the scale. The dot is sub-pixel at that pitch
(0.96px), which is why `fill-opacity` is the sensitive knob rather than its size.

They were not always one circle. Sketch exported a 120x120 tile containing all 25 dots of a 5x5
grid, as one `<path>` of 25 hand-placed circles — four of which carried sub-pixel export drift
(three at `1.5` instead of `1.2`, one at `r=0.5` instead of `0.48`). Once every dot was the same
size, the grid was pure repetition the browser already does for free, so the tile collapsed to its
unit cell: 4231 B down to 258 B, and the four stray dots snapped onto the regular grid.

The dot sits fully inside its cell (spanning 0.72 to 1.68), which is what makes the one-cell form
work at all. Move it to an edge — `cx="0"`, say — and it would need drawing four times, once per
corner, or it will clip instead of wrapping.

FOOTGUN: **the two paper tiles sit within ~800 bytes of Vite's 4096-byte `assetsInlineLimit`, and
which side they land on is not stable.** Verified against a real build:

| asset                 | source size | build output                                                     |
| --------------------- | ----------- | ---------------------------------------------------------------- |
| `grid-dots-dark.svg`  | 258 B       | **inlined** as a percent-encoded `data:image/svg+xml` URI, 320 B |
| `grid-dots-light.svg` | 259 B       | **inlined** as a percent-encoded `data:image/svg+xml` URI, 321 B |
| `paper-dark.webp`     | 2688 B      | **inlined** into the CSS as a `data:image/webp;base64` URI       |
| `paper-light.webp`    | 4858 B      | emitted as `/_astro/paper-light.<hash>.webp`                     |

Re-encoding a paper tile a little smaller silently converts it from a fingerprinted,
`immutable`-cached file (see [Asset caching](./caching.md)) into base64 embedded in the stylesheet
that **every** visitor downloads, including ones on the other theme. Check the built CSS after
changing either rather than assuming; the threshold is close enough that a quality tweak can cross
it.

The dot SVGs are no longer near that threshold in either direction — at ~260 B they inline with
enormous margin, and both themes' dots together add 641 B to the CSS. That is smaller than the
single 4231 B file one theme used to fetch, and it removes a request from the critical path. It also
fixes a small papercut: the first theme toggle used to fetch the other theme's SVG, so the dot grid
briefly disappeared mid-transition. Both are in the stylesheet now, so the swap is instant. Note
that SVG inlines percent-encoded rather than base64 — Vite picks the shorter encoding.

**The seam metric this doc used to quote does not survive the bake, and will lie to you.** The old
test was a ratio: mean absolute delta across the wrap edge over the mean delta between typical
interior neighbors, with "near 1.0 is seamless, past ~1.5 reads as an edge". Run it on the current
tiles and it condemns them:

| tile               | ratio H | ratio V | mean wrap delta | **local-average step across the join** |
| ------------------ | ------- | ------- | --------------- | -------------------------------------- |
| `paper-light.webp` | 1.93x   | 3.00x   | 1.06 / 1.63 lv  | **0.05 / 0.33 lv**                     |
| `paper-dark.webp`  | 2.57x   | 3.93x   | 0.61 / 0.92 lv  | **0.03 / 0.09 lv**                     |

The ratios are meaningless here. These tiles are far smoother than the old grain — interior
neighbors differ by ~0.55 luma levels against the old asset's ~1.45 — so the denominator collapsed
and inflated every ratio with it. What matters is the **absolute step in local average** across the
join, because that is what a seam actually is: a visible step in the local mean, not a spike in
per-pixel noise. At 0.05–0.33 luma levels out of 255, these joins are far below the visible
threshold.

Confirmed visually as well as numerically: tiling each 3x3, blurring away the grain to leave only the
low-frequency field, and normalizing to full range — roughly 5.7x amplification on the light tile's
45-level range — shows no hard line at any join. What that does show is the tile's own features
recurring, which is **pattern repetition, a different property from a seam**. Judge repetition by
eye at normal contrast; judge seams by the local-average step.

### Regenerating a tile

`sharp` is already in devDependencies, so no CLI tool is needed. After regenerating, you must also
re-derive `--color-page` — see [the flat background color](#the-flat-background-color-is-derived-not-chosen)
above and run `npm run paper:average`, because the flat color is that tile's own average and will
otherwise no longer match it.

Quality 45 was the chosen operating point historically: noise in this texture compresses poorly
regardless, and file size barely moves between quality 30 and 65.

One gotcha that has cost real debugging time: **Vite's CSS hot-update in dev is not reliable for
`global.css`.** An edit can appear to do nothing while the browser keeps serving the old stylesheet —
long enough to look like a broken selector rather than a stale cache. Hard-reload before concluding a
change didn't take, and never rewrite CSS on the strength of a hot-reloaded measurement.

### Unreferenced assets still in the tree

Nothing imports these any more, so they don't ship, but they're still on disk and will mislead a
search:

- `paper-light.webp`, `paper-dark.webp`, `grid-dots-light.svg`, `grid-dots-dark.svg` — the live
  textures now ship from `@furioursus/ui`. These copies stay only because `paper:average` reads the
  two paper tiles; delete all four once that script moves into the package.
- `grain-tiled.webp` — the loose grain that got composited into the paper tiles. Keep it if you
  intend to re-bake; it is the input, not an output.
- `grain-960w.webp`, `grain-1600w.webp`, `grain-portrait.webp`, `grain-master.webp` — the entire
  `cover`-era tier set.
- `grid-dots.svg` — the single uncolored dot asset from the mask era, superseded by the light/dark
  pair.

### How this got here, and why the history is worth keeping

This layer has been rebuilt enough times that the dead ends are the useful part — each one is a
measurement, and several are traps that look attractive on the way back in.

**It was a pinned viewport layer, twice over.** `position: fixed` with a negative `inset` overscan
failed to reach the true bottom edge on short pages on device (iPhone 17 sim, iOS 26.5), because a
bare `inset` sizes against whatever Safari currently calls the viewport and that shrinks while the
dynamic toolbar is expanded. `position: absolute; inset: 0` fixed coverage by anchoring to `body`'s
box, but made the element document-tall, so `background-size: cover` had to cover the whole page —
on a long post that upscaled the image enormously into soft cloudy mush instead of sharp toner
grain. `background-attachment: fixed` was meant to rescue that and **iOS Safari has never reliably
supported it**: verified on the simulator with a hard-striped gradient, a swipe that moved content
~958px moved the stripes ~220px, so the layer was neither pinned nor scrolling. The settled version
was `position: fixed` with `height: 100lvh` — `lvh` being the _large_ viewport height, which does not
change as the toolbar shows and hides. All of it is gone now that the texture paints on the root.

**It was a `cover` image with three tiers.** A `cover` image was originally chosen over a tile
because a small seamless crop has to crop away visible directional structure — this texture's source
has real toner-drag banding — where a full photo-scale image keeps it. That reintroduced a bandwidth
problem a tile never had, needing `grain-960w`, `grain-1600w` and a rotated `grain-portrait` crop
swapped by media queries. A fourth full-res tier (1920w, 1058 KB) was **88% of a desktop page load on
its own**, against 138 KB for every other asset combined. The current tiles work where that early
crop did not because they are _authored_ to be seamless rather than cropped from the master.

**Every avenue for shrinking the `cover` asset was measured and failed.** AVIF is larger than WebP
here at every quality (254 KB at `q=50` against WebP's 252 KB, rising to 426 KB at `q=80`) — AVIF's
advantage is smooth gradients and this is maximum-entropy speckle. The source is already pure
grayscale, so there is no chroma to strip. Density switching actively destroys the texture:
downscaling _averages the noise away_ and upscaling cannot recover it, and it makes the grain **more**
expensive per pixel, not less — 0.286 bytes/px at 800x450 against 0.179 at 1600x900, because
averaging concentrates the entropy. The general rule this is a case of: responsive images assume
detail is redundant at lower resolutions, and for a texture whose entire value _is_ its
high-frequency detail, that assumption is inverted.

**There was a parallel set of dark assets, then a `filter: invert(1)`.** Compared pixel for pixel,
each dark file was exactly its light counterpart inverted — mean absolute delta of 2.8–5.3 out of
255, with mean levels landing as complements (210.5 and 44.9, summing to 255.4). Three files earning
nothing, so they collapsed to one asset plus a filter, and the filter has now collapsed into the bake
as well. Note the saving was **repo size and maintenance, not bandwidth** — a visitor only ever
downloaded one polarity anyway.

**There was an edge fade, and it is gone.** The texture used to carry a `mask-image` ramping its own
alpha to zero over the first and last `6rem` of the viewport, gated to phone-shaped viewports
(`(max-width: 30rem), (max-height: 30rem)` — an `or` pair that means "the short axis is at most
30rem"), with the fade axis following the viewport's long side via a substituted custom property.
That existed for exactly one reason: the texture tinted whatever it covered slightly off the flat
token, so an abrupt edge read as a tonal seam against the untinted color beyond it. Both halves of
that problem are now solved at the source — the texture reaches the overscroll region itself, and the
flat color _is_ the texture's average — so there is no seam left to hide and the vignette it cost is
gone with it.

That last point is worth stating plainly, because the old doc argued against it: fading `html` toward
the grain's average was rejected as "an average that changes per theme, per breakpoint image, and per
blend mode." The breakpoint images and the blend modes no longer exist. Only the per-theme axis
remains, and `npm run paper:average` tracks it in one command.

## Print effects (removed)

The photocopy jitter (an SVG displacement filter on page titles and headings) and the riso
misregistration (pink and green `drop-shadow` fringes on the header bear) were taken out on
2026-11-11, so the print look can be rethought from scratch. The paper and dot texture above stays.

- Gone: `src/styles/components/jitter.css`, `src/styles/components/riso.css`,
  `src/components/TextureFilters.astro` (the filter ladder `Base.astro` mounted), the `.jitter-text`
  scope class on the page wrapper and the `.jitter-off-mobile` opt-outs on card titles. The bear
  keeps only its grayscale-until-hover (`logo.css`).
- The design system dropped both effects and their tokens on 2026-11-10.
- Both lived with long write-ups of their footguns: filters compounding through nested text, iOS
  blanking the page mid-scroll, `--riso-fringe` having to be declared on its consumers, and the
  grayscale-then-fringe filter order. Read them in git (`git show f940c34:docs/theming.md`, the last
  commit with both) before building the next version, because each one cost real debugging.

## Switching themes

- **`src/components/ThemeProvider.astro`** — inlines `@furioursus/ui`'s `theme.js` (imported with
  `?raw`) as a parser-blocking `is:inline` script in `Base.astro`'s `<head>`, so the theme is set
  before first paint. It sets `data-theme` on `<html>` from a saved choice or
  `prefers-color-scheme`, updates the `theme-color` meta, and re-applies on bfcache restores, OS
  changes and changes in other tabs. The package's
  [`docs/theming.md`](https://github.com/furioursus/furioursus-ui/blob/main/docs/theming.md) has
  the full contract.
- **The header button** is `@furioursus/ui`'s `ThemeToggle`, rendered as static HTML with no
  `client:` directive: a `role="switch"` marked `data-theme-toggle`. `theme.js` handles its click and
  keeps its `aria-checked` and `title` in sync on every switch, including OS changes and other tabs.
  See [components.md](./components.md).
- **Footgun:** don't hydrate it or give it a click handler. Hydrating ships the Vue runtime to every
  page; a second click handler switches the theme twice, so it appears to do nothing.

**A saved choice only sticks when it differs from the system.** Picking the theme the OS already
uses clears `localStorage.theme`, so the site goes back to following the OS. Before the shared
package, every click was stored, which pinned the theme even after the OS switched.

- **Footgun:** `ThemeProvider` must stay `is:inline` and after `BaseHead`'s `theme-color` meta. A
  bundled (module) script runs after first paint, so dark-mode visitors see a flash of paper; before
  the meta, the script can't find it to update.

Anything else that needs to switch the theme should be a `data-theme-toggle` button, call
`window.furioursusTheme.set()`, or dispatch `theme-change` on `document`, rather than set
`data-theme` directly, so the choice is saved and the toggle stays in sync.

## Layout

The page is a 1440px container (`--container-page`) with a side rail from 1100px (the `rail:` breakpoint, `--breakpoint-rail` in `global.css`). Below 1100px nothing changes: one centered 768px column.

- From 1100px `main.shell` is a grid of `minmax(11rem, 1fr) 4fr` with a 24px gap. Every page's content sits in the second column; the header and footer span the full container.
- Pages other than posts are wrapped in `.shell-body`, capped at 768px (`--container-column`), so their own layouts are the same width as before and only move left.
- A post passes `rail` to `Base.astro`, and its `<article class="shell-full">` spans both columns as a subgrid: title and cover in the second column, `.post-rail` (meta from `PostMeta.astro`, then the table of contents) in the first, sticky at 48px, beside the prose. Below 1100px the rail stacks between the cover and the prose.
- The cover image and the stacked rail are capped at the prose's width (`calc(var(--text-prose) * 34)`), so their edges and the 2px rules above the meta and the prose line up.

Verified at 393, 820, 1100, 1512 and 2560px with no sideways scroll. **Not verified:** the table of contents in the rail, because no post has headings yet.

## Typography

Prose content (post/note bodies, the About page, tag descriptions) is styled by Tailwind's
[`@tailwindcss/typography`](https://github.com/tailwindlabs/tailwindcss-typography) plugin, whose
theme-driven overrides live in `tailwind.config.ts`. `DEFAULT`, `sm` and `base` size variants are
configured — a `prose-cactus` class from the pre-de-branded starter theme was removed as dead
weight (no matching config, so it generated no CSS).

### The type scale

Sentences are set in Bricolage Grotesque and everything that labels or counts is set in MonoLisa. Prose and post titles are fluid; the page chrome outside a prose block still steps once at `sm` (640px).

| role | size | face | set by |
| --- | --- | --- | --- |
| post title | 40px to 112px, `clamp(2.5rem, 7vw, 7rem)`, line height 0.95 | Bricolage 800 | `.title-hero` |
| page title (`h1`) | 36px, 48px from `sm` | Bricolage 700 | `.title`, and prose `h1` |
| prose body | 18px to 23px, line height 1.55 | Bricolage 400 | `--text-prose`, on `prose-sm` and `prose-lg` |
| post lede | 1.2em of the body, line height 1.45 | Bricolage 400 | `.post-prose > p:first-child` |
| prose `h2` / `h3` | 1.6em / 1.25em of the body | Bricolage | `tailwind.config.ts` |
| blockquote | 0.82em of the body, line height 1.6, italic | MonoLisa | `tailwind.config.ts` |
| post-list title | 18px to 21px | Bricolage 600 | `font-read text-read` in `PostPreview.astro` |
| dates, meta values | 13px | MonoLisa | `text-data` |
| meta labels | 11px, uppercase, tracked 0.08em | MonoLisa | `--text-label`, `--tracking-label` |
| page chrome outside prose | 14px, 18px from `sm` | MonoLisa | `text-sm sm:text-lg` on `Base.astro`'s wrapper |
| small UI text | 12.8px | MonoLisa | `text-2xs` |

`--text-prose`, `--text-read`, `--text-data`, `--text-label` and `--font-read` come from `@furioursus/ui`. `prose-sm` and `prose-lg` now set the same body size and the same heading sizes; they differ only in the plugin's own `em`-based margins, and in prose `h1`, which follows `.title` (`--text-title` on `sm`, `--text-title-lg` on `lg`). The 12 call sites still read `prose prose-sm sm:prose-lg`.

The home page intro is `font-read text-read`, capped at 36em. Chrome stays MonoLisa on purpose: the header and footer nav, post dates, labels and note cards' meta are labels and data, not reading text. Bricolage Grotesque ships no italic, so `<em>` in prose is the browser's slant of the upright face; blockquotes use MonoLisa's real italic.

**The measure.** Prose is capped at `34em` (`maxWidth` in the typography `DEFAULT` block). Characters per line, measured on a post body by dividing a paragraph's length by its rendered lines:

| viewport | column | body | CPL |
| --- | --- | --- | --- |
| 393px | 361px | 18px | **38** |
| 820px | 655px | 19.3px | **63** |
| 1512px | 725px | 21.3px | **63** |
| 2560px | 782px | 23px | **63** |

Tablet and up sit inside the 45 to 75 band. A phone can't reach it at a readable size: 38 is the same count the 14px MonoLisa body gave, now at 18px.

- `max-w-page` is `--container-page` and `px-gutter-fluid` is its fluid side padding. Up to v0.6.0 the padding token was `--spacing-page`, which made `max-w-page` resolve to a 48px gutter; v0.7.0 renamed it.
- **Footgun:** Bricolage has no italic face loaded (`styles: ["normal"]` in `astro.config.ts`), so an `<em>` in prose is a synthesized slant. Blockquotes and post-list descriptions are MonoLisa italic for that reason.

**`.title` is two scales, and two of its call sites opt out.** `.title` means _page title_ — it
resolves to `text-title sm:text-title-lg` (36/48px, both tokens from `@furioursus/ui`). Call sites that want something smaller override it with an ordinary `text-*` utility,
which wins because `.title` lives in `@layer components`. **FOOTGUN: `RecordCard.astro` and
`CardCollection.astro` carry an explicit `text-3xl`** — they use `.title` for _card_ titles, not
page titles, and without that pin a change to the page-title scale silently drags every vinyl
sleeve and Magic card heading up with it.

Prose `h1` deliberately matches `.title` rather than taking the plugin's own default, so a
markdown-level `h1` — the CV's name heading is the only one in the content today — reads as the
same rank as every other page title.

### Two type families: MonoLisa (body) and Bricolage Grotesque (headline)

The site ran on MonoLisa alone for everything — body copy and `.title` headings both — until
Bricolage Grotesque was added as a dedicated headline face. Both are registered in
`astro.config.ts`'s `fonts` array and injected via `<Font cssVariable="..." />` in `Base.astro`'s
`<head>` (once per family); `--font-mono` and `--font-display` in `global.css` expose them as
Tailwind's `font-mono` / `font-display` utilities.

**MonoLisa is a local file, Bricolage Grotesque comes from Fontsource.** MonoLisa is a licensed
font with no public host, so its `provider` is `fontProviders.local()` pointing at
`src/assets/fonts/*.woff2` directly. Bricolage Grotesque is free and listed on
[Fontsource](https://fontsource.org/fonts/bricolage-grotesque), so its `provider` is
`fontProviders.fontsource()` instead — Astro downloads the woff2 from Fontsource's CDN at build
time and serves it from the site's own `_astro/fonts/` path, same self-hosting outcome as MonoLisa
without hand-vendoring a file. Both approaches avoid a runtime `fonts.googleapis.com` hit.

**Requesting a weight range, not a single number, is what pulls in the `opsz` axis.** Bricolage
Grotesque is a variable font with both `wght` and `opsz` axes registered on Fontsource. Passing
`weights: ["200 800"]` (a range) rather than a single weight tells Fontsource this is a
variable-font request, and Fontsource always ships its "standard" axis slug — bundling every
registered axis, not just `wght` — for any variable request on a family that has more than one.
There's no separate config for "also give me opsz"; requesting the range is enough, and the axis
then has to be driven explicitly in CSS with `font-variation-settings: "opsz" 60` (see `.title`
below) since nothing sets it automatically.

**`.title` marks a headline, full stop — except inside `.prose`.** Every `.title` usage
(`RecordCard`, `CardCollection`, `Note` previews, every page-level `h1`/`h2`) gets
Bricolage Grotesque, bold, `opsz 60`, and tight tracking directly — there's no separate opt-in
class. The one carve-out is `.prose .title`, which reverts to MonoLisa at its old `font-semibold`:
a `.title`-classed element that ends up embedded inside markdown-rendered content (an MDX-embedded
component, say) should defer to the prose block's own heading treatment rather than compete with
it.

**Markdown-rendered headings (`.prose`'s own `h1`-`h6`) get Bricolage separately, via
`tailwind.config.ts`.** These aren't `.title`-classed at all — they're plain headings the
`@tailwindcss/typography` plugin generates from post/note bodies, the About page, and tag
descriptions — so the font-family is set once in the typography plugin's `DEFAULT` css block
(`"h1, h2, h3, h4, h5, h6": { fontFamily: "var(--font-display)" }`), which reaches every `.prose`
usage in the site, not just `BlogPost.astro`'s own `prose-headings:*` utilities (those still carry
that one page's weight/color/anchor-link chrome on top — the two mechanisms coexist rather than
compete, same as the plugin's other `DEFAULT` overrides already do for `a`/`blockquote`/`code`).

**`display: "fallback"` again, for the same reason as MonoLisa.** Astro's auto-generated fallback
metrics are close but not pixel-identical to the real font, and a headline's larger type size makes
that mismatch more visible per character, not less — see MonoLisa's own comment in
`astro.config.ts` for the fuller CLS history that motivated this choice originally.

Custom elements that need block-level spacing to match a paragraph's rhythm, but aren't a tag the
plugin knows about by default (`<lightbox-image>`, `.admonition`, `.github-card`, Expressive Code's
output), are opted in explicitly via a selector list in that same config file rather than by
overriding the plugin's defaults globally.
