# OG images

Every post gets a generated `og:image`/Twitter card — a 1200×630 PNG with the title and date,
rendered at build time — unless the post's frontmatter opts out with its own `ogImage`.

## How generation works — `src/pages/og-image/`

- **`[...slug].png.ts`** — a static endpoint (`getStaticPaths` over every post _without_ an
  `ogImage` in frontmatter, via `getAllPosts()`). For each, renders SVG with
  [Satori](https://github.com/vercel/satori) using `ogMarkup()` from `_ogMarkup.ts`, rasterizes it
  to PNG with `sharp`, and serves it with a one-year immutable `Cache-Control` header.
- **`_ogMarkup.ts`** — the actual layout/markup (title, formatted date) that Satori renders. Uses
  [`satori-html`](https://github.com/natemoo-re/satori-html) so it can be written as an HTML
  template string rather than Satori's native React-element-shaped input. Edit this file to change
  what the card looks like.
- **`_cacheUtil.ts`** — file-based cache under `node_modules/.astro/og-images` (Astro's `cacheDir`),
  keyed by a hash of `title + publishDate`. **Bump `CACHE_VERSION` in this file whenever you change
  the markup, fonts, or Satori options** — the cache key doesn't account for those, only for the
  post's own content, so a stale cached image would otherwise survive a design change indefinitely.
- Fonts: `Roboto Mono` regular + bold, bundled from `src/assets/fonts/`. Satori needs real font
  files (it doesn't use the browser/OS font stack), so a new font means adding a `.ttf` and wiring
  it into `ogOptions.fonts` in `[...slug].png.ts`.

## Opting a post out

Set `ogImage` in a post's frontmatter to a path/URL, and generation is skipped entirely for that
post (`getStaticPaths` filters it out up front) — `BlogPost.astro` falls back to
`/og-image/${post.id}.png` only when the field is absent.

## A note on the `satori-html`/Satori type mismatch

`ogMarkup()`'s return type is cast (`as Parameters<typeof satori>[0]`) in `[...slug].png.ts` —
`satori-html`'s `VNode` type stops structurally matching Satori's declared React-element param type
whenever a real `@types/react` ends up in the dependency graph (currently pulled in transitively by
`decap-cms-app`, unrelated to OG images). The cast is safe; it's a types-only mismatch, not a
runtime one — documented inline as a comment where the cast happens.
