# Dev server over Tailscale

`npm run dev` binds the Astro dev server to loopback only — it's reachable at
`http://localhost:4321/` and nowhere else. `npm run dev:remote` binds it to every interface instead,
so any device on the tailnet can load it: a phone, an iPad, a second machine.

```bash
npm run dev:remote
```

```
  Serving over Tailscale at http://ikari.tailf59556.ts.net:4321/

  ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄
  █ ▄▄▄▄▄ █▄▀ ▀  █▄▀█▀▄██ ▄▄▄▄▄ █
  … (scan it with the phone's camera)
```

## How it's wired

Three pieces, in [`scripts/dev-remote.mjs`](../scripts/dev-remote.mjs), `package.json`, and
`astro.config.ts`:

1. **Host detection.** The script shells out to `tailscale status --json` and reads
   `.Self.DNSName` — the machine's own MagicDNS name, e.g. `ikari.tailf59556.ts.net`. It looks for
   the `tailscale` binary on `PATH` first, then at
   `/Applications/Tailscale.app/Contents/MacOS/Tailscale`, which is where the macOS GUI app puts
   its CLI. Set `TAILSCALE_HOST` to skip the lookup entirely.

2. **Binding.** The script spawns `npm run dev -- --host`. It delegates to the existing `dev`
   script rather than calling `astro dev` itself so the `predev` sanitize-dates pass still runs
   (see [content model](./content-model.md)); npm appends `--host` to the end of that script's
   command string, which is exactly where `astro dev` is.

3. **Vite's host allowlist.** `astro.config.ts` sets `vite.server.allowedHosts`:

   ```ts
   vite: {
     server: {
       allowedHosts: [process.env.TAILSCALE_HOST ?? ".ts.net"],
     },
   },
   ```

   `dev-remote.mjs` passes the detected name through as `TAILSCALE_HOST`; the leading-dot
   `.ts.net` fallback matches any MagicDNS name, so a bare `astro dev --host` works too.

## Gotchas

- **`--host` alone isn't enough.** Vite rejects any request whose `Host` header isn't in
  `allowedHosts` — without the config above, the page loads as a bare "This host is not allowed"
  error rather than the site, which reads like the server isn't running at all. This is a
  DNS-rebinding guard, not a bug; the fix is allowing the host, not disabling the check.
- **`dev:remote` binds to every interface, not just Tailscale.** `--host` is `0.0.0.0` — the dev
  server is also on the LAN you're joined to, coffee-shop wifi included. That's why it's a separate
  script instead of the default: `npm run dev` stays loopback-only on purpose.
- **Only one dev server at a time.** Astro 7 keeps a persistent dev server; starting a second one
  prints `Dev server already running at http://localhost:4321 (pid …)` and exits non-zero without
  serving anything. Run `astro dev stop` first if you switched from `npm run dev`.
- **The `sanitize-dates --watch` side of `dev` doesn't survive, here or in plain `npm run dev`.**
  Astro 7 daemonizes `astro dev` and returns immediately, so the `dev` script reaches its
  `trap 'kill 0' EXIT` and takes the backgrounded watcher down with it. The one-shot `predev` pass
  still runs. This predates `dev:remote` and isn't specific to it.
- **The QR code needs a real TTY.** `qrcode-terminal` draws nothing when stdout is piped or
  redirected to a file — you get a blank gap where the code should be.

## Optional: HTTPS via `tailscale serve`

Plain `dev:remote` is HTTP. To get a real Let's Encrypt cert on the MagicDNS name — useful for
testing anything gated behind a secure context (service workers, clipboard, device APIs) — front
the dev server with Tailscale's own proxy:

```bash
tailscale serve --bg 4321
```

The site is then at `https://ikari.tailf59556.ts.net/` on port 443. `tailscale serve status` shows
what's proxied, and this turns it off:

```bash
tailscale serve --https=443 off
```

Note that this is tailnet-only. `tailscale funnel` would expose it to the public internet — don't
point that at a dev server.
