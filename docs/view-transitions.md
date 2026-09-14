# View transitions

Navigating between the three About-section pages (`/about/`, `/about/music/`, `/about/mtg/`) should
read as one page changing panels, not three documents replacing each other. That is done with
**native cross-document view transitions** — no JavaScript, no router, no `<ClientRouter />`.

The opt-in switch is a single at-rule in [`global.css`](../src/styles/global.css)'s base layer:

```css
@view-transition {
	navigation: auto;
}
```

It was already there, unaccompanied, which meant every navigation got the browser's default
full-page cross-fade and nothing else. [`styles/components/view-transitions.css`](../src/styles/components/view-transitions.css)
is what shapes it; [`SubNav.astro`](../src/components/layout/SubNav.astro) contributes the two names
that only exist inside the About section.

## Why not Astro's `<ClientRouter />`

Astro ships a SPA-style router that gives you view transitions plus `transition:persist`. It also
ships client JavaScript, takes over every navigation, and would need a persistence audit for the
`<mobile-button>`/`ThemeToggle` custom elements, the Pagefind modal singleton (see
[search](./search.md)), the theme-flash guard, and the client-side filtering on
[`/about/mtg/`](./mtg.md) and [`/about/music/`](./discogs.md). The native at-rule gets the same
visual result here for zero bytes, because this site never needed to preserve state across a
navigation — only to stop the chrome flickering.

## What gets a name, and what deliberately does not

A `view-transition-name` lifts an element out of the `root` snapshot and animates it as its own
group. Everything unnamed stays in `root` and cross-fades together.

| Element                          | Name               | Why                                                 |
| -------------------------------- | ------------------ | --------------------------------------------------- |
| `#main-header`                   | `site-header`      | Identical on every page; must not fade or drift.    |
| `.subnav`                        | `section-subnav`   | Must hold still while the content under it changes. |
| `.subnav a[aria-current]::after` | `subnav-indicator` | The bar slides from the old tab to the new one.     |
| page `<h1>`                      | —                  | See the `.title` footgun below.                     |
| `<footer>`                       | —                  | See the footer footgun below.                       |

### FOOTGUN: a duplicate name silently kills the whole transition

`view-transition-name` values must be unique **per document**. If two elements share one, the browser
does not merely skip that element — it abandons the entire transition, with no console error.

This is why the page `<h1>` is unnamed even though morphing "About Me" → "Music" would look good.
`.title` is not a page-title class: [`Note.astro`](../src/components/note/Note.astro) and
[`CardCollection.astro`](../src/components/CardCollection.astro) both reuse it, so `/about/music/`
renders **73** elements matching `.title`. Naming it by class would have turned view transitions off
across the whole site, invisibly.

If you add a name, confirm it resolves exactly once on every page, not just the one you are looking
at.

### FOOTGUN: the footer must stay unnamed

The footer sits at `mt-auto` inside `Base.astro`'s `min-h-dvh` flex column, so its y-position is a
function of content height — roughly 700px down on `/about/`, roughly 9000px down on `/about/mtg/`.
A named element morphs between its old and new geometry, so naming the footer would animate it
streaking down the viewport on every navigation into a long page. Left unnamed, it cross-fades in
place with the rest of `root`, which is what you want.

### FOOTGUN: `animation-duration: 0s` on the group is not enough

Suppressing an element's animation takes **two** rules, because a transition group has two moving
parts: `::view-transition-group(name)` drives geometry, and a separate default 250ms cross-fade runs
on `::view-transition-old(name)` / `::view-transition-new(name)`. Zeroing only the group leaves the
image pair fading. The header therefore sets `animation: none` on old and new, plus
`mix-blend-mode: normal` — the UA cross-fade depends on `plus-lighter`, which blows out toward white
once two opaque snapshots are drawn over each other without it.

## The sliding indicator

The active tab used to be marked with `text-decoration: underline`. It is now an `::after` bar,
because **only a box can carry a `view-transition-name`**, and a text decoration is not a box. Exactly
one link per page has `aria-current="page"`, so exactly one bar exists, so the name stays unique and
the browser interpolates the bar's position from the old page's tab to the new one's.

### FOOTGUN: `view-transition-name` is global even inside an Astro scoped `<style>`

Astro scoping rewrites _selectors_ (`.subnav` → `.subnav[data-astro-cid-…]`). It does not namespace
property values, so a name declared in a component's scoped block still collides document-wide.

The same asymmetry is why the `::view-transition-*` rules live in the global stylesheet rather than
next to the component that owns them: those pseudo-elements are children of the document root, so
Astro's scoping would rewrite them into selectors that match nothing. Element-level
`view-transition-name` declarations are safe in a scoped block; the pseudo-element rules are not.

## Reduced motion

Opacity is not a vestibular trigger; movement is. So `prefers-reduced-motion: reduce` keeps the
cross-fade and drops only the travel — the content's 6px rise is inside a
`prefers-reduced-motion: no-preference` block, and the indicator's group duration drops to `0s` so
the bar snaps rather than slides.

The `vt-rise` travel is deliberately small for a second reason: the `root` snapshot contains the
footer, so anything larger reads as the footer sliding rather than the content settling.

## Verifying a change

View transitions are **skipped on a document that is not rendering**, which includes a backgrounded
tab (`document.visibilityState === "hidden"`). Headless and embedded browser panes commonly report
`hidden`, so a probe there will report that nothing ran even when the CSS is correct. Check
`document.visibilityState` before concluding anything from an automated check, and confirm the actual
animation in a real, focused window.

What _can_ be checked reliably from a hidden document is the thing most likely to be wrong:

```js
[...document.querySelectorAll("*")]
	.map((el) => getComputedStyle(el).viewTransitionName)
	.filter((n) => n && n !== "none");
```

Any value appearing twice means the whole transition is dead.

## Browser support

Cross-document view transitions are Chromium 126+ and Safari 18.2+. Firefox does not support them
yet and simply navigates normally — nothing is broken there, and nothing needs a fallback, because
every rule in `view-transitions.css` lives inside a `::view-transition-*` pseudo or an at-rule an
unsupporting browser ignores. The `::after` indicator bar is plain CSS and renders everywhere.
