# furioursus.dev — feature docs

A reference for the non-obvious systems in this repo — what each feature does, how it's wired
together, and where to go to change it. `README.md` at the repo root covers setup/commands/deploy;
this folder covers _how the pieces work_ once it's running.

Stack, for orientation: [Astro](https://astro.build) 7 (static output) · content collections for
posts/notes/tags · [`@astrojs/markdown-satteri`](https://github.com/withastro/astro/tree/main/packages/markdown-satteri)
as the markdown renderer, with a handful of custom hast/mdast plugins in `src/plugins/` · Tailwind
v4 for styling · [Decap CMS](https://decapcms.org/) + Netlify Identity for editing content in a
browser · [Pagefind](https://pagefind.app/) for static search · [Satori](https://github.com/vercel/satori)
for generated OG images · [Webmention.io](https://webmention.io/) for likes/reposts/replies.

## Index

- [Content model](./content-model.md) — the `blog`/`note`/`tag` collections, frontmatter schemas, drafts.
- [Markdown pipeline](./markdown-pipeline.md) — the satteri plugin stack: autolinked headings,
  reading time, admonitions, GitHub cards, external-link handling, and more.
- [Lightbox](./lightbox.md) — click-to-enlarge images, automatic in markdown bodies or explicit via
  a customizable component.
- [Theming](./theming.md) — the dark/light mode system and design tokens.
- [Search](./search.md) — Pagefind static search integration.
- [Webmentions](./webmentions.md) — likes/reposts/replies pulled from webmention.io.
- [OG images](./og-images.md) — per-post social card images generated at build time.
- [CMS](./cms.md) — Decap CMS + Netlify Identity, for editing content without a local checkout.
- [Deploy notifications](./deploy-notifications.md) — a local Netlify Build Plugin that posts
  deploy success/failure to Telegram.

## Conventions worth knowing before you edit any of the above

- **Plugin naming.** Everything in `src/plugins/` follows a `site-*` naming convention for its
  internal plugin `name` (e.g. `site-lightbox-images`) — a leftover-but-kept convention from when
  this repo was de-branded from the Astro Cactus starter theme it's built on (see the repo root
  `README.md`'s Acknowledgment section). New plugins should follow the same pattern.
- **Config is centralized.** Site-wide settings (title, author, date format, Expressive Code
  themes, menu links) live in `src/site.config.ts`, not scattered across components.
- **Global vs. scoped behavior.** Small stateful widgets are custom elements (`class extends
HTMLElement`) defined in a `<script>` tag, either colocated with their markup (e.g.
  `ThemeToggle.astro`) or registered once globally in `src/layouts/Base.astro` when the markup
  they operate on doesn't have a natural `.astro` file to live in (e.g. `Lightbox.astro`, whose
  markup mostly comes from a markdown transform, not a component template).
