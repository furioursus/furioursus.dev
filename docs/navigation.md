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

The nav opens at `top-full`, so it is flush with the bottom edge of `<header>` by construction. The
`relative` ancestor it resolves against is the `px-4 py-8` row, whose padding box _is_ the header's
full box — `top: 100%` therefore lands exactly on the header's bottom, and keeps landing there when
the row's padding, the logo's height, or the title's font size change. This replaced a hardcoded
`top-18` (upstream Cactus hardcodes its own `top-12` the same way). That number only ever worked
because 4.5rem happened to equal `pt-8` plus the 40px mobile logo — it ignored the row's _bottom_
padding, so the dropdown actually opened 32px above the header's real edge, and any height change
silently drifted it. `top-full` needs no observer and no custom property: `<header>` is static and
never resizes on scroll, so layout alone gets it right.

`max-sm:-mt-4` then pulls the panel 1rem back up over the header's own bottom padding. Flush with
the header edge is the correct _anchor_ but too generous as a _gap_: the row's `pb-8` plus the nav's
`py-4` plus the link's `py-5` stacked up to roughly a full nav segment of dead space between the
wordmark and the first link. Keeping `top-full` and offsetting from it — rather than hardcoding a
smaller `top-*` — means the panel still tracks the header's real height, and the 16px is visible as
the deliberate design decision it is instead of being buried inside a magic offset. The overlap is
seamless because `<header>` is filled with the same colour while the menu is open (see below); on a
transparent header this same nudge would show the panel edge cutting into the texture.

`-inset-x-4` on the nav cancels the padded row's own `px-4`, so the open dropdown spans edge-to-edge
within that padding rather than sitting inset — lifted directly from upstream. (Because abspos
insets resolve against the _padding_ box, this overshoots by 16px a side; `overflow-x-clip` on
`<body>` absorbs it and the rendered result is the intended edge-to-edge.)

### Why `<header>` needs its own `relative z-40`

`.breakout-container` sets `transform: translateX(-50%)`, and **a transform makes the element a
stacking context**. That seals the nav's `group-[.menu-open]:z-50` _inside_ `<header>`, where it can
only order the header's own children — it cannot lift the open dropdown above anything outside.
`<header>` itself then paints at `z-index: auto` in DOM order, before `<main>`, so every positioned
element in the page body drew straight through the open menu.

It was visible on any page with positioned content high up: `/about/music/` rendered its
`nav.subnav` (About · Music · MTG) and the Last.fm now-playing widget on top of the open dropdown,
even though the nav has an opaque `bg-global-bg`. `document.elementFromPoint()` at the dropdown's
own midpoint returned a subnav `<a>`, not a nav link — the menu was unclickable there, not just
ugly. `relative z-40` on `<header>` gives that stacking context a real z-index and the whole subtree
lifts above `<main>` in one move.

40 sits deliberately under the lightbox, which is the only thing that must still cover the header.
That happens to be safe by a different mechanism anyway — `lightbox-dialog` is a native `<dialog>`
opened with `showModal()`, so it lives in the **top layer** and outranks every z-index on the page
regardless (`:modal` matches; its own computed `z-index` is `auto`). See `docs/lightbox.md`.

### Mobile type scale

Every size/face override on the nav links is `max-sm:`-scoped, because the same `<a>` elements are
also the desktop nav: at `sm` the parent `<nav>` flips to `sm:static sm:flex-row` and those links
become a 14px MonoLisa row. An unscoped `text-4xl` there would blow the masthead apart.

- `max-sm:font-display` — Bricolage Grotesque, the headline face, matching `.title`.
- `max-sm:[font-variation-settings:'opsz'_60]` — the same optical-size axis `.title` sets in
  `global.css`. Without it the face renders at its text-size optical default and loses the wonky
  display character it was picked for.
- `max-sm:text-4xl max-sm:font-bold max-sm:tracking-tight max-sm:py-5` — ~75px rows.

The nav's own padding is `px-4`, not the `px-2` it used to be: at 14px nobody could see that the
link text sat ~8px to the left of the page's content edge, but at 36px the misalignment against the
masthead and the post list below is obvious. `px-4` + the link's own `px-4`, against the `-inset-x-4`
overshoot, lands the text on the same 16px gutter as `<main>`.

### The solid mobile masthead

`max-sm:bg-global-bg` on `<header>` paints the same flat paper colour the open dropdown uses, so the
two read as one continuous slab the moment the menu opens rather than a textured bar with a flat
panel hanging off it. `.breakout-container` already stretches `<header>` to `100dvw`, so the fill
goes genuinely edge-to-edge without any extra negative-margin work.

