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

It sits at `z-index: -1`, behind all page content, blending only with `body`'s own flat
background color rather than with whatever text/images happen to be on screen — it shows through the
gaps (margins, padding, any exposed page background) instead of crawling visibly across content as
the page scrolls. This requires `isolate` on `<body>` (`Base.astro`) so the negative z-index stays
contained to body's own stacking context instead of escaping behind `<html>` entirely. An earlier
version painted this _above_ content at `z-index: 100` to clear other components' own stacking
z-indexes (Header's nav dropdown `z-50`, BlogPost's back-to-top button `z-90`) — that's no longer
relevant now that the layer is behind everything, not competing to be on top of it.

#### Why `position: fixed` with an explicit `100lvh`

Two earlier versions failed in opposite directions, and the sizing is what reconciles them.

**Version 1 — `position: fixed` with a negative `inset` overscan.** On a real device (iPhone 17 sim,
iOS 26.5) it failed to reach the true bottom edge on short pages, confirmed by swapping in a plain
`body` background with no positioning tricks, which _did_ reach the edge reliably. A bare `inset`
sizes the element against whatever Safari currently calls the viewport, and that _shrinks_ while the
dynamic toolbar is expanded; fixed elements have a documented history of not keeping pace with that
toolbar's show/hide animation in real time.

**Version 2 — `position: absolute; inset: 0`.** Anchoring to `body`'s own box fixed coverage by not
depending on the viewport at all, but it makes the element **document-tall**, so `background-size:
cover` has to cover the entire page height. On a long post that scales the image up enormously and
crops it to a narrow slice — uniform upscale, not distortion, but the visible result is soft cloudy
mush instead of sharp toner grain. `background-attachment: fixed` was meant to rescue that by sizing
the image against the viewport instead, and it does on desktop, but **iOS Safari has never reliably
supported it**. Verified on the simulator by swapping the image for a hard-striped repeating
gradient: after a swipe that moved content ~958px the stripes had moved ~220px, so the layer was
neither pinned (0) nor scrolling with the page.

**Current — `position: fixed` sized `height: 100lvh`.** `lvh` is the _large_ viewport height: the
viewport with the dynamic toolbar retracted, the largest it can ever be, and a value that **does not
change** as the toolbar shows and hides (`dvh` is the live one that jitters; `svh` is the smallest).
Sizing to the maximum means the element can never come up short the way version 1 did — while the
toolbar is expanded it simply overflows behind it, harmlessly. And because the element is one screen
tall rather than document-tall, `cover` only ever covers one screen, so version 2's upscaling is gone
with no dependence on `background-attachment` at all. That property is removed entirely.

Verified on device after the change: with stripes armed, they sat at screenshot-y ≈ 155 / 520 / 885 /
1250 / 1615 before a swipe and at exactly the same positions after, while content moved ~1650px —
zero drift. A short page's bottom edge with the toolbar collapsed is covered cleanly.

Two gotchas worth keeping in mind:

- **`left`/`right` insets, not `width: 100lvw`.** Viewport _width_ units ignore the scrollbar, and
  `scrollbar-gutter: stable` on `html` guarantees there is one, so `100lvw` overhangs by the
  scrollbar's width on desktop. Insets resolve against the viewport's real content box.
- **Nothing in the ancestor chain may create a containing block for `fixed`.** A `transform`,
  `filter`, `backdrop-filter`, `perspective`, `contain`, or `will-change` on `html` or `body` would
  silently re-anchor this layer to that element and put you straight back to the version 2 behaviour.
  Both are currently clean; check before adding any of them.

Keeping `cover` on one large photo-scale texture (rather than the small repeating tile this went
through for a while) is worth the bandwidth cost below: a small seamless-tile crop has to crop _away_
any visible directional structure — this texture's source has real toner-drag banding — to avoid an
obvious repeat, where a full photo-scale image keeps it.

Bringing `cover` back reintroduces the bandwidth problem a small tile didn't have: shipping the same
full-res image to a 380px phone as to a 2560px desktop is real waste on mobile. Two width tiers
(`grain-{960w,1600w}.webp`),
swapped by plain `min-width` media queries (not a Tailwind variant — this file isn't a component
Tailwind processes) at Tailwind's own `sm`/`lg` breakpoints, handle that: under 40rem gets 960w,
40rem and up gets 1600w.

