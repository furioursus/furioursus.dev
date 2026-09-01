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

`body::after` in `global.css` is a `pointer-events: none` layer that gives the whole site a quiet
photocopy-grain tooth — one of the two texture "roles" from the queer-punk direction above (the
other, riso color-misregistration on specific elements like a logo or pull-quote, is a
deliberately separate, not-yet-built "moments" treatment — see the
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

`position: absolute`, not `fixed` — a real, confirmed regression, found the hard way. An earlier
version used `position: fixed` (pinned to the viewport, so the texture stayed visually put on
screen while content scrolled past it) with a generous `inset` overscan for iOS Safari's
rubber-band bounce. On a real device (iPhone 17 sim, iOS 26.5) that still failed to reach the true
bottom edge on short pages, confirmed by swapping in a plain `body` background with no positioning
tricks at all, which *did* reach the edge reliably — `position: fixed` elements on iOS Safari have
a documented history of not always keeping pace with the dynamic toolbar's show/hide animation in
real time. `absolute`, anchored to `body`'s own box (`isolate` plus `body`'s `relative` utility
already make it a valid containing block), sidesteps the whole class of viewport-tracking bugs by
not depending on the viewport at all — it just covers whatever `body`'s real, already-correct
rendered extent turns out to be. That makes it scroll normally with the page instead of staying
pinned to the screen — a genuine behavior change, not just a bugfix: the grain now reads as texture
printed on the page itself rather than an overlay hovering in front of the viewport, arguably more
honest to the photocopy metaphor anyway.

That positioning change has a knock-on effect on how the image itself is sized: `background-repeat:
repeat` with a small tile, not `background-size: cover` with one large photo. A `fixed` layer only
ever needs to cover one viewport's worth of space at a time (whatever's currently on screen), so
`cover`-scaling one big image was fine there. An `absolute` layer sized to `body`'s *entire*
document height would need to `cover`-scale that same image across the whole page in one stretch,
badly distorting it on anything longer than one screen — every real post on this site. A repeating
tile sidesteps that: same reasoning that led to a tiled asset the very first time this feature
existed, before an intermediate version swapped to one large `cover`-scaled photo and needed
viewport-width breakpoint tiers (now removed, along with the old `grain-{light,dark}-{960w,1600w,
portrait}.webp` assets they served) to keep that from shipping desktop resolution to a phone. None
of that tiering machinery is needed for a small repeating tile — one asset per theme, done.

`<html>` also carries its own `background-color: var(--color-global-bg)` now, matching whichever
theme is active — without the old `fixed` layer's generous overscan margin, iOS Safari's
rubber-band bounce past the very top/bottom of the page would otherwise reveal a stark white flash
(the browser's default canvas color) in that sliver rather than the correct flat theme color. The
grain texture itself doesn't extend into that sliver either way — it's sized to `body`'s own box,
and bounce scrolls past `body`'s actual edges entirely — so this is only ever a flat color there,
never textured. An accepted, minor gap, not worth chasing given how brief and edge-adjacent the
bounce reveal actually is.

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

The source is a single small seamless-tile crop (1482×888) per theme, `background-repeat: repeat`
across whatever `body`'s actual box turns out to be — see the `position: absolute` note above for
why a tile instead of one large `cover`-scaled photo. No viewport-width breakpoint tiers needed
here the way an earlier `cover`-scaled version required: a repeating tile's own resolution doesn't
need to track the viewport the way a single scaled-to-fit image's did, so one asset per theme
covers every screen size.

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
