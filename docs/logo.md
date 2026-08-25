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
eye paths), `#Eye1`/`#Eye2`, and `#Muzzle`, plus four purely-structural wrapper `<g>`s —
`#Eye1Track`/`#Eye2Track`/`#Ear1Track`/`#Ear2Track`/`#MuzzleTrack` — that exist only for cursor
tracking; see [Cursor tracking](#cursor-tracking) below for why they're there. A `.logo-mark` class
on the `<svg>` scopes all of it, added alongside the existing Tailwind utility classes:

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
`--live-local-pointer-inside` (1/0 — cursor anywhere in the browser window, unused by `logo.css`
today but kept for any future consumer — see [Reusing this for something
else](#return-to-idle)). A second, separate source (also registered in `PropsForAuto.astro`,
covered in [Return to idle](#return-to-idle) below) writes `--live-idle` (1/0) onto `<html>`.
`logo.css` reads the pointer ratios for *where* to point, and `--live-idle` for *whether* to be
tracking at all:

```css
@container style(--live-idle: 0) {
	& #Eye1Track,
	& #Eye2Track,
	& #MuzzleTrack,
	& #Ear1Track,
	& #Ear2Track {
		--x: clamp(0, var(--live-local-pointer-x-ratio, 0.5), 1);
		--y: clamp(0, var(--live-local-pointer-y-ratio, 0.5), 1);
	}

	& #Eyes,
	& #Muzzle {
		animation: none;
	}

	& #Eye1Track {
		translate: calc((var(--x) - 0.5) * 2 * 4px) calc((var(--y) - 0.5) * 2 * 7px);
	}
	& #Eye2Track {
		translate: calc((var(--x) - 0.5) * 2 * 6px) calc((var(--y) - 0.5) * 2 * 7px);
	}
	& #MuzzleTrack {
		translate: calc((var(--x) - 0.5) * 2 * 5px) calc((var(--y) - 0.5) * 2 * 7px);
	}
}
```

(transitions, the muzzle's foreshortening `scale`, and its extra downward push are trimmed from
that snippet for clarity — see the real file for the complete rule.)

### The Chrome bug behind the `*Track` wrappers

The tracking `translate`/`scale`/`rotate` above don't live on `#Eye1`/`#Eye2`/`#Ear1`/`#Ear2`/
`#Muzzle` themselves — each has its own plain wrapper `<g>` (`#Eye1Track`, `#Eye2Track`,
`#Ear1Track`, `#Ear2Track`, `#MuzzleTrack`) that carries nothing else, and the tracking values go
on the wrapper instead. This exists because of a real, confirmed Chrome bug, found the hard way:

An earlier version put the tracking `translate`/`scale` directly on `#Eye1`/`#Eye2` and the
tracking `rotate` directly on `#Ear1`/`#Ear2`. In every other browser, and in Chrome's own
devtools, that worked fine. On a real device with a real cursor, in Chrome specifically, it
didn't — the muzzle visibly tracked the cursor while the eyes and ears stayed completely frozen in
place, confirmed with a screen recording of real cursor movement (scaled-up frame grabs compared
side by side; the muzzle's swing was obvious, the eyes' and ears' motion was literally zero, not
just small). The confusing part: `getComputedStyle` reported the *correct* `translate`/`rotate`
value on the eyes and ears the whole time. The style system had the right answer — Chrome just
never repainted it. `getComputedStyle` and `getBoundingClientRect` both force a synchronous layout
flush as a side effect of being called, which happens to paper over the bug; testing this from the
devtools console instead of watching a real cursor move is exactly how the first attempt at a fix
missed the actual cause (see below).

The pattern, once all three elements were compared: `#Muzzle` was the only one of the three whose
own `animation` got fully turned off during tracking (`& #Eyes, & #Muzzle { animation: none }`,
still true today). `#Eye1`/`#Eye2` keep `logo-blink` running the whole time tracking is active
(deliberately — blinking shouldn't stop just because the cursor moved), and `#Ear1`/`#Ear2` keep
their twitch loop running too. Both of those are `animation`s targeting `transform`. Whenever an
element has a still-running keyframe `animation` targeting `transform` *and* a `transition` on an
independent transform property (`translate`/`scale`/`rotate`) at the same time, Chrome computes
the transition's value correctly but never repaints it — even though the CSS spec treats
`transform` and the standalone `translate`/`rotate`/`scale` properties as independent and
composable (which is true in Firefox and Safari, and true in Chrome too as far as computed style
goes — just not as far as painting goes). `#Muzzle`, with no animation running on it during
tracking, never hit this and always worked.

The fix is the wrapper split: put the tracking `translate`/`scale`/`rotate` on a separate element
from the one still running a `transform`-targeting `animation`. The animated leaf and the
transitioned wrapper compose visually exactly like `transform` and `translate`/`scale`/`rotate`
were always supposed to — they're just no longer the *same* element, which is what sidesteps
whatever Chrome's compositor is doing wrong here. No isolated repro was built and no upstream bug
was filed, so this is empirical, not fully understood — if a future refactor ever moves an idle
animation back onto the same element as a tracking transition, retest with an actual cursor
recording in Chrome, not just the devtools console.

(An earlier, wrong theory blamed `--x`/`--y` inheritance — `#Eye1`/`#Eye2` were reading a value
computed on their `#Eyes` parent, and giving each eye its own local `--x`/`--y` declaration seemed
like a plausible fix. It changed nothing. The `*Track` wrapper split is what actually worked.)

Every wrapper positions itself individually, each with its own horizontal rate — `--x`/`--y` are
clamped (more on that below) and declared separately on each wrapper, computing its own copy from
`--live-local-pointer-*`. Y stays shared across all three (7px, unstaggered) — only X differs:

- **Depth parallax.** `#Eye2Track` (right eye) moves horizontally fastest (6px), `#MuzzleTrack` at
  the baseline rate (5px), `#Eye1Track` (left eye) slowest (4px) — each a little quicker than the
  next, so the face reads as layers panning past at different rates rather than one rigid plane
  sliding as a block.
- **Y range deliberately much bigger than X's baseline** (7px vs. 5px, against a ~72px-tall mark).
  At an earlier, smaller Y amplitude this was under 5% of the logo's own height — "looking down"
  never actually read as the eyes moving, completely upstaged by the muzzle's own
  much-larger-percentage-wise squish below. The eyes' own movement is the primary "looking down"
  cue; the muzzle's extra push and foreshortening (next) are reinforcing detail on top of it, not
  the only visible signal.
- **Downcast squint.** `#Eye1Track`/`#Eye2Track` also narrow vertically the further down the glance
  goes — `scale: 1 calc(1 - max(0, --y - 0.5) * 0.3)`, the same downward-only `max(0, --y - 0.5)`
  guard as the muzzle's foreshortening below, riding on the standalone `scale` property so it
  composes with `#Eye1`/`#Eye2`'s own `transform: scaleY()` blink (a different element now, but
  the same visual composition — see the `translate`-vs-`transform` reasoning below) rather than
  fighting it.

`translate` (the standalone CSS property, not `transform: translate()`) is what makes per-element
rates possible without fighting anything else already animating those elements: `#Eye1`/`#Eye2`
keep blinking throughout tracking via their own `transform: scaleY()` (from the `logo-blink`
keyframes, untouched by any of this), and their wrapper's `translate` composes with that
`transform` visually since Individual Transform properties are independent of each other — the
same composition the Chrome bug above breaks when both live on one element, working correctly here
because they're on two.

**Clamped defensively, not just conceptually.** prop-for-that's `pointerLocal` doesn't clamp
`--live-local-pointer-x/y-ratio` to `[0, 1]` — confirmed by reading its source directly, it maths
raw `clientX`/`clientY` against the tracking element's rect with no cap. The last `pointermove`
right as the cursor exits the window can land slightly outside the viewport, so `--x`/`--y` clamp
every value before it reaches any `calc()` below — the muzzle can't overshoot past its
edge-of-screen extreme no matter what raw value comes through.

Two things make the container style query itself work without a `container-type` opt-in anywhere
or any hoisting inside `logo.css`:

- **Custom properties inherit downward.** `<body>` and `<html>` are both ancestors of
  `.logo-mark`, so `.logo-mark`'s descendants read `--live-local-pointer-*` and `--live-idle` for
  free, no matter which one actually carries each.
- **Every element is a valid `@container style()` container** — unlike size queries, style queries
  don't need `container-type` set on the ancestor. The query above matches because `<html>` is the
  _nearest ancestor_ actually carrying `--live-idle`.

`#MuzzleTrack`'s foreshortening — a downward-only extra push folded into its own `translate` (since
`translate` can only be declared once per element, this is combined with its baseline 5px rate
rather than layered as a separate declaration) plus a downward-only compress-and-widen `scale` —
both derived from the same `--y` driving its translate. Together they read as the muzzle tilting
away/under as it moves toward the bottom half of the screen, rather than just sliding down flat.
`max(0, --y - 0.5)` is what makes both downward-only: zero for the whole top half (no effect
looking up), ramping 0→0.5 across the bottom half. `transform-origin: 50% 0%` anchors the scale at
the muzzle's own top (nearest the eyes), so the compression reads as the tip tucking under while
the base stays put — anatomically the right cue, but on its own (without the bigger shared Y
amplitude, and without its own extra push) it just looked like the shape shrinking in place, not
heading toward the bottom of the head. The push (6px) and squish (widen 0.3, compress 0.68) were
tuned up from an earlier, subtler pass (4px/0.24/0.56) to sell "looking down" harder — 0.68 is
close to the ceiling before the compression starts reading as the muzzle inverting rather than
tucking under, at `--y`'s max of 1.

**Ear droop.** `#Ear1Track`/`#Ear2Track` pick up a downward-only-in-spirit (actually signed both
ways) `rotate` tied to the same `--y`: `calc((--y - 0.5) * -12deg)` on `#Ear1Track`,
`calc((--y - 0.5) * 12deg)` on `#Ear2Track` — looking down tips both ears forward, looking up
lifts them back, mirrored signs to match each ear's own idle-twitch keyframes' dominant first
step. This layers on top of, not instead of, each ear's ongoing `logo-ear-twitch-left`/`-right`
loop, which keeps running on the inner `#Ear1`/`#Ear2` throughout tracking (unlike `#Eyes`/
`#Muzzle`'s idle animation, never set to `none`) — `rotate`, on the separate wrapper, composes with
the inner group's `transform: rotate()` visually rather than clobbering it. The exact sign was
picked by matching each ear's own twitch direction, not by watching the artwork rotate — worth a
visual check if the ears ever look like they're lifting instead of drooping on the way down.

**`linear`, not `ease-out`, and 0.1s — while actively tracking.** These transitions get retargeted
on every `pointermove`, often faster than any one transition ever finishes. `ease-out` starts fast
and decelerates on _each_ leg, so retargeting it mid-flight repeatedly cuts that deceleration off
and restarts a fresh fast start — a string of velocity discontinuities that reads as choppy rather
than one continuous motion. `linear`'s constant velocity per leg blends far more smoothly across
repeated retargets. 0.1s prioritizes immediacy over smoothing — tight enough that the mark reads
as following the cursor directly rather than catching up to it a beat later. This transition is
declared *inside* the container query, so it only applies while `--live-idle: 0` — see the next
section for what takes over the instant that stops being true.

## Return to idle

The moment `--live-idle` flips to `1`, the container query above stops matching, and every
tracking value on the `*Track` wrappers reverts to its initial `none`. Left alone, that's an
instant snap — not what a bear "settling back into looking around on his own" should look like.
`logo.css` declares a second, slower transition on the same wrappers, *outside* the container
query:

```css
& #Eye1Track,
& #Eye2Track,
& #MuzzleTrack {
	transition:
		translate 0.4s ease-out,
		scale 0.4s ease-out;
}

& #Ear1Track,
& #Ear2Track {
	transition: rotate 0.4s ease-out;
}
```

Because this is declared before (outside) the container query, the query's own 0.1s-linear
transition overrides it the instant tracking is active, and this one is all that's left the
instant tracking stops — exactly the cascade order needed for "fast and precise while tracking,
slow and settling once it lets go." `ease-out`, not `linear`, and 0.4s instead of 0.1s: this
transition only ever plays once per tracking session (cursor leaves, motion settles, done), not
retargeted mid-flight over and over the way the tracking transition is, so a normal
decelerate-into-rest curve reads as a deliberate "putting the cursor down" beat rather than the
snap it'd be with `linear`.

`#MuzzleTrack` exists for this as much as for tracking itself — an earlier version of this file
didn't need a wrapper for the muzzle at all, since the muzzle's own `animation` was always fully
stopped during tracking and putting its `translate`/`scale` directly on `#Muzzle` never hit the
Chrome bug above. But *leaving* tracking resumes `#Muzzle`'s `logo-look-around` animation in the
exact same style recalc that reverts its tracking `translate`/`scale` back toward neutral — which
is the same animation-plus-transition-on-one-element shape that broke the eyes and ears while
entering tracking. So the muzzle needed the same wrapper split, just to make the *exit* safe rather
than the entry. Same fix, same reasoning, just triggered by the other edge of the transition this
time.

### What actually triggers it: `--live-idle`, not "cursor left the window"

An earlier version of this feature gated the whole container query on `--live-local-pointer-inside`
instead — the same property `pointer-local` already provides, flipping to `0` only when the cursor
physically crosses the browser window's edge. That shipped, and didn't visibly work: the trigger
condition was wrong, not the transition. `-inside` stays `1` for as long as the cursor is anywhere
in the window, including sitting perfectly still — which describes most "user stopped paying
attention" moments far better than "cursor left the window" does. Someone reads the page, or their
cursor just rests somewhere in the middle of it, and the bear would keep pointing at a stale
position indefinitely. It looked broken because, for that condition, it was.

The fix was a different signal entirely: a small custom `pointer-idle` source, registered in
`PropsForAuto.astro` via prop-for-that's own public `register()` API (there's no built-in plugin
for "how long since the pointer last moved," and CSS has no primitive for "time since a value last
changed," so this is the smallest amount of custom JS that still routes through the same batched
writer as everything else here — see that file for the full source and reasoning). It debounces
`pointermove` with a 3s `setTimeout` and writes `--live-idle` (1/0) onto `<html>`: `1` on page load
and again 3s after the last `pointermove` anywhere on the page, `0` the instant one arrives.
`--live-local-pointer-inside` is no longer read by `logo.css` at all — as a side effect, the new
signal already covers the window-leave case too, since no more `pointermove` events arrive once the
cursor leaves, so the same 3s timer fires on its own (just with up to 3s of lag on that specific
case, an acceptable trade for a decorative idle state).

**Reusing this for something else:** any future feature that wants "where's the cursor, roughly"
can read the same `--live-local-pointer-*` properties directly — no need to stand up another
tracking element. The same goes for `--live-idle` if something else wants "has the reader gone
idle" specifically. For a different kind of runtime state entirely (viewport size, battery, network,
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
