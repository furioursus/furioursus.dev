import fs from "node:fs";
import { satteri, satteriHeadingIdsPlugin } from "@astrojs/markdown-satteri";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@tailwindcss/vite";
import { defineConfig, envField, fontProviders } from "astro/config";
import discogsCollection from 'astro-discogs-collection';
import expressiveCode from "astro-expressive-code";
import icon from "astro-icon";
import robotsTxt from "astro-robots-txt";
import webmanifest from "astro-webmanifest";
import { satteriAdmonitionsPlugin } from "./src/plugins/admonitions";
import { satteriGithubCardPlugin } from "./src/plugins/github-cards";
import {
	satteriAutolinkHeadingsPlugin,
	satteriExternalLinksPlugin,
	satteriFootnoteLabelPlugin,
	satteriLightboxImagesPlugin,
	satteriReadingTimePlugin,
	satteriUnwrapImagesPlugin,
} from "./src/plugins/satteri";
import { expressiveCodeOptions, siteConfig } from "./src/site.config";

// Vite 6+ no longer copies `.env` values onto `process.env` — it only exposes them via
// `import.meta.env`. `astro-discogs-collection` reads `process.env.DISCOGS_*` directly (see its
// README), so without this it always reports missingConfig even with a populated `.env`. Node's
// built-in loader populates process.env for us; it's a no-op if the vars are already set (CI, etc).
try {
	process.loadEnvFile();
} catch {
	// no .env file present (e.g. CI providing real env vars directly) — fine, ignore.
}

// https://astro.build/config
export default defineConfig({
	site: siteConfig.url,
	compressHTML: true,
	fonts: [
		{
			provider: fontProviders.local(),
			name: "MonoLisa",
			cssVariable: "--font-monolisa",
			options: {
				variants: [
					{
						src: ["./src/assets/fonts/MonoLisaNormal.woff2"],
						weight: "100 900",
						style: "normal",
					},
					{
						src: ["./src/assets/fonts/MonoLisaItalic.woff2"],
						weight: "100 900",
						style: "italic",
					},
				],
			},
		},
	],
	integrations: [
		expressiveCode(expressiveCodeOptions),
		icon({
			iconDir: "src/assets/icons",
			include: {
				mdi: ["*"],
			},
    }),
		discogsCollection(),
		sitemap(),
		mdx(),
		robotsTxt(),
		webmanifest({
			// See: https://github.com/alextim/astro-lib/blob/main/packages/astro-webmanifest/README.md
			name: siteConfig.title,
			description: siteConfig.description,
			lang: siteConfig.lang,
			icon: "public/icon.svg", // the source for generating favicon & icons
			icons: [
				{
					src: "icons/apple-touch-icon.png", // used in src/components/BaseHead.astro L:26
					sizes: "180x180",
					type: "image/png",
				},
				{
					src: "icons/icon-192.png",
					sizes: "192x192",
					type: "image/png",
				},
				{
					src: "icons/icon-512.png",
					sizes: "512x512",
					type: "image/png",
				},
			],
			start_url: "/",
			background_color: "#1d1f21",
			theme_color: "#2bbc8a",
			display: "standalone",
			config: {
				insertFaviconLinks: false,
				insertThemeColorMeta: false,
				insertManifestLink: false,
			},
		}),
	],
	markdown: {
		processor: satteri({
			features: { directive: true },
			mdastPlugins: [
				satteriUnwrapImagesPlugin(),
				satteriReadingTimePlugin(),
				satteriGithubCardPlugin(),
				satteriAdmonitionsPlugin(),
			],
			hastPlugins: [
				satteriHeadingIdsPlugin(),
				satteriAutolinkHeadingsPlugin(),
				satteriFootnoteLabelPlugin(),
				satteriExternalLinksPlugin(),
				satteriLightboxImagesPlugin(),
			],
		}),
	},
	vite: {
		plugins: [tailwind(), rawFonts([".ttf", ".woff", ".woff2"])],
	},
	env: {
		schema: {
			WEBMENTION_API_KEY: envField.string({ context: "server", access: "secret", optional: true }),
			// Domain registered with webmention.io, if it differs from the `site` hostname above (e.g. a verified `www.` subdomain).
			WEBMENTION_DOMAIN: envField.string({ context: "server", access: "public", optional: true }),
			WEBMENTION_URL: envField.string({ context: "client", access: "public", optional: true }),
			WEBMENTION_PINGBACK: envField.string({ context: "client", access: "public", optional: true }),
		},
	},
});

function rawFonts(ext: string[]) {
	return {
		name: "vite-plugin-raw-fonts",
		// @ts-expect-error:next-line
		transform(_, id) {
			if (ext.some((e) => id.endsWith(e))) {
				const buffer = fs.readFileSync(id);
				return {
					code: `export default ${JSON.stringify(buffer)}`,
					map: null,
					moduleType: "js",
				};
			}
		},
	};
}
