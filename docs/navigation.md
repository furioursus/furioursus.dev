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
