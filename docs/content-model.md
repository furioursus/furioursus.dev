# Content model

Defined in `src/content.config.ts`, using Astro [Content Collections](https://docs.astro.build/en/guides/content-collections/).
Three collections, each backed by a `glob()` loader over a folder in `content/`:

| Collection | Source folder                 | URL              | Notes                                                 |
| ---------- | ----------------------------- | ---------------- | ----------------------------------------------------- |
| `blog`     | `content/blog/**/*.{md,mdx}`  | `/blog/[slug]/`  | one folder per post, `index.md(x)` + colocated images |
| `note`     | `content/notes/**/*.{md,mdx}` | `/notes/[slug]/` | shorter-form, no tags/cover image                     |
| `tag`      | `content/tags/**/*.{md,mdx}`  | `/tags/[tag]/`   | optional override content for a tag's own page        |

## Blog frontmatter

```yaml
title: string # required, max 60 chars
description: string # required, 50–160 chars (SEO description)
publishDate: string | Date # required
updatedDate: string # optional
coverImage: # optional
  src: "./photo.jpg" # relative path, colocated with index.md — resolved via the image() schema helper
  alt: string
  caption: string | boolean | null # optional — see below, default is to show `alt`
draft: boolean # default false — filtered out of production build, feeds, og-images
ogImage: string # optional — skip auto-generation, use this image instead (see og-images.md)
tags: string[] # default [] — deduped + lowercased automatically
pinned: boolean # default false
bskyPostUri: string # optional — set by the astro-standard-site-sync integration, not by hand
```

`coverImage.src` goes through the `image()` schema helper, so it's a real optimized asset (via
`astro:assets`), not a plain string — Astro resolves the relative path against the markdown file's
own directory. It is **not** part of the markdown body, so it never goes through the automatic
markdown-image lightbox transform (see [lightbox.md](./lightbox.md)) — but
`src/components/blog/Masthead.astro` renders it through `LightboxImage.astro` explicitly (`fit="cover"
aspectRatio="16/9"`), so it's still click-to-enlarge, and shares the same caption styling. The 16:9
crop only affects the on-page thumbnail — enlarging it shows the full, uncropped photo, via a second
image `LightboxImage.astro` renders specifically for this case (see [lightbox.md](./lightbox.md)).

The cover image is also the one place on the site that breaks out of the normal content column —
`md:-ms-[100px] md:-me-[100px]` on the `LightboxImage` widens it ~200px past the surrounding text at
tablet sizes and up (unchanged on mobile). `<body>` carries `overflow-x-clip` (in `Base.astro`) as a
safety net for this — without it, a viewport just past the `md:` breakpoint has essentially no slack
around the centered `max-w-3xl` container yet, and the breakout would create a horizontal scrollbar
until the viewport is comfortably past 768px. `overflow-x-clip` (not `overflow-x-hidden`) is the deliberate choice — `hidden` on one axis has a
well-known risk of coercing the other axis's computed overflow away from `visible` on some browsers,
which can silently break `position: sticky` on a distant descendant; `clip` doesn't carry that risk.
The sticky table of contents (`TOC.astro`) was re-tested after adding this and still works correctly.

**Cover image captions default to showing `alt`** — the opposite of the lightbox's opt-in captions.
Since `alt` is already required on every cover image, showing it costs nothing, so a caption appears
below every cover image unless explicitly turned off:

| `caption` value    | Result                               |
| ------------------ | ------------------------------------ |
| omitted, or `true` | shows `alt` (the default)            |
| a string           | shows that instead, overriding `alt` |
| `false` or `null`  | no caption at all                    |

The Decap CMS config (`public/admin/config.yml`) only exposes `caption` as a plain string field, so
there's no way to opt out (`false`/`null`) from the CMS UI — leaving it blank there gives the
default (`alt`), same as omitting it. Setting `caption: null` to actually hide the caption needs a
direct edit to the post's file.

`aspectClass` sometimes appears in existing frontmatter (a leftover from an earlier cover-image
layout) but isn't part of the current schema — Zod silently drops unrecognized keys, so it's inert.
Safe to remove when touching a post, not urgent.

## Note frontmatter

Just `title`, optional `description`, and `publishDate`. No tags, no cover image, no draft flag —
notes are meant to be short/disposable enough not to need the full post apparatus.

## Tag pages

A tag doesn't need an entry in `content/tags/` to work — any string in a post's `tags` array
generates a `/tags/[tag]/` page automatically. A `content/tags/<name>/index.md` file is only needed
when you want to _override_ that page's intro copy (see `title`/`description` in the table above).

## Editing without a local checkout

All three collections are editable through Decap CMS at `/admin` — see [cms.md](./cms.md). The CMS
config (`public/admin/config.yml`) mirrors this schema field-for-field; if you add/rename a
frontmatter field here, update that file too.
