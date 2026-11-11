# Shared components

Some components come from [`@furioursus/ui`](https://github.com/furioursus/furioursus-ui) instead of
`src/components/`: Vue 3 components shared with the MTG tools. Their props, looks and footguns are
in the package's [`docs/components.md`](https://github.com/furioursus/furioursus-ui/blob/main/docs/components.md);
this page covers how this site wires them in.

| Component | Used in | Hydrated? |
| --- | --- | --- |
| `ThemeToggle` | `src/components/layout/Header.astro` | No. `theme.js` handles its click. |
| `RankedList` | `src/components/LastfmListeningStats.astro` | No. Static HTML. |
| `PeriodTabs` | `src/components/ListeningStatsTabs.vue` | Yes, `client:visible`, on the music page only. |

## Setup

- `@astrojs/vue` is registered first in `astro.config.ts`'s `integrations`. `vue` is a dependency.
- `src/styles/global.css` imports `@furioursus/ui/vue/style.css` after the tokens. Its rules are in
  `@layer components`, so Tailwind utilities on a component (`class="ms-2 sm:ms-4"` on
  `ThemeToggle`) override them.
- `src/furioursus-ui.d.ts` declares the components' props, because the package doesn't ship types
  yet. Delete it once it does.
- **Footgun:** `astro` (7.4.7) and `@astrojs/vue` (7.1.2) are pinned exactly and move together.
  `@astrojs/vue` 7.1.3 and later import `virtual:astro:app-entrypoint/…`, which Astro 7.3.x doesn't
  provide, so the build fails with "Rolldown failed to resolve import". Their `astro: ^7.0.0` peer
  range doesn't catch it. Upgrade Astro first, then `@astrojs/vue`.

## Only hydrate what has to respond

Each `client:*` directive ships the Vue runtime (about 30 KB gzipped) to that page. Pages without an
island still load about 6 KB of JavaScript.

- **`ThemeToggle` gets no directive.** It's rendered as static HTML; the inlined `theme.js` handles
  any `[data-theme-toggle]` click and keeps `aria-checked` and `title` in sync (see
  [theming.md](./theming.md#switching-themes)). Hydrating it would put Vue on every page, since the
  header is on every page.
- **`RankedList` gets no directive.** It's a list; nothing in it responds. It also formats counts
  with `toLocaleString()`, which would differ between the server and a reader's browser and cause a
  hydration mismatch.
- **`PeriodTabs` is hydrated, through `ListeningStatsTabs.vue`.** Only the tab strip hydrates: the
  panels and their lists stay server-rendered, and the wrapper shows and hides them by id
  (`listening-stats-panel-<period>`), which `PeriodTabs`' `idPrefix` links to with `aria-controls`.
  `v-model` can't cross from an `.astro` file into Vue, which is why the small `.vue` wrapper exists.

When adding one: give it no directive unless it must respond to input, and then hydrate the smallest
piece that does, with `client:visible` for anything below the fold.
