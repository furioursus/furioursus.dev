# Navigation (`Header.astro`)

The header (`src/components/layout/Header.astro`) is `position: static` at every breakpoint — it
scrolls away with the page like any other content. It used to be `position: sticky`, but that made
every future background/margin tweak a multi-file exercise (a fade-in background, an
`IntersectionObserver`, a height-synced dropdown offset all had to agree with each other). None of
that exists anymore; the header is now just a normal block.

## The mobile sticky bar

What's actually always visible on mobile is a separate, much smaller thing: a slim `h-14` strip,
`sm:hidden`, carrying just the site wordmark and the menu button. It's `position: sticky; top: 0`
and permanently opaque (`bg-global-bg` + a `border-muted` bottom border) — no fade, no
scroll-position tracking. At this size it reads as ordinary toolbar chrome, not a header-sized card
dropped over the page, so it doesn't need the machinery a full-header version would (see
[Theming](./theming.md) for why that machinery existed and was removed).

It's a **sibling of `<header>`, not nested inside it** — `position: sticky` only stays stuck for as
long as its own containing block still intersects the viewport, and `<header>`'s containing block
is just its own (fairly short) box. Nested inside it, the bar stopped sticking and scrolled away
with the masthead the instant you scrolled past the header's own bottom edge. As a sibling, its
containing block is `Base.astro`'s full-page wrapper instead, so it keeps sticking all the way down
through the rest of the page. It carries its own `breakout-container` class (rather than inheriting
the full-bleed width from a `<header>` ancestor) to still span edge-to-edge instead of sitting
inside the `max-w-3xl` reading column.

At `sm:` and up this bar disappears (`sm:hidden`) and the masthead below it — logo, title, nav
links, search, theme toggle — is always visible inline instead, exactly as before.

## The mobile menu: one `<dialog>`, two breakpoints

The nav links live in a single native `<dialog id="mobile-menu">`, and it does double duty rather
than having a separate mobile and desktop implementation:

- **Mobile**: a real modal. The sticky bar's button calls `dialogEl.showModal()`, which gets you
  focus-trapping, Esc-to-close, and a `::backdrop` for free. `global.css` styles it as a sheet
  pinned to the top edge (`position: fixed; inset: 3.5rem 0 auto 0`), sliding down via a
  `transform`/`@starting-style` transition. `3.5rem` matches the sticky bar's own `h-14` by
  construction (both are fixed, hand-picked numbers, not measured) — if one changes, update the
  other; that's the one number this design still needs two files to agree on.
- **Desktop**: never a modal at all. Nothing on desktop ever calls `.showModal()` on it (the toggle
  button only exists inside the `sm:hidden` sticky bar), and `global.css` forces
  `#mobile-menu { display: contents }` at `sm:` and up — the dialog vanishes from the box model
  entirely, so its child `<nav>` lays out as a plain flex row exactly as if the wrapper weren't
  there. The dialog stays in the same DOM position the old plain `<nav>` used to occupy (inside the
  title column, so `sm:flex-col` still stacks nav below title) specifically so this works.

**Why an ID selector, not a class, for the desktop override**: the browser's own stylesheet says
`dialog:not([open]) { display: none }`, specificity `(0,1,1)`. A class utility (`(0,1,0)`) loses
that fight outright — a class-based override would need `!important` to win. `#mobile-menu`
`(1,0,0)` beats it cleanly with no `!important` needed, the same "wins on the cascade, not by
force" reasoning `.breakout-container` and the old `.header-surface` relied on by living outside
any `@layer`.

**The one thing JS still has to do**: if a real modal is open on mobile and the viewport crosses the
`sm:` breakpoint mid-session (rotate, resize), `display: contents` kicking in doesn't clear the
dialog's top-layer/backdrop/focus-trap state on its own — nothing forced it closed. A single
`matchMedia("(width >= 40rem)")` change listener in `Header.astro`'s script calls `dialogEl.close()`
when that happens. That, backdrop-click-to-close (a click whose `event.target` is the dialog element
itself — `::backdrop` isn't a real node, so a backdrop click has nowhere else to land), and syncing
the button's `aria-expanded` off the dialog's native `close` event are the entire script now — no
`ResizeObserver`, no manual class toggling.

## Search and theme toggle

`<Search />` and `<ThemeToggle />` are unchanged and stay inline in the masthead at every
breakpoint — they're not part of the mobile sticky bar or the menu dialog. `Search.astro` wraps
Pagefind's `<pagefind-modal-trigger>`/`<pagefind-modal>` web components, which share a single
default instance keyed by name (`getInstanceManager().getInstance("default")`) — a second trigger
elsewhere is safe, but a second `<pagefind-modal>` would register an orphaned modal that
`openModal()`'s `modals[0]` lookup would never actually open, plus a duplicate `id="search"`. Not
worth the risk for what wasn't the actual ask; if search/theme ever need to be reachable from the
sticky bar too, pull `Search.astro` apart into a shared config+modal singleton and a lightweight,
freely-repeatable trigger-only component first.
