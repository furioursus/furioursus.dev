# Theming

Dark/light mode plus the design tokens both themes draw from.

## Design tokens

Defined once in `src/styles/global.css` as CSS custom properties, registered via `@property` (so
Tailwind can animate them) and given light-mode values under `@theme`:

```css
--color-global-bg / --color-global-text / --color-muted / --color-link / --color-accent
--color-accent-2 / --color-quote / --color-nav-hover
```

Dark-mode overrides for the same variables live under `html[data-theme="dark"]` in the same file.
Because every themed color is a variable rather than a hardcoded value, components mostly don't
need `dark:` variants at all — `bg-global-bg`, `text-global-text`, etc. just resolve differently
depending on `data-theme`. A `transition` on all of them gives the theme switch its fade instead of
an instant snap.

Dark mode is implemented as a selector variant, not Tailwind's default media-query strategy:

```css
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
```

— so `dark:` utility classes key off the `data-theme` attribute on `<html>`, not
`prefers-color-scheme` directly. That indirection is what makes a manual toggle possible.

### Current palette

Queer-punk direction, SILENCE=DEATH-inspired: dark mode is near-black with warm off-white ink;
light mode is a bleached xerox-paper ground (a faintly warm pink-grey, not a flat white/cream) with
near-black ink — and that ground is no longer picked by hand, it is the paper texture's own average
color (see below). Both themes share the same two accent hues rather than mirroring one theme's
values into the other — `--color-accent` is hot pink (headings-as-links, hover states, focus
rings) and `--color-link` / `--color-quote` share an acid green (hyperlink text, blockquote
text). Each hue is retuned per background, not reused verbatim: a pink/green saturated enough to
read as neon on black goes muddy or fails WCAG AA contrast on paper, so the light-mode values are
darker and more saturated than their dark-mode counterparts. `--color-accent-2` (the heading
color via `.title`) deliberately stays a plain near-black/near-white in both themes — it's doing
bold-gothic-type contrast, not carrying a hue.

`--color-nav-hover` is the exception to "both themes share the same hues": it's a no-op in light
mode (defined as the same literal value as `--color-accent`, so `hover:text-nav-hover` there
changes nothing) and a vivid caution-tape yellow in dark mode — a third, distinct interaction color
for the header nav links (`Header.astro`) rather than a tint of the pink/green pair, applied via
`hover:text-nav-hover active:text-nav-hover` alongside their normal `text-accent`. Not tuned to a
specific contrast ratio the way `--color-muted` is — at this lightness/chroma against the
dark-mode near-black bg, contrast clears WCAG AAA (~14:1) by such a wide margin that hue-specific
tuning wasn't necessary.

### The flat background color is derived, not chosen

`--color-global-bg` is **not a hand-picked paper white**. It is each paper tile's own average
color, so the flat fill and the texture painted over it are the same tone:

| theme | tile               | `--color-global-bg`                   |
| ----- | ------------------ | ------------------------------------- |
| light | `paper-light.webp` | `hsla(10, 12%, 89.8%, 1)` — `#e8e3e2` |
| dark  | `paper-dark.webp`  | `hsla(0, 0%, 7.8%, 1)` — `#141414`    |

That matters in the two places the flat color shows on its own: before the tile has decoded, and
on any surface using `bg-global-bg` that sits _over_ the textured page (the mobile nav panel, the
lightbox controls, the missing-artwork placeholders in the record/card grids). Pick the color by
eye instead and those panels read as slightly brighter patches floating on the texture; derive it
and they sit flush.

Regenerate it after changing a tile — don't retype it from memory:

```bash
npm run paper:average
```

[`scripts/paper-average.mjs`](../scripts/paper-average.mjs) prints both a hex and an hsla literal
for each tile. Paste the result into **all three** hand-synced locations:

- `--color-global-bg` in `global.css` (the `@property` initial-value, the `@theme` block, and the
  `[data-theme="dark"]` override)
