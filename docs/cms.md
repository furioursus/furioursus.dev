# CMS

Content can be edited from a browser, without a local checkout, via
[Decap CMS](https://decapcms.org/) (formerly Netlify CMS) at `/admin`, authenticated through
Netlify Identity + Git Gateway.

## How it's wired

- **`src/pages/admin.html`** — the actual admin UI. Loads Decap CMS straight from a CDN
  (`unpkg.com/decap-cms@^3.1.2`), _not_ the `decap-cms-app` npm package — that package is a
  dependency for local dev/typing purposes only and isn't what runs in the browser at `/admin`.
  (It does have one real side effect: pulling `@types/react` transitively into the dependency
  graph, which is what causes the Satori/`satori-html` type-cast noted in
  [og-images.md](./og-images.md).)
  - The `<link rel="cms-config-url">` pointing Decap at its config is an **absolute** path
    (`/admin/config.yml`), not a relative one. It used to be relative (`config.yml`), which only
    resolved correctly when the URL had a trailing slash (`/admin/`) — visiting plain `/admin`
    made the browser resolve it against the site root instead, a silent 404 with no useful error
    on screen. The `#/` Decap adds to the URL bar after it loads is its own internal
    (hash-based) router bootstrapping itself — that part's automatic and unrelated; you should
    never need to type it by hand, on `/admin` or `/admin/`.
- **`public/admin/config.yml`** — the actual CMS schema: one collection block per content
  collection (`blog`, `notes`, `tags`), each field mapped to match `src/content.config.ts`'s Zod
  schema. **These two files can drift** — Decap has no awareness of the Astro content schema, so a
  frontmatter field added/renamed/required in one has to be mirrored by hand in the other. See
  [content-model.md](./content-model.md).
  - `backend.repo` points at `furioursus/furioursus.dev` — worth double-checking this still matches
    wherever the repo actually lives if it's ever renamed/forked, since a mismatch here breaks the
    CMS's ability to commit.
  - The `blog` collection overrides `media_folder`/`public_folder` to `src/assets/blog` — a shared
    folder, not colocated per-entry, matching `src/content/blog/`'s own flat layout (see
    [content-model.md](./content-model.md)). `public_folder` here is a relative path
    (`../../assets/blog`), not a real URL — it's what gets written into `coverImage.src`, and
    the `image()` schema helper needs a path relative to the markdown file, not a browser-loadable
    one. The tradeoff: Decap's own image-picker preview can't load that path as an `<img>`, so
    swapping an *existing* post's cover image in `/admin` shows a blank thumbnail in the editor
    even though the upload and the resulting build both work fine. `notes`/`tags` have no image
    fields, so they don't override this and fall back to the top-level default below.
- **Netlify Identity widget** (`src/layouts/Base.astro`) — loaded site-wide via the
  `identity.netlify.com` script, not scoped to `/admin`. This is deliberate (commit
  `fix(cms): move netlify identity out of decap cms admin page`) — invite/recovery email links can
  land on any page, and the widget needs to be present wherever that happens, not just on the admin
  page itself.
  - A commented-out login button/menu currently sits in `src/components/layout/Header.astro`
    (`data-netlify-identity-button`/`-menu`) — present but not enabled. Uncomment there to surface a
    visible sign-in control outside of `/admin`.

## Auth flow, in short

Git Gateway (configured on the Netlify site, not in this repo) lets Netlify Identity users commit
to the repo without their own GitHub credentials/PAT — Decap CMS talks to Git Gateway, which talks
to GitHub on the authenticated user's behalf. Nothing in this repo issues or stores GitHub tokens.
