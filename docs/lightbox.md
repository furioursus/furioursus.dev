# Lightbox

Click, Enter, or Space on an image to see it enlarged in a modal. Two ways to get it, sharing one
CSS file and one piece of behavior:

1. **Automatic** — every image in a markdown post/note body gets it for free, no markup needed.
2. **Explicit (`LightboxImage.astro`)** — for `.astro` pages or `.mdx` posts that want per-image
   control (crop shape, thumbnail size) beyond the automatic default.

## How it's built

Three pieces:

- **`src/plugins/satteri.ts`** (`satteriLightboxImagesPlugin`) — a hast transform, registered in
  `astro.config.ts`'s `hastPlugins`, that wraps every `<img>` produced by the markdown renderer:

  ```html
  <lightbox-image class="not-prose lightbox">
  	<button type="button" class="lightbox-trigger" aria-haspopup="dialog">
  		<img ... />
  	</button>
  	<dialog class="lightbox-dialog">
  		<button class="lightbox-close" aria-label="Close image"></button>
  	</dialog>
  </lightbox-image>
  ```

  This runs on the _rendered_ image, after Astro's own asset-optimization step has already resolved
  `src`/`srcset`/`width`/`height` — wrapping it doesn't interfere with that (Astro resolves images
  via a string-replace pass keyed on a marker attribute, matched anywhere in the HTML regardless of
  surrounding markup).

- **`src/components/Lightbox.astro`** — script-only, no markup of its own. Defines and registers
  the `<lightbox-image>` custom element:

  ```js
  customElements.define("lightbox-image", class extends HTMLElement { connectedCallback() { ... } });
  ```

  Included once, globally, in `src/layouts/Base.astro` (alongside `ThemeProvider`) — so it's live on
  every page regardless of which of the two paths above produced the markup.

  Behavior on `connectedCallback`: find the trigger button, dialog, close button, and image inside
  `this`; clicking the trigger **moves** (not clones) the `<img>` node into the `<dialog>` and calls
  `showModal()` — same element, same already-loaded `src`/`srcset`, zero extra network request.
  Closing (Escape, the close button, or a backdrop click) all funnel through the dialog's native
  `close` event, which moves the image back to the trigger and restores focus.

  Exception: if the dialog already contains its own `<img>` when the element connects, that move
  step is skipped entirely — see the `fit="cover"` + `width`/`height` note below. This happens when
  the trigger's thumbnail is a genuine crop (a different file, not just a different CSS
  `object-fit`), so there's nothing to usefully move; the dialog's own separately-rendered,
  uncropped image just shows/hides with the dialog as normal.

