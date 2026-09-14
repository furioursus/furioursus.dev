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
other — riso color-misregistration on specific elements like a logo or pull-quote — is a
deliberately separate, not-yet-built "moments" treatment. See the
[[furioursus-dev-color-texture-redesign]] memory for that split and why it is two techniques rather
than one.

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

The dot SVGs use a 120x120 viewBox with dots on a 24px pitch, so `--dots-size: 120px 120px` renders
the authored 24px spacing. The dots are sub-pixel at that pitch (0.96px), which is why their
`fill-opacity` is the sensitive knob rather than their size.

FOOTGUN: **all four assets sit within ~800 bytes of Vite's 4096-byte `assetsInlineLimit`, and which
side they land on is not stable.** Verified against a real build:

| asset                 | source size | build output                                               |
| --------------------- | ----------- | ---------------------------------------------------------- |
| `paper-dark.webp`     | 2688 B      | **inlined** into the CSS as a `data:image/webp;base64` URI |
| `grid-dots-dark.svg`  | 4231 B      | emitted as `/_astro/grid-dots-dark.<hash>.svg`             |
| `grid-dots-light.svg` | 4233 B      | emitted as `/_astro/grid-dots-light.<hash>.svg`            |
| `paper-light.webp`    | 4858 B      | emitted as `/_astro/paper-light.<hash>.webp`               |

An older version of this doc claimed the dot SVG is inlined "so it costs no extra request" — it is
not, and has not been since the light/dark pair replaced the smaller single asset. Re-encoding a tile
a little smaller silently converts it from a fingerprinted, `immutable`-cached file (see
[Asset caching](./caching.md)) into base64 embedded in the stylesheet that **every** visitor
downloads, including ones on the other theme. Check the built CSS after changing any of these rather
than assuming; the threshold is close enough that a quality tweak can cross it.

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
theme-driven overrides live in `tailwind.config.ts`. Only `DEFAULT` and `sm` size variants are
configured — a `prose-cactus` class from the pre-de-branded starter theme was removed as dead
weight (no matching config, so it generated no CSS).

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
