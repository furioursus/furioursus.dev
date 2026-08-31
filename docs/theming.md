# Theming

Dark/light mode plus the design tokens both themes draw from.

## Design tokens

Defined once in `src/styles/global.css` as CSS custom properties, registered via `@property` (so
Tailwind can animate them) and given light-mode values under `@theme`:

```css
--color-global-bg / --color-global-text / --color-muted / --color-link / --color-accent
--color-accent-2 / --color-quote
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

### Ambient grain texture

`body::after` in `global.css` is a fixed, full-viewport, `pointer-events: none` overlay that gives
the whole site a quiet photocopy-grain tooth — one of the two texture "roles" from the queer-punk
direction above (the other, riso color-misregistration on specific elements like a logo or
pull-quote, is a deliberately separate, not-yet-built "moments" treatment — see the
[[furioursus-dev-color-texture-redesign]] memory for that split and why it's two techniques, not
one).

Two theme-swapped tokens drive it, same pattern as the color tokens: `--grain-image` and
`--grain-blend`, set on `html` and overridden under `&[data-theme="dark"]`. Light mode uses
`src/assets/images/grain-light.webp` (dark ink marks on a mostly-light ground) with
`mix-blend-mode: multiply`, which treats light pixels as a no-op and only darkens where there's
ink. Dark mode swaps to `grain-dark.webp` — the same texture with colors inverted — and
`mix-blend-mode: screen` instead: multiplying an already-near-black background does nothing
visible, so the blend mode has to flip along with the asset, not just the color. Both assets are
cropped/downscaled (700×354, ~36KB each as lossy WebP) from a much larger source photocopy-texture
export — noise compresses poorly, so this is well short of the raw file size, and the crop doesn't
need to be a hand-matched seamless tile: at the ~0.06 opacity this actually ships at, an imperfect
seam in fine grain doesn't read as one. (It's a different story at higher opacity — tested at 100%
during development and a broad-scale banding pattern in the source texture did tile into a visible
vertical stripe; it disappears well below that, which is why the opacity is where it is.)

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
