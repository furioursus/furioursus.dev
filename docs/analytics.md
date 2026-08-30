# Analytics (GoatCounter)

Pageview analytics via [GoatCounter](https://www.goatcounter.com/) — free for personal/non-commercial
sites, no cookies, no consent banner needed in most jurisdictions since it doesn't fingerprint or
track across sites.

## Wiring

One env var, `GOATCOUNTER_CODE` (the `xxx` in `xxx.goatcounter.com`), declared `context: "client",
access: "public"` in `astro.config.ts`'s `env.schema` — same pattern as `LASTFM_API_KEY`/
`WEBMENTION_URL`. This is fine to ship to the browser on purpose: a GoatCounter site code isn't a
secret, it's embedded directly in the tracking script's own `src` for anyone to read.

`src/components/BaseHead.astro` renders the tracking script when `GOATCOUNTER_CODE` is set:

```astro
{
	import.meta.env.PROD && GOATCOUNTER_CODE && (
		<script
			async
			data-goatcounter={`https://${GOATCOUNTER_CODE}.goatcounter.com/count`}
			src="https://gc.zgo.at/count.js"
		/>
	)
}
```

Since `BaseHead.astro` is included on every page via `Base.astro`, that one conditional covers the
whole site.

## Gotchas

- **`import.meta.env.PROD`-gated** — dev-server reloads and local testing never get counted, so
  `pnpm dev` doesn't pollute the real stats. `pnpm preview` (which builds first) does count, since
  it's a production build.
- **Unset by default.** If `GOATCOUNTER_CODE` isn't set in the environment (locally or in Netlify),
  no script tag renders at all — not a broken/empty one. Same three-state absence pattern as
  `LASTFM_API_KEY`/`DISCOGS_USERNAME` elsewhere in this repo: missing config means the feature is
  quietly off, not an error.
- **Setup is entirely on GoatCounter's side** — create a free account at goatcounter.com, pick a
  site code, set `GOATCOUNTER_CODE` to it. No code changes needed to actually start collecting data.
