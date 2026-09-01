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
light mode is a bleached xerox-paper ground (a cool pink-grey, not a flat white/cream) with
near-black ink. Both themes share the same two accent hues rather than mirroring one theme's
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

### Ambient grain texture

`body::after` in `global.css` is a fixed, full-viewport, `pointer-events: none` layer that gives
the whole site a quiet photocopy-grain tooth — one of the two texture "roles" from the queer-punk
direction above (the other, riso color-misregistration on specific elements like a logo or
pull-quote, is a deliberately separate, not-yet-built "moments" treatment — see the
[[furioursus-dev-color-texture-redesign]] memory for that split and why it's two techniques, not
one).

It sits at `z-index: -1`, behind all page content, blending only with `body`'s own flat background
color rather than with whatever text/images happen to be on screen — it shows through the gaps
(margins, padding, any exposed page background) instead of crawling visibly across content as the
page scrolls. This requires `isolate` on `<body>` (`Base.astro`) so the negative z-index stays
contained to body's own stacking context instead of escaping behind `<html>` entirely. An earlier
version painted this *above* content at `z-index: 100` to clear other components' own stacking
z-indexes (Header's sticky bar `z-30`, its mobile menu `z-50`, BlogPost's back-to-top button
`z-90`) — that's no longer relevant now that the layer is behind everything, not competing to be on
top of it.

Any opaque surface sitting above that `-1` layer hides it completely, though — a solid-background
element just paints over it. The sticky header (`Header.astro`) is the one place on the page that's
always visible with its own solid background, so a naive always-on `bg-global-bg` used to read as a
flat slab over a grainy page, with a hard line where its own background ended and the page's began.
Rather than reproducing the grain pattern on the header itself (tried first, reverted — it works but
means cloning the grain recipe onto every opaque surface that ends up in this situation, and the
docs below already flag that this texture is sensitive to tiling coincidences at larger scale), the
header solves both problems — the flat-slab feel *and* the hard edge — with `.header-surface`
(`global.css`), a single class covering both:

- The header is `background-color: transparent` by default and only gets its solid
  `--color-global-bg` backing once Header.astro's own script adds `.is-stuck` to it. At page load
  the header just sits in its normal document position (the wrapper div's `pt-8`/`md:pt-16` in
  `Base.astro` gives it room above), with nothing scrolled underneath it yet to hide — a solid
  panel there from the first frame read as an unnecessary card dropped on the page before there was
  anything for it to actually cover.
  That script watches `#header-sentinel`, a zero-height marker `Base.astro` plants immediately
  before `<Header />`, with an `IntersectionObserver` — not the header itself, since a sticky
  header stays fully visible in the viewport the entire time regardless of whether it's actually
  stuck, so observing it directly never reports a change. The sentinel sits exactly where the
  header's own natural (unstuck) top edge rests; once it scrolls out of view above the viewport,
  the header can't scroll any further either, so it's necessarily gone stuck — and once the
  sentinel scrolls back into view, the header's unstuck again.
- A `mask-image` gradient fades that same background from opaque to transparent across exactly the
  header's bottom `py-8` padding (2rem) — empty space in its own layout, so nothing readable ever
  fades. Content dissolves into view there as it scrolls up instead of appearing/disappearing at a
  hard edge once `.is-stuck` makes the header solid. No fade on top, since nothing sits above a
  header pinned to `top: 0`. Needs `-webkit-mask-image` alongside the unprefixed property for Safari
  (unprefixed support only landed in 15.4). Harmless while the header is transparent and unstuck —
  masking a transparent background is a no-op.