- **`src/styles/components/lightbox.css`** — imported in `global.css`. The thumbnail's crop/size is
  driven by CSS custom properties with defaults, so both usage paths read the same rules:

  ```css
  .lightbox-trigger img {
  	width: var(--lightbox-thumb-width, auto);
  	max-height: var(--lightbox-thumb-max-h, 24rem);
  	aspect-ratio: var(--lightbox-thumb-aspect, auto);
  	object-fit: var(--lightbox-thumb-fit, contain);
  }
  ```

  The dialog's enlarged view is fixed (not customizable per-instance): capped at `90vh`/`90vw`,
  and the `<dialog>` itself sizes as `width/height: fit-content` so its box hugs the image rather
  than sitting at a fixed 90vh/90vw regardless of the photo's shape.

  Three rules here are load-bearing, all found the hard way — if the enlarged image is ever visibly
  distorted, or the close button drifts away from a corner it should be sitting on, this block is
  the first place to check:
  - **`object-fit: contain`** — without it, `max-width`+`max-height` clamp width and height
    independently and the image visibly stretches.
  - **`width: auto; height: auto`** — without an _explicit_ value here, the browser falls back to
    the image's own `width`/`height` HTML attributes (real declared values, from Astro's asset
    optimization) instead of computing a ratio-preserving box from the `max-width`/`max-height`
    caps. The visible pixels still render undistorted (that's what `object-fit: contain` buys you),
    but the `<img>` element's own _layout box_ ends up sized to the `max-width`×`max-height`
    rectangle rather than the photo's real aspect ratio — which is invisible on its own, but
    cascades into two symptoms once other things anchor to that box: the `<dialog>` (which
    shrink-wraps to it) ends up oversized too, stranding the close button (anchored to the dialog's
    corner) far from the visible photo, and clicks in the resulting gap between the visible photo
    and the oversized box land on the `<img>` itself rather than the backdrop, so
    click-outside-to-close silently fails for clicks in that gap. Forcing both axes to `auto`
    removes the competing declared value and lets the ratio-preserving algorithm apply.
  - **`.lightbox-caption { width: 0; min-width: 100% }`** — the same "box drifts wider than the
    photo" symptom recurs with a long caption if this isn't here: a caption `<p>`'s own preferred
    (unwrapped) text width would otherwise count toward `.lightbox-dialog`'s `fit-content` sizing
    (or the trigger's `inline-block` sizing, on the thumbnail side) and can drag the whole box wider
    than the image once the caption text is long enough. `width: 0` removes the caption from that
    shrink-to-fit calculation entirely, so only the image determines the box's width; `min-width:
100%` then snaps the caption back to fill (and wrap within) that width once it's settled. Short
    captions won't expose this — it only shows up once a caption's unwrapped length exceeds the
    image's own rendered width.

### Open/close animation

`.lightbox-dialog` bounces open and fades closed via native `<dialog>` + `@starting-style` — no
JS, `Lightbox.astro`'s script is unchanged. `showModal()`/`close()` toggle the `open` attribute;
the CSS transitions off that. Open uses an overshoot `cubic-bezier(0.34, 1.56, 0.64, 1)` for the
bounce; close stays a plain quick ease so it doesn't wobble on the way out. `prefers-reduced-motion:
reduce` disables both.

- **`transition-behavior: allow-discrete` on `overlay`/`display`** is load-bearing for the close
  half specifically. Both properties are normally discrete — they can't animate, they just snap.
  Without `allow-discrete`, the UA's `display: none` (applied the instant `.close()` runs) removes
  the dialog before the opacity/transform transition gets a chance to play at all, so closing looks
  instant no matter what the `transition` line says.
- **`@starting-style { &[open] { ... } }`** supplies the "from" state for the *opening* animation.
  Without it there's no starting point to transition from, so the dialog would just appear at its
  final opacity/scale — same instant-snap symptom, but on open instead of close.
- Unsupported browsers (`@starting-style`/`allow-discrete` need a roughly 2024-or-later engine) fall
  back to the old instant show/hide — this is pure progressive enhancement, nothing to guard in JS.

## Using it explicitly — `LightboxImage.astro`

```astro
---
import LightboxImage from "@/components/LightboxImage.astro";
import photo from "./photo.jpg";
---

<LightboxImage src={photo} alt="..." />

<!-- true square crop instead of the default shrink-and-letterbox -->
<LightboxImage
	src={photo}
	alt="..."
	fit="cover"
	thumbWidth="12rem"
	thumbHeight="12rem"
	aspectRatio="1/1"
/>
```

| Prop                         | Default          | Notes                                                           |
| ---------------------------- | ---------------- | --------------------------------------------------------------- |
| `src`                        | —                | required, an imported `ImageMetadata` (not a plain string path) |
| `alt`                        | —                | required                                                        |
| `fit`                        | `"contain"`      | `"cover"` for a true crop instead of a shrink                   |
| `thumbHeight` / `thumbWidth` | `24rem` / `auto` | any CSS length                                                  |
| `aspectRatio`                | `auto`           | e.g. `"1/1"`, `"4/3"` — pairs with `fit="cover"`                |
| `caption`                    | none             | `true` shows `alt`; a string shows that instead; see below      |
| `width` / `height`           | inferred         | pass both for a sized responsive srcset — see below             |
| `priority`                   | `false`          | forwarded to `Image` — set for an above-the-fold usage          |
| `class`                      | —                | extra classes on the outer `<lightbox-image>`                   |

Unset props fall through to `lightbox.css`'s defaults, so `<LightboxImage src={x} alt="y" />` alone
renders identically to what the automatic transform would have produced. The enlarged dialog view is
always the full, uncropped photo regardless of the thumbnail's `fit` — the crop only ever affects the
small on-page box.

By default the underlying `astro:assets Image` gets no `width`/`height`, so it infers the source's
natural size — fine for a body photo shrunk down with CSS. For a large, prominent usage where the
_displayed_ size is much smaller than the source's full resolution, pass `width`+`height` matching
the intended display size to get an appropriately-sized `layout="constrained"` srcset instead of
shipping the full-resolution original just to crop it down with CSS — this is exactly what
`Masthead.astro`'s cover image does (see [content-model.md](./content-model.md)).

**When `fit="cover"` and `width`/`height` don't match the source's own aspect ratio, two separate
images get rendered, not one.** `layout="constrained"` with an explicit width/height doesn't just
apply `object-fit: cover` as a style — astro:assets actually generates the output file physically
cropped to those pixel dimensions (confirmed by inspecting the built `.webp` files directly; this
isn't documented behavior, just observed). The trigger and dialog normally share a single `<img>`,
moved back and forth by `Lightbox.astro` on open/close — but there's no way to "un-crop" a file that
was never generated with the missing pixels in the first place. So when the component detects a real
crop is happening (comparing `src.width`/`src.height` against the requested ratio), the dialog gets
its own second `<Image>` instead — same source, no forced dimensions, capped at a sensible max width
(1600px) rather than the source's full resolution. `Lightbox.astro` checks for this at connect time
(`dialog.querySelector("img")` already present) and leaves it alone rather than trying to move the
trigger's cropped image into it. This is exactly what `Masthead.astro`'s cover image needs — a
16:9-cropped thumbnail, but click-to-enlarge shows the full photo.

Only usable in `.astro`/`.mdx` — this repo's actual blog posts are plain `.md` (Content Collections'
`glob()` loader picks up both, but MDX component imports only work inside `.mdx` files). The
automatic transform exists specifically so plain `.md` posts don't need converting just to get a
lightbox.

## Captions

Both usage paths can show a caption below the image (both under the thumbnail and, again, under
the enlarged photo in the dialog — it's a second static `.lightbox-caption` element in the dialog's
markup, not the same node moved back and forth):

- **`LightboxImage.astro`** — the `caption` prop, above: `true` for `alt`, a string for custom text,
  omitted for none.
- **Automatic transform** — markdown's image title syntax, `![alt](src "caption text")`. The
  `title` attribute is otherwise unused here, so its presence doubles as the per-image opt-in;
  there's no equivalent to `caption={true}` for the automatic path — `alt` is required on every
  image already, so falling back to it as a default caption would force one onto every image rather
  than keeping it optional. Write a title when you want a caption, omit it when you don't.
- **Cover images** — same `true`/string/omitted pattern as `LightboxImage.astro`, via
  `coverImage.caption` in frontmatter. See [content-model.md](./content-model.md).

Styling is one shared rule, `.lightbox-caption` in `lightbox.css` — used by all three call sites.

When the image is moved into the dialog on open (see above), it's inserted with `insertBefore`
targeting the dialog's own caption element specifically, not `appendChild` — otherwise the
already-present caption (a dialog child from the start, unlike the image) would end up ordered
before the image once it arrived, rendering above the photo instead of below it.

## Known limitation

If an image sits inline mid-sentence (not on its own line), the automatic transform still wraps it,
but `<dialog>` isn't valid _phrasing_ content inside a `<p>` per the HTML spec — browsers will
silently close the paragraph early around it. Not an issue for images on their own line (the common
case, and what `satteriUnwrapImagesPlugin` produces for a lone image in a paragraph), but worth
knowing if a genuinely inline image shows up somewhere.