There used to be a third tier serving the full-res master `grain-master.webp` (1920w, 1058 KB) above
64rem. Measured, it was **88% of a desktop page load on its own** — every other asset on the site
combined came to 138 KB — and it cost 1.87x more per pixel than any other tier. Re-encoding confirmed
quality can't recover that (grain is incompressible noise; even q=60 still cost 863 KB), so
resolution was the only lever. Deleting the tier lets 40rem-and-up upscale the 1600w file instead:
**252 KB instead of 1058 KB, an 806 KB saving per desktop page view**, and invisible on a noise
texture rendered at `opacity: 0.25` behind all content. Note the breakpoint was `64rem` = 1024px, so
this was hitting every laptop, not just large displays. The full-res files stay in `src/assets/` as
the masters the tiers are generated from; nothing references them, so they no longer ship.

The 1600w tier was later re-encoded and re-cropped to **1600x900** (from 1600x1131), taking it from
394 KB to 252 KB. The crop is vertical — same texture, less of it — so the toner-drag structure the
`cover` approach exists to preserve is untouched; verified at 6x contrast against the previous
encode, with no banding or blocking introduced.

The side effect is that this tier is now 16:9 while the others stay ~1.41:1, and `cover` upscales
against whichever axis is short. On ordinary landscape windows that is a wash (1.05x vs 0.94x at
1512x945; identical at 1920x1080), but a tall desktop window upscales it further than before —
1.33x at 1000x1200, 1.56x at 800x1400, against 1.06x and 1.24x for the old canvas. The grain reads
slightly coarser there. Accepted: it is noise at `opacity: 0.125`-`0.25`, and tall-and-narrow desktop
windows are rare. Worth knowing before re-cropping any tier further.

Under 40rem also gets an
`orientation: portrait` variant (`grain-portrait.webp`), cropped and rotated from the
source rather than downscaled — for `cover`-fit, a portrait viewport's dominant dimension is height,
not width, so the landscape 960w crop doesn't have enough height to cover a tall phone screen
without upscaling. Scoped to under 40rem only; portrait tablets/laptops above that still get the
landscape tiers, an accepted gap since portrait is overwhelmingly a phone thing.

`<html>` also carries its own `background-color: var(--color-global-bg)` now, matching whichever
theme is active — without the old `fixed` layer's generous overscan margin, iOS Safari's
rubber-band bounce past the very top/bottom of the page would otherwise reveal a stark white flash
(the browser's default canvas color) in that sliver rather than the correct flat theme color. The
grain texture itself doesn't extend into that sliver either way — it's pinned to the viewport, and
bounce scrolls past `body`'s actual edges entirely — so this is only ever a flat color there, never
textured.

#### The edge fade, pinned to the chrome

Matching the color isn't quite enough on its own, because the texture tints whatever it covers
slightly off that flat token: lighter under `screen` in dark mode, darker under `multiply` in light.
So an abrupt edge reads as a tonal seam against the untinted flat color beyond it.

The texture layer carries a `mask-image` that ramps its own alpha to zero over the first and last
`--grain-edge-fade` of its box. Because the element is `position: fixed`, that box _is_ the viewport
— so the texture dissolves toward the device's chrome (status bar at the top, dynamic toolbar and
home indicator at the bottom) at **every** scroll position:

```css
--grain-edge-fade: 6rem;

/* phone-shaped viewports only: short axis <= 30rem */
@media (max-width: 30rem), (max-height: 30rem) {
	--grain-fade-axis: to bottom;
	mask-image: linear-gradient(
		var(--grain-fade-axis),
		transparent 0,
		#000 var(--grain-edge-fade),
		#000 calc(100% - var(--grain-edge-fade)),
		transparent 100%
	);

	@media (orientation: landscape) {
		--grain-fade-axis: to right;
	}
}
```

Worth knowing:

- **The fade axis follows the viewport's long side**, and that's a bug fix, not only a look. Top/
  bottom in portrait, left/right in landscape. A flat `6rem` ramp at each end is ~22% of an
  874pt-tall portrait viewport — but the same two ramps are **49%** of a 390pt-tall landscape one,
  so rotating a phone used to leave half the screen faded out. Fading along whichever axis is longer
  holds it at ~22% in both orientations, because the faded axis is by definition the larger
  dimension. It also tracks where the chrome actually is: status bar and toolbar in portrait, notch
  and home indicator rotated to the left/right edges in landscape.