**Both live on a `::before` pseudo-element, not on `<header>` directly** — an earlier version set
the background and mask straight on the header and broke the mobile nav dropdown
(`#navigation-menu`) in the process: `mask-image` (like `filter` or `opacity < 1`) forces an element
onto its own compositing layer and clips *all* of that element's rendering — including descendant
content that overflows past its border box — to the masked region. The dropdown is exactly that
(`position: absolute`, rendered entirely below the header's own ~100px box once open), so with the
mask on `<header>` itself it kept toggling correctly (right opacity, right transform, right
`display`) but was invisible: it was painting into the mask gradient's "past 100%, treat as
transparent" tail, nowhere near the small band at the very top that's meant to cover the header's
own bottom padding. Scoping the mask to a `::before` that duplicates the header's own box
(`inset: 0`) fixes this — that pseudo-element's masking only clips itself, not its siblings, and the
dropdown is a sibling of it (both children of `<header>`), not something painted through it.
`position: absolute` on the pseudo relies on `<header>` already being a positioned element via its
own `sticky` utility class — `.header-surface` itself deliberately never sets `position`, since it
lives outside any `@layer` (like `.breakout-container`) and would silently outrank that Tailwind
utility and break the sticky behavior if it did. `z-index: -1` puts the pseudo behind the header's
real content without needing `isolate` the way `body::after` does, because the header already
establishes its own stacking context (`sticky` plus a real `z-index` from `z-30`).

Two theme-swapped tokens drive it, same pattern as the color tokens: `--grain-image` and
`--grain-blend`, set on `html` and overridden under `&[data-theme="dark"]`. Light mode uses
`grain-light.webp` (dark ink marks on a mostly-light ground) with `mix-blend-mode: multiply`, which
treats light pixels as a no-op and only darkens where there's ink. Dark mode swaps to
`grain-dark.webp` — the same texture with colors inverted — and `mix-blend-mode: screen` instead:
multiplying an already-near-black background does nothing visible, so the blend mode has to flip
along with the asset, not just the color.

The source is a single large photocopy-texture photo (1920×1357), not a small seamless-tile crop —
an earlier version of this used a tiny (700×354, ~36KB) tiled crop with `background-repeat`, tested
because a broad-scale banding pattern in the original texture tiled into a visible vertical stripe
at high opacity; that constraint no longer applies now that `body::after` uses
`background-size: cover` to scale one full image across the viewport instead of repeating a tile.

Because it's `cover`-scaled rather than tiled, the image's own resolution now matters — a full-res
image is wasted bandwidth on a phone that's going to downscale most of it away, and unnecessarily
soft on a narrow `cover` box if you go the other way and serve a small image everywhere. `html`'s
`--grain-image` (light mode) and `&[data-theme="dark"]`'s copy (dark mode) each swap between three
breakpoint-sized tiers via plain `min-width` media queries at Tailwind's own `sm`/`lg` values (so
the tiers line up with where the rest of the site already changes shape): `grain-{light,dark}-960w.webp`
below `40rem`, `grain-{light,dark}-1600w.webp` from `40rem` to `64rem`, and the original full-res
`grain-{light,dark}.webp` from `64rem` up. Each tier's target width accounts for `body::after`'s own
`inset: -20%` box being 1.4x the viewport in each dimension, not just 1x, plus some headroom — not
the raw breakpoint value. Regenerate the smaller tiers from a new source with the `sharp` package
already in devDependencies:
`sharp(src).resize({ width }).webp({ quality: 45, effort: 6 }).toFile(out)`. Quality 45 was chosen
because the noise in this texture compresses poorly regardless of quality or format — file size
barely moved between quality 30 and 65 in testing — so there's little to gain by going higher; the
breakpoint tiers exist to avoid shipping unnecessary *resolution*, not because compression alone
gets this small.

The under-`40rem` tier also has an `orientation: portrait` variant
(`grain-{light,dark}-portrait.webp`, `@media (max-width: 39.9375rem) and (orientation: portrait)`).
For `cover`-fit, a portrait box's dominant dimension is its *height*, not its width — a tall
phone's `inset: -20%` box can need well over 1000px of source height, but the landscape 960w crop
is only 678px tall, so reusing it in portrait means real upscaling, not just a rounding margin.
The portrait asset is generated from the same source rotated 90° (this texture has no directional
structure, so a rotation reads identically to the original) and cropped to 640×960 — sized to land
close to the landscape 960w tier's own file size rather than chase zero-upscale accuracy on the
tallest phones, since a bit of extra upscale on outliers is invisible at this opacity anyway; what
actually buys the size-for-sharpness win over reusing the landscape crop is matching the aspect
ratio to the box, not a bigger file. Scoped to phones only (`max-width: 39.9375rem`) — portrait
tablets/laptops above that still fall back to the landscape 1600w/full-res tiers uncorrected; an
accepted gap (portrait is overwhelmingly a phone thing) rather than full coverage of every tier ×
orientation combination.

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

Custom elements that need block-level spacing to match a paragraph's rhythm, but aren't a tag the
plugin knows about by default (`<lightbox-image>`, `.admonition`, `.github-card`, Expressive Code's
output), are opted in explicitly via a selector list in that same config file rather than by
overriding the plugin's defaults globally.
