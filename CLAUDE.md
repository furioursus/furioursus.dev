# Instructions for Claude

## Keep docs/ in sync with features

This repo documents its non-obvious features in [`docs/`](./docs/README.md) — one file per feature
area (lightbox, theming, search, webmentions, og-images, cms, content model, markdown pipeline).

**Whenever a change adds a new feature, or meaningfully changes how an existing one works,
update `docs/` in the same piece of work — don't treat it as a separate follow-up step.**

- New feature of any real size (a new component, plugin, integration, content-pipeline transform)
  → add a new `docs/<feature>.md` and link it from `docs/README.md`'s index.
- Change to how an existing documented feature works (new props, changed defaults, a moved file,
  a behavior fix worth knowing about) → update the relevant existing `docs/*.md` file in place.
- Small fixes, refactors, or config tweaks that don't change how a feature works or is used don't
  need a docs update — use judgment, don't pad `docs/` with noise.

Follow the existing docs' style: concrete file paths and real code, not abstract description; call
out gotchas/footguns explicitly (see `docs/lightbox.md`'s `object-fit: contain` note for the kind
of thing worth flagging); keep each file scoped to one feature area rather than growing a catch-all.
