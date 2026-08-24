# Deploy notifications

Telegram messages on deploy success/failure, via a local Netlify Build Plugin — no relay server,
no third-party automation platform. The plugin runs inside Netlify's own build process and calls
Telegram's Bot API directly.

## How it's built

- **`plugins/telegram-notify/`** — a [local Netlify Build
  Plugin](https://docs.netlify.com/extend/develop-and-share/develop-build-plugins/) (not published
  to npm — just a directory Netlify loads by relative path). `index.js` exports `onSuccess` and
  `onError`, two of the plugin lifecycle hooks Netlify calls during every build/deploy; each POSTs
  a short HTML-formatted message to `https://api.telegram.org/bot<token>/sendMessage`.
- **`netlify.toml`** — registers the plugin via `[[plugins]] package = "./plugins/telegram-notify"`.
  Deliberately has no `[build]` section: build command and publish directory stay configured in the
  Netlify dashboard rather than being duplicated here, so this file can't drift out of sync with
  (or silently override) whatever's set there.

## Setup (one-time, per Netlify site)

1. **Create the bot** — message [`@BotFather`](https://t.me/BotFather) on Telegram, `/newbot`, save
   the token it gives you.
2. **Get your chat ID** — message [`@userinfobot`](https://t.me/userinfobot); it replies with your
   numeric ID directly.
3. **Set two environment variables** in the Netlify dashboard (Site settings → Environment
   variables) — `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`. Both **must** live there, never in
   `netlify.toml` or anywhere in this repo — it's public.

Nothing else to wire up — the plugin picks up both vars from `process.env` at build time.

## Gotchas

- **Missing env vars don't fail the build.** `sendTelegramMessage` in `index.js` checks for both
  vars up front and just logs a warning + returns if either is missing, rather than throwing. A
  notification hiccup (forgotten env var, Telegram API error, rate limit) should never be able to
  take the actual site deploy down with it — same reasoning for why a non-`ok` Telegram API
  response is logged, not thrown.
- **`onError` only covers the build/deploy stage**, not post-deploy issues (CDN propagation, edge
  function runtime errors after the fact) — it fires when the build command or Netlify's own build
  process fails, which covers "deploy broke" in the common case (bad commit, failing build step)
  but isn't a full uptime monitor.
- **Message length.** Telegram caps messages at 4096 characters; `onError` truncates the error
  text to 500 chars so a long stack trace doesn't dump illegibly into a chat notification — check
  the Netlify deploy log for the full error, the Telegram message is a pointer, not a substitute.
- **`SITE_NAME`/`URL`/`CONTEXT`/`BRANCH`** are [standard Netlify build environment
  variables](https://docs.netlify.com/configure-builds/environment-variables/) — no extra config
  needed for the plugin to read them, they're already present in every build's `process.env`.
- **Commit message isn't one of those env vars** — Netlify exposes `COMMIT_REF` (the SHA) but not
  the message, so `getCommitMessage()` shells out to `git log -1 --pretty=%s` instead, reading it
  straight from the repo the plugin is already running inside. Subject line only, wrapped in
  try/catch so a shallow clone or any other git hiccup drops the line rather than the build.
  Freeform text like a commit subject (or the error message in `onError`) gets `escapeHtml()`'d
  before going into the message — `parse_mode: "HTML"` treats `<`/`>`/`&` as markup, and an
  unescaped commit message or stack trace containing any of those could otherwise mangle or
  truncate the notification.
- **`URL`, not `DEPLOY_PRIME_URL`, for the link in the message.** `DEPLOY_PRIME_URL` looks like the
  obvious choice but varies by deploy context — it's only the real custom domain for a genuine
  production deploy; for a branch deploy it's `<branch>--sitename.netlify.app` instead, and it's
  always populated either way, so a `DEPLOY_PRIME_URL ?? URL` fallback never actually falls
  through. `URL` is the one Netlify documents as constant across every deploy regardless of
  context — use that as primary, `DEPLOY_PRIME_URL` only as a defensive fallback if `URL` is ever
  unset. (If you see a `<branch>--sitename.netlify.app`-shaped URL anywhere you expected the real
  domain, it's usually a sign the site's Production branch isn't set to match what you're pushing
  to — check Site settings → Build & deploy → Branches.)
