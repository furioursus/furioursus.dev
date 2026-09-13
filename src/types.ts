export interface SiteConfig {
	author: string;
	/** Webmanifest `background_color` — also the OG image background, see site.config.ts's comment. */
	backgroundColor: string;
	date: {
		options: Intl.DateTimeFormatOptions;
	};
	description: string;
	lang: string;
	ogLocale: string;
	showLogo: boolean;
	/** Webmanifest `theme_color` — also the OG image's footer border, see site.config.ts's comment. */
	themeColor: string;
	title: string;
	url: string;
}

export interface SiteMeta {
	articleDate?: string | undefined;
	description?: string;
	ogImage?: string | undefined;
	title: string;
}

/** Webmentions */
export interface WebmentionsFeed {
	children: WebmentionsChildren[];
	name: string;
	type: string;
}

export interface WebmentionsCache {
	children: WebmentionsChildren[];
	lastFetched: null | string;
}

export interface WebmentionsChildren {
	author: Author | null;
	content?: Content | null;
	"mention-of": string;
	name?: null | string;
	photo?: null | string[];
	published?: null | string;
	rels?: Rels | null;
	summary?: Summary | null;
	syndication?: null | string[];
	type: string;
	url: string;
	"wm-id": number;
	"wm-private": boolean;
	"wm-property": string;
	"wm-protocol": string;
	"wm-received": string;
	"wm-source": string;
	"wm-target": string;
}

export interface Author {
	name: string;
	photo: string;
	type: string;
	url: string;
}

export interface Content {
	"content-type": string;
	html: string;
	text: string;
	value: string;
}

export interface Rels {
	canonical: string;
}

export interface Summary {
	"content-type": string;
	value: string;
}

export type AdmonitionType = "tip" | "note" | "important" | "caution" | "warning";

/**
 * The slim, client-side shape of one MTG card, shipped as JSON inside
 * `CardCollection.astro` and consumed by its filter/sort/render script.
 *
 * Deliberately much smaller than the server-side `EnrichedCard` — see that component's
 * frontmatter comment for why entries are shipped this slim. Lives here rather than in the
 * component because Astro's frontmatter and its `<script>` are separate module graphs: each
 * declared its own copy, and nothing could keep the two in sync. Both now `import type` from
 * here, which is erased at build time and ships no bytes.
 */
export interface ClientCard {
	name: string;
	/** Scryfall's own name for the resolved printing, falling back to the row's name — alt text. */
	alt: string;
	/** Lowercased "name setName", what the search box matches against. */
	search: string;
	/** Pipe-joined lowercase color identity, e.g. "w|u"; colorless cards get "c". */
	color: string;
	rarity: string;
	foil: string;
	fullArt: boolean;
	extArt: boolean;
	setCode: string;
	collector: string;
	quantity: number;
	/** Raw unit price for sorting; null when Scryfall has no known price. */
	price: number | null;
	/** Formatted unit price for display, or null to render "Price unknown". */
	priceText: string | null;
	/** Precomputed " · Nx = $Y" suffix for stacks of more than one copy, or null to render nothing. */
	lineText: string | null;
	img: string | null;
	href: string | null;
	/** "Set name · Rarity · Full Art · Extended Art", already joined and capitalized. */
	meta: string;
}