- the `theme-color` meta in `BaseHead.astro` (light only — the pre-JS fallback)
- the `themeColors` map in `ThemeProvider.astro` (both themes)

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
a fine dot grid. This is one of the two texture "roles" from the queer-punk direction above; the
other is [riso misregistration](#riso-misregistration-the-moments-half) on individual marks. They
are deliberately two techniques rather than one: this half is **ambient** — global, colorless, and
underneath everything — while that half is **local and chromatic**, applied to a handful of marks
on purpose.

The whole implementation is now four declarations:

```css
html {
	background-color: var(--color-global-bg);
	background-image: var(--dots-image), var(--paper-image);
	background-repeat: repeat, repeat;
	background-size: var(--dots-size), auto;
}
```

Four files back it, and nothing else: `paper-light.webp` / `paper-dark.webp` and
`grid-dots-light.svg` / `grid-dots-dark.svg`. Swapping theme swaps those two URLs. There is no
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

The dot fills are not arbitrary — each is exactly its theme's `--color-global-text`:

| theme | dot fill  | `fill-opacity` | equals                                          |
| ----- | --------- | -------------- | ----------------------------------------------- |
| light | `#1C1821` | `0.75`         | `--color-global-text`, `hsla(273, 16%, 11%, 1)` |
| dark  | `#F3F1E8` | `0.25`         | `--color-global-text`, `hsla(49, 31%, 93%, 1)`  |

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
`bg-global-bg` class for this. Put any opaque background back on `body` and it paints over both
layers everywhere _except_ the overscroll sliver — the exact inverse of the bug this fixed, and a
confusing one to read, because the only textured part left is the strip you can only see mid-bounce.

`isolate` is still on `body` in `Base.astro`, but **the texture no longer depends on it.** It was
required when these were `z-index: -1` pseudo-elements that would otherwise escape body's stacking
context and paint behind `<html>`. Nothing in the texture stack uses a negative z-index now.

### Tiling, and how to actually measure a seam

Both paper tiles are 500x200 and repeat at native size, so the grain's scale is fixed in CSS pixels
and does not change with the viewport. `paper-light.webp` is 4.7 KB, `paper-dark.webp` 2.6 KB.

The dot SVGs are a **single 24x24 cell holding one circle** at `cx="1.2" cy="1.2" r="0.48"`, tiled by
`--dots-size: 24px 24px`. Because the file is one cell rather than a grid, `--dots-size` _is_ the
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
interior neighbours, with "near 1.0 is seamless, past ~1.5 reads as an edge". Run it on the current
tiles and it condemns them:

| tile               | ratio H | ratio V | mean wrap delta | **local-average step across the join** |
| ------------------ | ------- | ------- | --------------- | -------------------------------------- |
| `paper-light.webp` | 1.93x   | 3.00x   | 1.06 / 1.63 lv  | **0.05 / 0.33 lv**                     |
| `paper-dark.webp`  | 2.57x   | 3.93x   | 0.61 / 0.92 lv  | **0.03 / 0.09 lv**                     |

The ratios are meaningless here. These tiles are far smoother than the old grain — interior
neighbours differ by ~0.55 luma levels against the old asset's ~1.45 — so the denominator collapsed
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
re-derive `--color-global-bg` — see [the flat background color](#the-flat-background-color-is-derived-not-chosen)
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
greyscale, so there is no chroma to strip. Density switching actively destroys the texture:
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

## Photocopy jitter on page titles

**TL;DR — `src/components/TextureFilters.astro` emits an `feTurbulence`/`feDisplacementMap` ladder
at five displacement steps (0.5, 1, 2, 3, 5px); `src/styles/components/jitter.css` decides what
wears which. Headings are on step 3. Body text is on step 2 at `sm` and up, 0.5 below it.**

|                      | step | displacement          |
| -------------------- | ---- | --------------------- |
| headings (`h1`–`h6`) | 3    | 3px, both breakpoints |
| body text, desktop   | 2    | 2px                   |
| body text, mobile    | 0.5  | 0.5px                 |

The body step is far apart across the breakpoint because displacement is an absolute px value while
type is not: 2px against 18px desktop copy is a tooth, but 2px against 14px mobile copy eats the
letterforms.

`feTurbulence` generates a noise field and `feDisplacementMap` pushes each pixel of the source by
the value it finds there, so glyph edges crumble the way toner does on a bad photocopy. Applied to
HTML via `filter: url(#press-jitter-2)`, the text stays real DOM text — selectable, screen-reader
accessible and Pagefind-indexable — which is the whole reason to do this rather than ship an image.

All five steps are emitted whether or not anything references them, so trying a different one means
swapping a single id in `jitter.css`. A filter nothing references is never evaluated, so the unused
ones cost a few hundred bytes of markup and no runtime. `.jitter-05` … `.jitter-5` utility classes
exist for trying a step straight from markup; **none of them currently have a consumer.**

Every step shares one noise field (same `baseFrequency`, `numOctaves`, `seed`), so the steps differ
only in how hard that field pushes — switching steps changes the _amount_ of the artifact, not its
character.

### Three things that will break it

**`color-interpolation-filters="sRGB"` is not optional.** The SVG default is linearRGB, which shifts
every color passing through the filter. On the hot-pink headings this applies to, the shift is
glaring rather than subtle.

**The filter region is widened to `x="-20%" width="140%"`.** The default region is -10%/+120% of the
bounding box, and the heading anchor `::before` sits at `margin-left: -16px` — outside the element's
own box. The default region clips it.

**A child cannot opt out of its parent's filter**, which is why `jitter.css` has three selectors
instead of one. The homepage greeting `h1` contains a 👋 `<button>`: filtering the `h1` would
displace a color emoji into mud, and that button's `group-hover:animate-[wobble]` transform would
force the entire filter to re-rasterize on every frame of the hover. The greeting therefore wears
the filter on its inner `.title-text` span. Anything else mixing text with emoji or icons needs the
same split.

### Filters compound, so only the innermost text block is matched

**FOOTGUN: a filtered element inside another filtered element is displaced twice, at double the
intended scale.** This is not hypothetical in real content — a loose markdown list emits `li > p`, a
table cell can hold a paragraph, a `dd` can hold a list. Hand-curating a list of "leaf-ish" elements
does not survive that, because the nesting is a property of the content, not of the selector.

The rule therefore repeats its own element list inside `:not(:has(...))`, which structurally
guarantees that only the innermost match ever takes the filter:

```css
.jitter-text
	:is(p, li, dt, dd, figcaption, caption, th, td, summary, label):not(
		:has(:is(p, li, dt, dd, figcaption, caption, th, td, summary, label)),
		:has(:is(img, picture, svg, video, lightbox-image, .expressive-code))
	)
```

**Keep the two lists identical.** Verified against injected `li > p`, `li > ul > li`, `td > p` and
`dd > p`: in every case the inner element takes the filter and the outer one does not.

### Media is exempt, and the combinator is the bug that gets you

A child cannot opt out of its parent's filter, so a paragraph containing an image has to lose the
filter **entirely** — the image cannot be spared on its own. The `:has()` match is a _descendant_
one, with no `>`: the webmention avatars are `img` inside `a` inside `p`, and a child-combinator
version matched none of the ten of them and warped every avatar. Code blocks are exempt for the
inverse reason — Expressive Code's output is already a dense grid of small glyphs, and displacement
turns it to noise.

### `.jitter-text` is a scope hook, never a filter target

The class on `Base.astro`'s page wrapper exists only to scope the descendant selectors. **It must
never carry a `filter` itself.** A filter makes an element a containing block for absolutely
positioned descendants, and the mobile nav dropdown, the masthead logo and the heading anchors all
resolve against ancestors inside that wrapper — filtering it relocates every one of them. This is
the same footgun that governs `.logo-mark` and the nav; it is the third time it shows up in these
docs, which is a good reason to assume it will show up again.

### What it costs

- **It rasterizes.** A filtered element is painted to a bitmap, so subpixel antialiasing becomes
  grayscale antialiasing. Filtered text reads very slightly softer and lighter than unfiltered text
  beside it.
- **It is a raster pass per matched element.** A post body is ~30 filtered elements rather than one
  large surface, which is the better shape for this, but it is not free.

### Static on purpose

There is no animation and therefore no `prefers-reduced-motion` wiring. If the `scale` is ever
animated it must be driven by CSS, not SMIL: SMIL ignores that media query entirely, which is the
exact problem the removed `#logo-melt` filter had (`docs/logo.md`). It would also be the only moving
thing in an otherwise static texture stack.

## Riso misregistration (the "moments" half)

**TL;DR — `src/styles/components/riso.css`. Two hard-edged `drop-shadow()` copies of a mark, offset
left and right in the palette's pink and acid green, imitating a risograph's color passes missing
their register. Currently on the header bear alone — 2px on mobile, 3px at `sm` and up.**

A risograph lays each color down in its own pass and the paper shifts between them, so a two-color
print has its layers slightly out of alignment. The digital equivalent is one declaration:

```css
filter: drop-shadow(calc(var(--riso-offset) * -1) 0 0 var(--riso-ink-1))
	drop-shadow(var(--riso-offset) 0 0 var(--riso-ink-2));
```

`drop-shadow` rather than duplicated markup because it follows the **alpha channel** of what it is
applied to, so an SVG glyph fringes along its actual outline rather than its bounding box. The inks
are `--color-accent` and `--color-link`, so it re-themes for free.

### Two footguns

**`--riso-fringe` is declared on its consumers, never on `:root`.** A custom property holding
`var()` is substituted at computed-value time **on the element it is declared on**. A `:root`-level
`--riso-fringe` therefore bakes in `:root`'s `--riso-offset`, and every per-element override of that
offset silently does nothing — the chain still resolves and still renders, just always at the root
value, which is exactly why it is easy to ship without noticing. Add a new consumer to the
`.riso, .logo-mark` selector list in `riso.css`; do not hoist the declaration.

**Filter order decides whether the effect survives.** `.logo-mark` composes
`grayscale(1) var(--riso-fringe)` — grayscale **first**, desaturating the bear itself, then the
fringes laid on at full ink. Put the `grayscale()` after the drop-shadows and it eats them, leaving
two grey smudges. That ordering is the only reason the mark can keep the muted-until-hover
treatment it has always had and still carry color misregistration.

That grayscale used to be `sm:grayscale sm:group-hover:filter-none` in `Header.astro`; it moved into
`logo.css` because the two are one chain and Tailwind cannot express "drop only the first function."
Hover now clears the grayscale and keeps the fringe, since the misregistration is the mark's resting
character rather than a hover flourish. **FOOTGUN: the `filter` stays on `.logo-mark` and never on
the wrapping `<a>`** — a filter makes an element a containing block for absolutely positioned
descendants, and the mark's `sm:absolute` vertical centering resolves against that `<a>`.

Unlike the removed `#logo-melt` SVG filter (see `docs/logo.md`), this one does not displace
geometry, so it does not swamp `logo-breathe` — all five idle animations were confirmed still
`running` under it.

### Why the bear only

The `SocialList` glyphs carried this at 1px briefly and it came back off: five fringed icons in a
row reads as chromatic noise rather than a printing artifact, and those glyphs are wayfinding, not
marks. The treatment earns its place on something that is _already_ a logo. `.riso` / `.riso-1` /
`.riso-2` stay in `riso.css` as the ready-made hook for the next one — a pull-quote is the obvious
candidate from the original direction — so **they currently have no consumers**; `.logo-mark`
composes `--riso-fringe` itself rather than using them.

### Scale is deliberately not relative

The offset is a plain `px` length, not an `em`. A real press misses register by a fixed fraction of
a millimetre no matter how large the artwork is, so an offset that scaled with the glyph would read
as a blur effect instead of a printing error. The bear's own two steps are declared directly in
`logo.css`; `.riso-1` and `.riso-2` mirror them for future consumers.

## Switching themes

- **`src/components/ThemeProvider.astro`** — inlined, parser-blocking script (`is:inline`, to avoid
  a flash of the wrong theme) in `Base.astro`'s `<head>`. On load: reads `localStorage.theme`,
  falling back to `prefers-color-scheme`, and sets `data-theme` on `<html>`. Also listens for
  `pageshow` (bfcache restores) and `prefers-color-scheme` changes, and for a `theme-change`
  `CustomEvent` on `document`.
- **`src/components/ThemeToggle.astro`** — the header button. A `<theme-toggle>` custom element
  whose click handler dispatches that `theme-change` event rather than touching `data-theme`
  directly — `ThemeProvider`'s listener is what actually applies it. Keeps "decide the new theme"
  and "apply the new theme" as two separate concerns.

To change the toggle's own visual state from somewhere else, fire the same event rather than
reaching into `ThemeProvider` — anything dispatching `theme-change` on `document` participates
correctly, including the toggle's own `aria-checked` bookkeeping.

## Typography

Prose content (post/note bodies, the About page, tag descriptions) is styled by Tailwind's
[`@tailwindcss/typography`](https://github.com/tailwindlabs/tailwindcss-typography) plugin, whose
theme-driven overrides live in `tailwind.config.ts`. `DEFAULT`, `sm` and `base` size variants are
configured — a `prose-cactus` class from the pre-de-branded starter theme was removed as dead
weight (no matching config, so it generated no CSS).

### The type scale

**TL;DR — two steps, breaking at `sm` (640px). Body is 14px on mobile and 18px on desktop; page
titles are 36px and 48px. The gap between the two body sizes is wide on purpose: headings run at
the larger scale at both breakpoints, but mobile body copy stays at 14px because the measure cannot
afford more.**

| role               | mobile | desktop | ×body       | set by                                       |
| ------------------ | ------ | ------- | ----------- | -------------------------------------------- |
| page title (`h1`)  | 36px   | 48px    | 2.25 / 2.67 | `.title`, and prose `h1`                     |
| section (`h2`)     | 30px   | 36px    | 1.88 / 2.00 | prose `h2`                                   |
| sub-section (`h3`) | 20px   | 24px    | 1.25 / 1.33 | prose `h3`                                   |
| body               | 14px   | 18px    | 1.00        | `text-sm sm:text-lg`, `prose-sm sm:prose-lg` |
| small UI text      | 12.8px | 12.8px  | 0.91 / 0.71 | `text-2xs`                                   |

Body size is set in two places that must agree: `text-sm sm:text-lg` on `Base.astro`'s page
wrapper (everything outside a prose block) and `prose prose-sm sm:prose-lg` at each of the 12
`.prose` call sites. Changing one without the other splits the scale in half.

**The measure, and what it costs.** Characters per line, not font size, is the readability metric,
and MonoLisa is a monospace — roughly 0.6em per character where a proportional face averages nearer
0.5em. Measured on a post body:

|                 | column | CPL    |
| --------------- | ------ | ------ |
| mobile (375px)  | 343px  | **38** |
| desktop (900px) | 704px  | **61** |

Desktop sits comfortably inside the 45–75 ideal band. **FOOTGUN: that band is not reachable on a
phone with this face at all.** At 375px the column is 343px, so 14px yields 38 CPL, 13px yields 41,
and hitting 44 would need a ~12px body — too small to read. 38 is the practical ceiling, which is
why mobile body does not follow the rest of the scale upward; raising it to 16px drops the measure
to 33, which was tried and walked back. `text-2xs` is likewise held at 0.8rem rather than following
the bump: at 0.9rem it rendered 14.4px, fractionally _larger_ than the 14px mobile body, which
inverts what that token is for. Note also that at 18px the desktop prose column is no longer capped by `prose`'s own `65ch`;
it now fills `max-w-3xl` (704px) instead, which is why CPL reads 61 rather than 65.

Verify a change to any of this by measuring the rendered text, not by eye:

```js
const p = document.querySelector(".prose p");
const cs = getComputedStyle(p);
const ctx = document.createElement("canvas").getContext("2d");
ctx.font = `${cs.fontSize} ${cs.fontFamily}`;
Math.round(
	p.getBoundingClientRect().width / (ctx.measureText("0123456789").width / 10),
);
```

**`.title` is two scales, and two of its call sites opt out.** `.title` means _page title_ — it
resolves to `text-title sm:text-title-lg` (36/48px, both registered in `tailwind.config.ts`'s
`fontSize`). Call sites that want something smaller override it with an ordinary `text-*` utility,
which wins because `.title` lives in `@layer components`. **FOOTGUN: `RecordCard.astro` and
`CardCollection.astro` carry an explicit `text-3xl`** — they use `.title` for _card_ titles, not
page titles, and without that pin a change to the page-title scale silently drags every vinyl
sleeve and Magic card heading up with it.

Prose `h1` deliberately matches `.title` rather than taking the plugin's own default, so a
markdown-level `h1` — the CV's name heading is the only one in the content today — reads as the
same rank as every other page title.

Heading sizes live in the `sm` and `base` typography blocks rather than `DEFAULT` because they are
`em`-relative: the same `em` resolves against prose-sm's 14px body and prose-lg's 18px, so one
shared value cannot hit both targets. Note the size-modifier names no longer match the breakpoints
they serve — `sm` is the **mobile** step here and `lg` is the desktop one.

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
(`RecordCard`, `CardCollection`, `Note` previews, the TOC summary, every page-level `h1`/`h2`) gets
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
