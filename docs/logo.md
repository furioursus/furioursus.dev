# Logo idle animation

The bear mark in the header (`Header.astro`'s inline `<svg data-name="Bear Face">`) blinks,
twitches its ears, and glances around on an endless idle loop when no one's doing anything — and
tracks the reader's actual cursor around the page the moment they move it. `public/icon.svg` (the
favicon) is a separate, static copy of the same artwork; browsers don't run CSS animations inside
a favicon, so there's nothing to gain animating that file too.

## How it's built

One file, `src/styles/components/logo.css` (imported in `global.css` alongside the other
component styles), targeting the existing element `id`s already present in the inline SVG —
`#Ear1`/`#Ear2` (each a `<g>` wrapping a back/front path pair), `#Eyes` (the `<g>` wrapping both
eye paths), `#Eye1`/`#Eye2`, and `#Muzzle`. A `.logo-mark` class on the `<svg>` scopes all of it,
added alongside the existing Tailwind utility classes:

```html
<svg data-name="Bear Face" class="logo-mark ..."></svg>
```

Four independent `@keyframes` loops, one per gesture, each on its own duration so they drift in
and out of phase instead of twitching in lockstep — 7s (blink), 9s (left ear), 11s starting 3s in
(right ear), 13s (glance). Those four numbers are pairwise coprime-ish on purpose: the combined
pattern takes a very long time to visibly repeat.

- **Blink** — `#Eye1`/`#Eye2` each run `logo-blink`, scaling `scaleY` down to `0.08` and back,
  origin `50% 50%`. A single loop actually blinks twice in quick succession near the end of its
  cycle (a real double-blink), then holds the eyes open for most of the remaining time.
- **Ear twitch** — `#Ear1`/`#Ear2` each `rotate()` a few degrees and settle, `ease-in-out`, mostly
  sitting at `0deg`.
- **Look around** — `#Eyes` (the group, not the individual eyes) and `#Muzzle` both run
  `logo-look-around` — same keyframes, same 13s duration, no relative delay between them — each
  `translateX`-ing left then right then back to center in exact lockstep. `#Muzzle` is a sibling
  of `#Eyes` in the SVG, not nested inside it, so it needs the animation applied directly rather
  than inheriting it; putting both on the identical animation (rather than two separately-tuned
  ones) is what sells this as the whole face turning, not just the eyes sliding around on a
  static muzzle. The eyes' own blink transforms still compose fine on top of this, since they
  live on the child `#Eye1`/`#Eye2` elements, not the group doing the glance.

## Cursor tracking

Once the reader's cursor moves, `#Eyes` and `#Muzzle` stop running `logo-look-around` and instead
point at wherever the cursor actually is on the page — pure CSS, driven by
[`prop-for-that`](https://github.com/argyleink/prop-for-that), a small library that exposes
JS-only runtime state (pointer position, viewport size, etc.) as live CSS custom properties. No
mousemove listener, no rAF loop, no cleanup code, no JS class-toggling lives in this repo for this
feature — all of that is the library's problem, not ours.

**`PropsForAuto.astro`** (included once in `Base.astro`) is the site-wide integration point, and
does two things:

1. Imports `prop-for-that/auto`, the library's zero-config entry — from then on, any element
   anywhere in the site can opt into a live source just by adding `data-props-for="<key>"`.
2. Renders one shared, invisible, `position: fixed; inset: 0` div bound to the `pointer-local`
   plugin, with its writes hoisted onto `<body>` via `data-props-to="body"`. Read that file's own
   comment for why a full-viewport `fixed` div specifically (not `<body>` or `<html>` directly) —
   short version: `pointerLocal` measures the cursor against _its bound element's own
   `getBoundingClientRect()`_, and only a `fixed; inset: 0` element's box is guaranteed to equal
   the viewport at every scroll position; binding straight to `<body>` would compress the usable
   range on any page taller than one screen.

That div writes three properties onto `<body>`, inherited by everything on the page:
`--live-local-pointer-x-ratio` / `-y-ratio` (0–1 across the viewport) and
`--live-local-pointer-inside` (1/0 — cursor anywhere in the browser window). `logo.css` consumes
them with a container style query:

```css
@container style(--live-local-pointer-inside: 1) {
	& #Eyes,
	& #Muzzle {
		animation: none;
		transform: translate(
			calc((var(--live-local-pointer-x-ratio, 0.5) - 0.5) * 2 * 3.2px),
			calc((var(--live-local-pointer-y-ratio, 0.5) - 0.5) * 2 * 2.4px)
		);
	}
}
```

Two things make this work without a `container-type` opt-in anywhere or any hoisting inside
`logo.css` itself:

- **Custom properties inherit downward.** `<body>` is an ancestor of `.logo-mark`, so
  `.logo-mark`'s descendants read `--live-local-pointer-*` for free.
- **Every element is a valid `@container style()` container** — unlike size queries, style queries
  don't need `container-type` set on the ancestor. The query above matches because `<body>` is the
  _nearest ancestor_ actually carrying `--live-local-pointer-inside`.

Reverts to the idle loop automatically the instant `--live-local-pointer-inside` drops back to
`0` (cursor leaves the browser window) — same mechanism, just the other branch of the query.

**Reusing this for something else:** any future feature that wants "where's the cursor, roughly"
can read the same three `--live-local-pointer-*` properties directly — no need to stand up another
tracking element. For a different kind of runtime state entirely (viewport size, battery, network,
scroll velocity, and 20+ more), see `node_modules/prop-for-that/README.md` for the full source
catalog; adding a new one is almost always just a `data-props-for="<key>"` attribute plus, if it's
a plugin source, nothing else — `auto` lazy-loads plugin chunks on first reference.

## The load-bearing bit: `transform-box: fill-box`

SVG geometry elements default to `transform-box: view-box` — a percentage `transform-origin` like
`50% 50%` resolves against the whole 68.31×64.71 viewBox, not the shape being animated. Every
animated element gets `transform-box: fill-box` explicitly so its own `transform-origin`
percentage means "relative to this shape's own bounding box" instead. Without it, `50% 50%` on an
eye would pivot the blink around the center of the entire bear, not the center of the eye.

The ear pivots aren't `50% 50%` — they're offset toward the corner of each ear's bounding box that
sits nearest the skull (`82% 92%` for the left ear, `9% 90%` for the right), found by inspecting
each group's `getBBox()` in a browser console. That's what makes the twitch hinge the ear in place
instead of swinging the whole shape through space. **If the ear or eye paths in `Header.astro`
ever move, these origin percentages need re-deriving** — they're tied to the current artwork's
bounding boxes, not to anything self-adjusting.

## Accessibility

`@media (prefers-reduced-motion: reduce)` turns the four idle loops off, matching the pattern
already used in `lightbox.css`. Cursor tracking is deliberately left running under that same media
query — it's 1:1 direct-manipulation feedback (it only ever moves because the reader's own pointer
just moved), not autoplaying decorative motion, so it isn't the kind of thing that preference is
meant to suppress. The `<svg>` itself is already `aria-hidden="true"` (the site title text next to
it is the accessible name for the home link), so none of this has any assistive-tech surface to
worry about beyond motion preference.