It is `max-sm:`-scoped on purpose — on desktop `<header>` stays transparent and the root texture
runs straight through the masthead, which is the look that section was designed for.

Two consequences worth knowing:

- **The texture does not show in that strip on mobile.** `--color-global-bg` is the solid colour
  _derived from_ the paper texture (see `docs/theming.md`), not the texture itself, so the band is
  flat while everything under it stays grainy. With the menu closed this reads as a deliberate
  masthead plate; it is the intended trade, not a rendering bug.
- **It lines up with the browser chrome for free.** The `theme-color` meta is the same token, so on
  iOS Safari the address bar and the header slab are now literally the same colour with no seam.
  That also means the `theme-color` footgun in `global.css` now has visible consequences in one more
  place — change the token, check the masthead too.

### The solid masthead while the menu is open

`<header>` is transparent by default, so the root paper/dot texture runs straight through the
masthead. `max-sm:[&.menu-open]:bg-global-bg` fills it with the same flat colour the dropdown uses,
but **only while the menu is open**, so the header and the open panel read as one continuous slab
instead of a textured bar with a flat panel hanging off it. `.breakout-container` already stretches
`<header>` to `100dvw`, so the fill goes edge-to-edge with no extra negative-margin work.

Note the variant is `[&.menu-open]:`, not the `group-[.menu-open]:` used everywhere else in this
file. `.menu-open` is toggled on `<header>` itself, and `<header>` is also the `.group` — a
`group-*` variant compiles to a _descendant_ selector (`.group.menu-open &`), so it can never style
the group element itself. `[&.menu-open]:` compiles to `&.menu-open`, which is what's needed here.

The paired transitions keep it in step with the dropdown: `0.3s ease-out` opening (on the
`.menu-open` variant) and `0.15s ease-in` closing (on the base class, which is what's in effect once
`.menu-open` is gone), matching the nav's own two durations. Without them the header snapped to
solid instantly while the panel was still springing in, and — worse — dropped back to transparent
150ms before the closing panel had finished leaving.

**Gotcha when verifying this in a headless/hidden browser tab:** hidden tabs do not tick CSS
transitions, so `getComputedStyle()` reports the transition's _start_ value indefinitely and the
header looks like it never fills at all. Call `el.getAnimations().forEach(a => a.finish())` before
reading, or check a screenshot — the declared end state is correct even when the computed value
says otherwise.

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
  The footer does **not** carry them — it mirrors the header's row (see [The footer](#the-footer)),
  so Music and MTG are reachable only through About. That is the deliberate cost of nesting them.

Path comparisons go through a `withSlash()` helper rather than raw string equality. Astro's build
emits `/about/mtg/`, but an internal link may omit the trailing slash, and a bare `startsWith`
against an unslashed `/about` would also match a hypothetical `/aboutish/`.

The subnav's active marker is an `::after` bar rather than an underline, so it sits flush under the
text regardless of descenders and takes its colour independently of the link's own state.

There is deliberately **no dropdown under About in the header**. A disclosure menu there means hover
intent, `aria-expanded`, Escape handling, a focus decision for About itself, and a nested list
inside the mobile dropdown — and this file already records two reverted attempts at elaborate header
machinery. The subnav does the same job with a plain list of links and no JavaScript.

Old URLs are 301'd in `public/_redirects`. `/vinyl-collection/` points straight at
`/about/music/` rather than chaining through `/music/`, since Netlify only follows one hop.

## The footer

`Footer.astro` renders its own `<nav aria-label="Footer">` from the same `menuLinks` export the
header uses, and the two rows are meant to stay **the same set of links**. Both map `menuLinks`
directly, so a new top-level entry shows up in both without either component being touched.

There is exactly one deliberate difference:

- **The footer keeps `/`; the header drops it.** The header's logo link immediately precedes its
  `<nav>`, so a "Home" item there is an adjacent link to the same destination, which WAVE flags as a
  failure. The footer has no adjacent logo link, so "Home" appears there as an ordinary text link.
  See [Why `menuLinks` drops `/` here](#why-menulinks-drops--here).

**Nested `children` are deliberately not flattened into the footer.** An earlier version did splice
them back in (`menuLinks.flatMap((link) => [link, ...(link.children ?? [])])`) so that Music and MTG
stayed one click from anywhere on the site. That was dropped in favour of the footer matching the
header exactly. The consequence is real and intended: those two pages are reachable only through
About.

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
