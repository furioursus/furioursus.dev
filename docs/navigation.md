# Navigation (`Header.astro`)

The header is `position: static` at every breakpoint — it scrolls away with the page like any other
content, same as [Astro Cactus](https://astro-cactus.chriswilliams.dev/) upstream. It used to be
`position: sticky` on mobile, but staying pinned meant every future background or margin tweak had
to keep several pieces in sync with it: a fade-in background, an `IntersectionObserver` watching a
sentinel in `Base.astro`, and a `ResizeObserver`-driven CSS custom property so the mobile dropdown's
`top` offset tracked the header's actual (sometimes-changing) rendered height. All of that is gone.
The header is now just a normal block, same as it was before anyone made it sticky, and there's no
persistent nav chrome while scrolled on mobile — you scroll back to the top, exactly like upstream.

## The mobile dropdown

Nav links live in a plain `<nav id="navigation-menu">`, toggled by a `.menu-open` class the
`<mobile-button>` custom element flips on `<header>` when its button is clicked
(`group-[.menu-open]:` Tailwind variants key off that class on the nav's styling). This is the same
mechanism Astro Cactus uses upstream — no native `<dialog>`, no focus trap, no `showModal()`. Two
earlier, more elaborate attempts at this file both got reverted:

- A separate always-visible **sticky mobile bar** (wordmark + menu button, pinned via
  `position: sticky` while the rest of the masthead scrolled away) turned out to have a real bug on
  real devices: iOS Safari's compositing let the grainy body background peek through at the bar's
  edge during a fast scroll — a `position: sticky` + `transform` (from `.breakout-container`)
  combination is exactly the kind of setup that's prone to layer-boundary artifacts like this.
- A native `<dialog>`-based menu (a full mobile modal via `showModal()`, forced to
  `display: contents` on desktop so the same element could serve both breakpoints) worked, but was
  more machinery than the problem needed once the sticky bar it was replacing was gone too.

The nav's `top-18` (4.5rem) is a plain, hardcoded offset — not measured, not a CSS custom property.
`<header>` is static now and never resizes on scroll, so the row's rendered height is a fixed, known
quantity, the same way upstream Cactus hardcodes its own equivalent (`top-12`) rather than measuring
it. `-inset-x-4` on the nav cancels the padded row's own `px-4`, so the open dropdown spans
edge-to-edge within that padding rather than sitting inset — also lifted directly from upstream.

## The masthead logo

The mark bleeds left out of the title column into a gutter reserved for it, and it is deliberately
sized **bigger than that gutter** so it reads as a prominent mark rather than a small icon.

`sm:ps-18` reserves the gutter, and it lives on the innermost flex row specifically — not on the
`px-4 sm:px-8` wrapper above it. **Tailwind's `ps-*` replaces `px-*`'s start-side value rather than
adding to it**, so stacking both on one element would make the logo's `-inset-s-18` pull-back cancel
against the raw breakout edge instead of the content column's edge, landing the mark about 32px too
far left of the `h1`. This mirrors the file's pre-sticky-header structure, where `ps-18` sat on
`<header>` itself while `px-4 sm:px-8` lived one level up in `Base.astro` — the same two-level
relationship, with both levels now inside the breakout shell.

The mark is sized by height with an auto width, to keep the artwork's own aspect ratio rather than
the odd one a fixed `w-*` would force — which means its rendered width is not a static number
anything can subtract by hand. `sm:inset-s-18` + `sm:-translate-x-[calc(100%+0.5rem)]` sidesteps
that: position it at the gutter's _far_ edge (flush with the title text's own start), then shift it
left by its own width plus a fixed `0.5rem`. Its right edge lands a consistent half-rem before the
title no matter what the width resolves to, and stays correct if the height ever changes again.
`h-18` in particular leaves clear space above and below within the row's own 136px height at `sm:`
(a 72px logo plus 2×32px from the `py-8` on the row above).

Vertical centering (`sm:inset-y-0 sm:my-auto`) is a separate mechanism, and it is the reason the
grayscale/hover-color utilities sit on the logo and title **individually** (via `group-hover`, scoped
to the `<a>`) rather than on the `<a>` itself. **A CSS `filter` on an element makes it a containing
block for absolutely positioned descendants regardless of its own `position`** — with the filter on
the `<a>`, the logo centered against the `<a>`'s own ~32px title-text height instead of the full row
height.

## Tailwind v4 gotchas in this file

- **`transform` and `transition` are written as arbitrary properties**
  (`max-sm:transform-[scale(0.92)_translateY(-0.5rem)]`,
  `max-sm:[transition:opacity_0.15s_ease-in,transform_0.15s_ease-in,display_0.15s_allow-discrete]`),
  not `scale-*`/`translate-*`/`duration-*` utilities. Tailwind v4's `scale-*`/`translate-*` set the
  **standalone** `scale`/`translate` CSS properties, not `transform` — so a hand-written
  `transition: transform ...` list paired with them would be listing a property that never changes.
- **`[@starting-style]:`**, Tailwind's arbitrary at-rule variant, rather than the dedicated
  `starting:` shorthand, so this doesn't depend on which Tailwind 4.x minor added that shorthand.
- **`divide-muted` is explicit, not incidental.** `divide-x`/`divide-y` add their border with no
  color utility alongside, and `border-color`'s CSS default is `currentColor`. Tailwind puts the
  divider on the _preceding_ link as a `border-inline-end`, so each separator would otherwise pick
  up that same link's own `color` — visibly flashing the hover/active yellow along with whichever
  link was hovered. Pinning it to `--color-muted` decouples the divider from any one link's state.
- **`max-sm:`** is Tailwind's max-width variant, compiling to the same `@media (width < 40rem)`
  range query this file used to hand-write. The desktop nav is unconditionally `sm:flex`, so none
  of the display-toggling or animation applies there.

## Section subnavs (`SubNav.astro`)

`menuLinks` entries take an optional `children` array (`MenuLink` in `src/types.ts`). Music and MTG
are `children` of About, so they live at `/about/music/` and `/about/mtg/` and are **absent from the
header** — the header maps `menuLinks` itself, so nesting removes them from it for free. They
surface two other ways:

- `SubNav.astro`, dropped in under the `<h1>` of each of the three About-section pages. It takes no
  props: it reads `Astro.url.pathname`, finds the `menuLinks` entry with `children` whose path is a
  prefix of it, and renders that parent plus its children as a row. Nothing can pass it the wrong
  section, and a fourth About-section page only needs the `children` entry plus the one `<SubNav />`
  line.
- The **footer**, which flattens `children` back into one list (`menuLinks.flatMap(...)`), so these
  pages stay one click from anywhere despite being two levels deep in the URL. This is the second
  place the header and footer copies of `menuLinks` deliberately diverge — see the `/` note below.

Path comparisons go through a `withSlash()` helper rather than raw string equality. Astro's build
emits `/about/mtg/`, but an internal link may omit the trailing slash, and a bare `startsWith`
against an unslashed `/about` would also match a hypothetical `/aboutish/`.

There is deliberately **no dropdown under About in the header**. A disclosure menu there means hover
intent, `aria-expanded`, Escape handling, a focus decision for About itself, and a nested list
inside the mobile dropdown — and this file already records two reverted attempts at elaborate header
machinery. The subnav does the same job with a plain list of links and no JavaScript.

Old URLs are 301'd in `public/_redirects`. `/vinyl-collection/` points straight at
`/about/music/` rather than chaining through `/music/`, since Netlify only follows one hop.

## Why `menuLinks` drops `/` here

The nav filters `link.path !== "/"`: the logo link immediately before the `<nav>` already goes home,
so a "Home" item here would be an **adjacent link to the same destination**, which WAVE flags as a
failure. The footer's copy of `menuLinks` keeps "Home" — it has no adjacent logo link.

Nav links carry `hover:text-nav-hover active:text-nav-hover` alongside their normal `text-accent`.
`--color-nav-hover` is a no-op in light mode and a vivid yellow in dark — see
[theming](./theming.md#current-palette).

## Search and theme toggle

`<Search />` and `<ThemeToggle />` are unconditionally inline in the masthead at every breakpoint,
never hidden or duplicated on mobile. `Search.astro` wraps Pagefind's
`<pagefind-modal-trigger>`/`<pagefind-modal>` web components, which share a single default instance
keyed by name (`getInstanceManager().getInstance("default")`); a second `<pagefind-modal>` on the
page would register an orphaned modal that `openModal()`'s `modals[0]` lookup would never actually
open, plus a duplicate `id="search"`. Not worth the risk for a mobile-only variant that was never
actually asked for — if search/theme ever need a dedicated mobile presentation, split `Search.astro`
into a shared config+modal singleton and a lightweight, freely-repeatable trigger-only component
first.