- **A custom property carries the direction**, rather than restating the whole gradient under the
  media query. `linear-gradient()` takes its direction as a plain token, so one substituted property
  is the entire orientation switch and the stop positions stay defined once. Physical directions
  (`to bottom`/`to right`), not logical ones — this frames the device's own edges, which don't
  reorder with writing mode.
- **Only the mask axis swaps.** The `--grain-image` tiers already handle orientation separately and
  correctly: a landscape phone is wider than 40rem, so it picks up the landscape 1600w source rather
  than the portrait crop, which is what `cover` wants for a wide-and-short box.
- **The fade is scoped to phone-shaped viewports.** `(max-width: 30rem), (max-height: 30rem)` — two
  queries in an `or` — is exactly "the viewport's _short_ axis is at most 30rem", since the only way
  neither matches is both dimensions exceeding it. 30rem (480px) clears the widest phones (the
  simulator's iPhone 17 Pro measures 402pt across; the Pro Max / large-Android class runs to roughly
  440–450pt) while sitting well under the narrowest tablet in portrait (iPad mini at 744pt).
  Verified at 402×874, 874×402, 744×1133 and 1000×700: mask present and vertical, present and
  horizontal, absent, absent.
- **Only the fade is gated — the texture is not.** Desktop and tablets still get the `position:
fixed` / `100lvh` layer and the float effect; they just get no mask. The seam the fade fixes is an
  iOS rubber-band artifact, and a ramp wide enough to register on a phone is only a dimmed band on a
  large display. One consequence worth knowing: macOS browsers do have their own mild rubber-band, so
  the tonal seam can still appear there briefly. That's accepted rather than unnoticed.
- **Viewport-anchored, not document-anchored — and that collapsed the design.** An intermediate
  version put the fade on a separate absolutely-positioned `body::before`, because a mask on a
  _document-tall_ texture layer is what puts the fade at the page's true ends. Once the texture
  became `position: fixed`, that mismatch was the only thing justifying a second element. Both are
  pinned to the viewport now, so the fade is just a mask on the same element again and
  `body::before` is gone — along with the z-index ordering that two sibling pseudo-elements needed
  between them.
- **It handles iOS rubber-band without any overscan.** A fixed element isn't truly pinned during the
  bounce — it drifts with the page — but the texture nearest the screen's edges is already faded
  out, so whatever the bounce reveals has nothing sharply-edged to sit against. This is what
  replaced the old negative-`inset` overscan.
- **A flat `6rem`, not the old `min(6rem, 10%)`.** That guard existed so a short page (a `min-h-dvh`
  view with little content) wouldn't spend most of its height fading. The element is now always
  exactly one viewport tall, so page length can't shrink it and the guard protects nothing.
- **The mask creates a stacking context, harmlessly.** `mix-blend-mode` still blends the masked
  result against its backdrop, and `opacity` already made it a stacking context anyway. No
  `-webkit-` twin is authored either; Safari has shipped unprefixed `mask-image` since 15.4 — the
  same baseline `100lvh` already requires. Don't hand-add one: lightningcss emits a `-webkit-`
  twin into the built CSS on its own, per browserslist.
- It fades the **texture**, not `html`'s color. Fading `html` toward the grain's average instead
  would mean tracking an average that changes per theme, per breakpoint image, and per blend mode.

The trade-off to be aware of: the texture is permanently a little weaker near the top and bottom of
the screen, which reads as a mild vignette. That's the intended look — the texture framing the
chrome rather than butting against it — but it does mean the layer is no longer uniform edge to edge.

Any opaque surface sitting above that `-1` layer hides it completely, though — a solid-background
element just paints over it. That used to matter for `Header.astro`: an earlier version made the
whole header `position: sticky`, which needed real machinery to avoid reading as a flat slab dropped
over a grainy page — a transparent-until-scrolled background cross-faded in via an
`IntersectionObserver`, plus a `mask-image` fade at its bottom edge so scrolled content dissolved
into it instead of hitting a hard line (`.header-surface`/`.is-stuck`, both since removed — see
[Navigation](./navigation.md) for why the header went back to `position: static`). With nothing in
the header sticky anymore, none of that applies: it scrolls away with the rest of the page like any
other content, so it never needs to reason about the grain layer at all — whatever's behind it is
just whatever's behind it.

