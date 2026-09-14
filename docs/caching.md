# Asset caching (`public/_headers`)

Netlify serves every file with `cache-control: public, max-age=0, must-revalidate` unless a
`_headers` file says otherwise. For HTML that is exactly right — a deploy should be visible
immediately. For hashed build output it is actively harmful, and it caused two browser-specific
rendering bugs that looked like completely unrelated problems.

## The bug this fixed

Astro content-hashes everything it emits into `/_astro/` — `Base.Crc0ifEm.css`,
`grain-dark-1600w.BJAWCS1b.webp`, `_astro/fonts/2d77a45bc46eede1.woff2`. The hash is part of the
filename, so a changed file gets a **new URL** and an old URL can never serve stale content. Those
are the textbook case for `immutable`.

Under Netlify's default, the browser instead had to send a conditional request for each of them on
**every single navigation** and wait for a `304 Not Modified` before it could use the copy already
sitting in its cache. Per page load that meant a round trip for the 192KB stylesheet, both woff2
faces (129KB + 104KB), and the ~400KB grain texture.

What that looked like, per engine:

- **Safari** — the wordmark and body text rendered in the fallback face, or vanished entirely, until
  the font revalidated, then snapped to MonoLisa. A font flash on every page.
- **Firefox** — the page painted with a flat near-black background and the grain texture appeared a
  beat later, so the background visibly "reloaded" page to page.
- **Chrome** — largely hidden, because the speculation rules in `Base.astro` prerender likely
  navigations and Chrome's heuristics are more forgiving. This is why the bug read as
  "Safari and Firefox are broken" rather than "the cache headers are wrong."

The headers, not the rendering, were the problem. This was originally misdiagnosed as something
[view transitions](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API) would
smooth over; they would only ever have papered over it in one browser.

## FOOTGUN: only fingerprinted paths may be `immutable`

`immutable` means "never revalidate this URL, for a year." That is safe **only** when the URL
changes whenever the bytes change. Adding a rule like that for a stable path — `/favicon.svg`,
`/social-card.png`, `/icons/*`, any page HTML — pins a year-old copy into visitors' browsers with no
way to push a correction. Those deliberately stay on Netlify's revalidating default.

The test before adding a path here: **does its filename contain a content hash?** If not, it does
not belong in this file.

Pagefind is the fiddly case, which is why it is listed by subdirectory rather than as
`/pagefind/*`: its `fragment/`, `index/` and `filter/` chunks are content-addressed, but the entry
scripts (`pagefind.js` and friends) are not, and must stay revalidating so a rebuilt index is picked
up rather than deadlocked against a cached loader.

## Verifying

`_headers` only takes effect once deployed — it is a Netlify directive, not something the dev server
or `astro preview` honours. Check it against production directly:

```sh
curl -sI https://www.furioursus.dev/_astro/Base.Crc0ifEm.css | grep -i cache-control
# want: cache-control: public, max-age=31536000, immutable
```

Confirm a font too, since it sits one directory deeper and is half of what this file exists to fix:

```sh
curl -s https://www.furioursus.dev/ | grep -oE '/_astro/fonts/[^)"]*' | sort -u
```

The file lives in `public/`, so it is copied verbatim into `dist/` at build time — same mechanism as
`public/_redirects`, see [navigation](./navigation.md).

## Still outstanding: the grain is heavy

Caching stops the texture being re-fetched, but a **first** visit still pays ~400KB for the desktop
grain tier (`grain-*-1600w.webp`), and a cold cache will still show one flash. A noise texture does
not intrinsically need to be a full-bleed 1600px image — a small seamless tile with
`background-repeat`, or a lower-quality re-encode (noise hides compression artefacts extremely well),
would cut it by an order of magnitude. That is a design decision rather than a bug fix, so it has
been left alone; see [theming](./theming.md) for how the tiers are chosen.
