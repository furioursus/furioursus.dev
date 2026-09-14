declare module "@pagefind/default-ui" {
	declare class PagefindUI {
		constructor(arg: unknown);
	}
}
/// <reference types="astro-discogs-collection/client" />

declare namespace astroHTML.JSX {
	interface ScriptHTMLAttributes {
		/**
		 * Render-blocking token list. Astro's bundled HTML types predate the `blocking` attribute,
		 * so without this declaration merge `astro check` rejects it — the attribute itself is
		 * emitted correctly either way. Used by `ThemeProvider.astro`; see docs/view-transitions.md.
		 */
		blocking?: "render";
	}
}
