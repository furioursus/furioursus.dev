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

## Where rationale lives: docs/, not inline

`docs/` is the home for the _why_. Inline comments duplicating it at length are the single biggest
readability cost in this codebase — a 67-line comment over a one-line declaration is not thorough,
it is a wall between the reader and the code.

**Inline comments cap at ~5 lines.** Only four kinds belong inline:

- **Footgun** (≤3 lines) — "if you change or remove this, X silently breaks." These earn permanent
  inline residence, because the person about to break it is reading the code, not the docs. Shorten
  them, never delete them.
- **Public API docs** — JSDoc on a component's `Props`, at any length. It surfaces in editor
  tooltips and is documentation, not clutter.
- **Magic-number key** (≤2 lines) — what five unguessable constants mean.
- **Pointer** (1 line) — `see docs/<feature>.md`. The pointer _replaces_ the prose; don't write a
  summary and then also link to the full version.

**What does not go inline:**

- **History.** "An earlier version did X", "we tried Y first", "this used to break because…" →
  `docs/<feature>.md`. Git has it too. This is the largest category by far.
- Filename headers at the top of the file they name.
- Anything restating the declaration directly below it.
- The same fact twice in one file, or at equal length in both a source file and its docs page.

**Placement, which is what actually makes a file hard to read:**

- No comment block longer than the rule or function it documents.
- In-template `{/* … */}` comments in `.astro`: **one line for narrative, hard cap.** A 26-line
  comment between `</a>` and `<nav>` is the failure mode. Footguns are the exception — a couple of
  lines guarding the element directly below them is correct and should stay there, because moving a
  warning away from the thing it protects defeats the point of it being inline at all.
- No frontmatter comment that pushes the closing `---` fence far down the file — you should not
  have to scroll past an essay to reach the markup.

When moving rationale out, the test is "would someone about to break this see the warning in time?"
If yes, the docs are the right home. If no, it's a footgun — keep it inline and make it short.

## Blocked URLs

When a URL can't be reached (status check, docs fetch, download, `curl`, package install), tell christopher exactly what to change so access works: which environment blocked it, the setting, where it lives, and a paste-ready value. Then carry on with whatever doesn't need that host. Never silently route around the block or quietly drop the step. This section is here because cloud sessions don't load christopher's global `~/.claude/CLAUDE.md`.

- First confirm it's a block, not a dead site: read the tool's error or run `curl -sI <url>` and quote the status. Don't call a 404 or an outage a config gap.
- If a setting below doesn't match what you see, re-check the docs (code.claude.com/docs/en/cloud-environments, /sandboxing, /permissions) before advising.
- Cloud sessions read only this repo's committed `.claude/settings.json` and managed settings, not `~/.claude/settings.json` or `.claude/settings.local.json`. WebFetch refuses `localhost` and dotless hosts by design.

| Where it failed | Setting | Where to change it | Example value |
|---|---|---|---|
| Cloud session (claude.ai/code or a Desktop cloud env) | Network access → **Custom**, **Allowed domains**, keep "Also include default list of common package managers" checked | Environment selector above the message box → **Cloud** → hover the env → gear icon | One host per line; `*.example.com` covers subdomains |
| Cloud session, GitHub repo or API | GitHub App installed on the repo, or `/web-setup` from a terminal; the domain allowlist doesn't govern GitHub | claude.ai/code onboarding, or local terminal | `gh pr` / `gh issue` (GraphQL) are blocked; use `gh api repos/{owner}/{repo}/...` |
| Local Bash in the sandbox (`curl`, `npm`, `git`) | `sandbox.network.allowedDomains` | `.claude/settings.json` (committed, so cloud sees it too) or `~/.claude/settings.json` | `["api.example.com", "*.example.com"]` |
| WebFetch prompts or is denied | `permissions.allow` rule | Same files | `"WebFetch(domain:example.com)"` |
| MCP connector needs auth | Connector authorization | claude.ai connector settings, or `/mcp` in a terminal `claude` | n/a |

## Commits

Every commit is christopher's: author and committer `Christopher Kennedy-Nuñez <yo@git.furioursus.dev>`, never `yo@github.furioursus.dev` or a Claude address.

- No AI attribution: no `Co-Authored-By`, "Generated with" or session links. `.claude/settings.json` turns Claude Code's off, including in cloud sessions.
- Conventional Commits with a lowercase imperative subject. Add a body only when the why isn't obvious: one line per paragraph or bullet, never hard-wrapped, American spelling.
