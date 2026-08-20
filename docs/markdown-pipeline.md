# Markdown pipeline

Posts and notes are rendered by [`@astrojs/markdown-satteri`](https://github.com/withastro/astro/tree/main/packages/markdown-satteri),
a Rust/WASM-backed markdown processor — Astro's alternative to the default remark/rehype pipeline.
It's configured once, globally, in `astro.config.ts`'s `markdown.processor` option, and applies to
_every_ markdown/MDX file in the site (blog, notes, and tag overrides alike).

Custom behavior is added via two plugin lists, both passed to `satteri()`:

```ts
processor: satteri({
  features: { directive: true }, // enables ::: and :: custom directive syntax
  mdastPlugins: [ /* operate on the markdown AST, before HTML conversion */ ],
  hastPlugins:  [ /* operate on the HTML AST, after HTML conversion */ ],
}),
```

All the custom plugins live in `src/plugins/`. Internal plugin `name`s use a `site-*` prefix (see
[README.md](./README.md#conventions-worth-knowing-before-you-edit-any-of-the-above)).

## `src/plugins/satteri.ts` — small, focused hast/mdast transforms

| Plugin                          | Level | What it does                                                                                                                                                                                                        |
| ------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `satteriUnwrapImagesPlugin`     | mdast | A paragraph containing _only_ an image gets unwrapped to a bare image node, so it doesn't render inside a `<p>` (avoids invalid/awkward nesting for block-level image treatments like admonitions or the lightbox). |
| `satteriReadingTimePlugin`      | mdast | Computes reading time for the whole document, exposes it as `remarkPluginFrontmatter.readingTime` — consumed in `BlogPost.astro` and shown in `Masthead.astro`.                                                     |
| `satteriAutolinkHeadingsPlugin` | hast  | Wraps `h1`–`h6` content in a same-page `<a href="#id">`, so headings are shareable/clickable — the `#` prefix on hover comes from `tailwind.config.ts`'s typography override.                                       |
| `satteriFootnoteLabelPlugin`    | hast  | Strips the default "Footnotes" `<h2>` styling so it doesn't look like a normal section heading.                                                                                                                     |
| `satteriExternalLinksPlugin`    | hast  | Any link resolving to an `http(s)://` URL gets `target="_blank" rel="noreferrer noopener"` automatically — no need to remember it per link.                                                                         |
| `satteriLightboxImagesPlugin`   | hast  | Wraps every rendered `<img>` for click-to-enlarge. See [lightbox.md](./lightbox.md) — it's substantial enough to warrant its own doc.                                                                               |

## Custom directives (`features: { directive: true }`)

Two more plugins add [remark-directive](https://github.com/remarkjs/remark-directive)-style
`:::name` / `::name{...}` syntax, each in its own file:

- **`src/plugins/admonitions.ts`** (`satteriAdmonitionsPlugin`) — container directives:

  ```md
  :::tip
  Optional custom title works too — first paragraph becomes the title.
  :::
  ```

  Supported types: `tip`, `note`, `important`, `caution`, `warning` (see `AdmonitionType` in
  `src/types.ts`). Styling — colors, icons — lives in `src/styles/components/admonition.css`, one
  `[data-admonition-type="..."]` block per type. An unrecognized container directive name (`:::foo`)
  still renders — as a plain `<div>`, styling dropped — rather than erroring, so a typo doesn't
  break the build.

- **`src/plugins/github-cards.ts`** (`satteriGithubCardPlugin`) — leaf directive:
  ```md
  ::github{repo="chrismwilliams/astro-theme-cactus"}
  ::github{user="someone"}
  ```
  Renders a placeholder card, then an inline `<script>` fetches `api.github.com` client-side (no
  API token, so it's subject to GitHub's unauthenticated rate limit) and fills in
  stars/forks/license/description or follower/repo counts. Styling in
  `src/styles/components/github-card.css`.

Both directive plugins share a small helper, `h()` in `src/utils/remark.ts` — a thin wrapper over
[`hastscript`](https://github.com/syntax-tree/hastscript) that produces an mdast node carrying
`data.hName`/`data.hProperties`, the standard remark convention for "render this mdast node as an
arbitrary HTML element" during the mdast→hast conversion.

Any inline/leaf directive (`::name{...}` or `:name`) that neither plugin claims — not just an
unrecognized admonition type — falls through to `admonitions.ts`'s `textDirective`/`leafDirective`
handlers, which serialize it back to its original markdown text rather than silently dropping it.
This is what stops a stray or misspelled directive elsewhere in the pipeline from vanishing.

## Adding a new plugin

1. Decide mdast (need to see/alter markdown _structure_, before HTML exists) vs. hast (need to
   alter the _rendered HTML_, e.g. wrap an element, add attributes).
2. Write it in `src/plugins/satteri.ts` for a small one-off, or its own file in `src/plugins/` for
   anything with real logic (directives, external fetches, etc.) — matches the existing split.
3. Register it in `astro.config.ts`'s `mdastPlugins`/`hastPlugins` array.
4. If it emits new HTML/classes, add the CSS under `src/styles/components/` and `@import` it in
   `src/styles/global.css`'s `@layer components` block.
