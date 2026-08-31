import type { AstroExpressiveCodeOptions } from "astro-expressive-code";
import type { SiteConfig } from "@/types";

export const siteConfig: SiteConfig = {
	// ! Please remember to replace the following site property with your own domain, used in astro.config.ts
	url: "https://www.furioursus.dev/",
	/*
		- Used to construct the meta title property found in src/components/BaseHead.astro L:11
		- The webmanifest name found in astro.config.ts L:42
		- The link value found in src/components/layout/Header.astro L:35
		- In the footer found in src/components/layout/Footer.astro L:12
	*/
	title: "furioursus",
	// Used as both a meta property (src/components/BaseHead.astro L:31 + L:49) & the generated satori png (src/pages/og-image/[slug].png.ts)
	author: "Christopher Kennedy-Nuñez",
	// Used as the default description meta property and webmanifest description
	description: "Personal Blog of NYC-based web developer, Christopher Kennedy-Nuñez",
	// HTML lang property, found in src/layouts/Base.astro L:18 & astro.config.ts L:48
	lang: "en-US",
	// Meta property, found in src/components/BaseHead.astro L:42
	ogLocale: "en_US",
	// Determines whether to show the logo in the templates header
	showLogo: true,
	// Webmanifest background_color/theme_color (astro.config.ts's webmanifest() call) — also reused
	// as-is by src/pages/og-image/_ogMarkup.ts's Satori markup, which can't reference the @theme
	// dark-mode CSS custom properties (Satori renders to a static image at build time, no CSSOM).
	// Single source of truth for what were three independently hand-typed hex literals — themeColor
	// had drifted a digit (#2bbc89 in the OG markup vs. #2bbc8a here) before this existed.
	backgroundColor: "#1d1f21",
	themeColor: "#2bbc8a",
	// Date.prototype.toLocaleDateString() parameters, found in src/utils/date.ts.
	date: {
		options: {
			day: "numeric",
			month: "short",
			year: "numeric",
		},
	},
};

// Used to generate links in both the Header & Footer.
export const menuLinks: { path: string; title: string }[] = [
	{
		path: "/",
		title: "Home",
	},
	{
		path: "/about/",
		title: "About",
	},
	{
		path: "/blog/",
		title: "Blog",
	},
	{
		path: "/notes/",
		title: "Notes",
	},
	{
		path: "/cv/",
		title: "CV",
	},
	{
		path: "/music/",
		title: "Music",
	},
	{
		path: "/mtg/",
		title: "MTG",
	},
];

// https://expressive-code.com/reference/configuration/
export const expressiveCodeOptions: AstroExpressiveCodeOptions = {
	styleOverrides: {
		borderRadius: "4px",
		codeFontFamily:
			'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
		codeFontSize: "0.875rem",
		codeLineHeight: "1.7142857rem",
		codePaddingInline: "1rem",
		frames: {
			frameBoxShadowCssValue: "none",
		},
		uiLineHeight: "inherit",
	},
	themeCssSelector(theme, { styleVariants }) {
		// If one dark and one light theme are available
		// generate theme CSS selectors compatible with site's dark mode switch
		if (styleVariants.length >= 2) {
			const baseTheme = styleVariants[0]?.theme;
			const altTheme = styleVariants.find((v) => v.theme.type !== baseTheme?.type)?.theme;
			if (theme === baseTheme || theme === altTheme) return `[data-theme='${theme.type}']`;
		}
		// return default selector
		return `[data-theme="${theme.name}"]`;
	},
	// One dark, one light theme => https://expressive-code.com/guides/themes/#available-themes
	themes: ["catppuccin-macchiato", "catppuccin-latte"],
	useThemedScrollbars: false,
};