Tokens drive the texture, same pattern as the color tokens: `--grain-image`, `--grain-filter`,
`--grain-blend` and `--grain-opacity`, set on `html` and overridden under `&[data-theme="dark"]`.
Light mode uses the asset as authored (dark ink marks on a mostly-light ground) with
`mix-blend-mode: multiply`, which treats light pixels as a no-op and only darkens where there's ink.
Dark mode applies `filter: invert(1)` to that same file and switches to `mix-blend-mode: screen`:
multiplying an already-near-black background does nothing visible, so the blend has to flip along
with the polarity.

**There used to be a second, parallel set of assets** — `grain-dark-960w.webp` and friends — rather
than a filter. Compared pixel for pixel, each dark file was exactly its light counterpart inverted:
mean absolute delta of 2.8-5.3 out of 255 (consistent with two independent lossy encodes of one
master, not a different image), with mean levels landing as complements (210.5 and 44.9, summing to
255.4). Three files, earning nothing. Note the saving is **repo size and maintenance, not bandwidth**
— a visitor only ever downloaded one polarity anyway.

FOOTGUN: `filter` makes an element a containing block for absolutely positioned descendants, the
same trap called out in `Header.astro`. The grain layer has no children, so it is fine today; nest
anything inside it and check that before anything else.

### Density switching was measured and rejected

Collapsing to one asset makes the image source theme-independent, which in principle unlocks
`image-set()` (or `srcset` on a real `<img>`) for resolution switching. Both were measured, and
neither is worth shipping for **this** kind of image:

- **Format switching is dead.** AVIF is larger than WebP here at every quality: 254 KB at `q=50`
  against WebP's 252 KB, rising to 426 KB at `q=80`. AVIF's advantage is smooth gradients, and this
  is maximum-entropy speckle. The same reason `q=60` on the old 1920w tier still cost 863 KB.
- **Density switching destroys the texture.** Offering a half-size file to 1x displays saves ~150 KB
  (800x450 at `q=70` is 100 KB against 252 KB), but downscaling _averages the noise away_, and
  upscaling in the browser cannot recover it. Rendered at the size a 1x display would actually show,
  most of the fine speckle is simply gone — and the fine speckle is the entire reason this is one
  large `cover` image rather than the small repeating tile it used to be.

Note that downscaling also makes the grain _more_ expensive per pixel, not less: 0.286 bytes/px at
800x450 against 0.179 at 1600x900. Averaging concentrates the entropy.

The general rule this is a case of: responsive images assume detail is redundant at lower
resolutions. For a texture whose entire value **is** its high-frequency detail, that assumption is
inverted, and every resampling strategy is a loss. Resolution tiers work here only because each one
is generated from the full-res master independently, not resampled from the tier above.

The alpha has to flip too, and not symmetrically: light sits at `0.25`, dark at `0.125`. A single
shared value doesn't serve both — tuned low enough for dark, the tooth was too faint to read in
light; tuned up until light read properly, dark looked blown out. Light speckles on a near-black
ground are simply more visually assertive than dark speckles on a near-white one. The ratio is
empirical, set by eye rather than derived.

`--grain-opacity` is deliberately a **token rather than a nested `body::after { opacity }` override**
in the dark block. The override does work — nested under `html[data-theme="dark"]` it resolves to a
descendant selector that outranks the standalone `body::after` on specificity — but it puts a
higher-specificity rule ~120 lines above the lower-specificity one it beats, which biome flags as
`noDescendingSpecificity`. A custom property has no specificity interaction at all, and it keeps all
three theme knobs declared together instead of splitting one of them off into a distant rule.

One gotcha if you tune any of these: **Vite's CSS hot-update in dev is not reliable for this file.**
Observed with a nested rule, where an edit appeared to do nothing while the browser kept serving the
old stylesheet — long enough to look like a broken selector rather than a stale cache. Hard-reload
before concluding a change didn't take, and don't rewrite CSS on the strength of a hot-reloaded
measurement.

Regenerate any tier from a new source with the `sharp` package already in devDependencies (no CLI
tool needed) — e.g. the 960w tier: `sharp(src).resize({ width: 960 }).webp({ quality: 45, effort: 6
}).toFile(out)`, or the portrait tier: `sharp(src).rotate(90).resize(640, 960, { fit: "cover"
}).webp(...)`. Quality 45 was chosen because the noise in this texture compresses poorly regardless
of quality — file size barely moves between quality 30 and 65 in testing, so there's little to gain
by going higher.

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
