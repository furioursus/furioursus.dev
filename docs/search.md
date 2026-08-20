# Search

Static, client-side search over posts and notes via [Pagefind](https://pagefind.app/) — no server,
no third-party index; it crawls the _built_ site and generates its own search index as a build step.

## How it's wired

- `package.json`'s `postbuild` script (`pagefind --site dist`) runs after `astro build`, crawling
  `dist/` and writing the index into `dist/pagefind/`. Pagefind only works against a built site —
  `pnpm dev` has no search index, and `pnpm preview` needs `build && postbuild` to have run first.
- `src/components/Search.astro` lazy-loads `@pagefind/component-ui` (skipped entirely in `DEV`, since
  there's no index to query yet) and renders `<pagefind-modal-trigger>`/`<pagefind-modal>` — web
  components Pagefind's own package defines, not custom elements written for this site.
- Styling overrides in `src/styles/blocks/search.css`.

## What gets indexed, and how it's scoped

Only elements carrying `data-pagefind-body` are indexed — present on the `<article>` in
`src/layouts/BlogPost.astro` and on notes via `src/components/note/Note.astro`. Everything else
(header, footer, nav) is excluded by default since Pagefind only indexes inside a
`data-pagefind-body` element when at least one exists on the page.

Tag filtering piggybacks on the same mechanism: the `data-pagefind-filter="tag"` attribute on tag
links in `src/components/blog/Masthead.astro` lets the search UI facet by tag without extra config.

## Removing it

If search ever needs to go: delete `src/components/Search.astro` and its usage in
`src/components/layout/Header.astro`, drop the `postbuild` script and the `data-pagefind-*`
attributes, and uninstall `@pagefind/default-ui`/`@pagefind/component-ui`/`pagefind`.
