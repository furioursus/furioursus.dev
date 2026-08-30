// NOTE: this cache assumes a filesystem that (a) is writable and (b) persists
// across requests/builds. True for static builds and for a persistent SSR
// server. NOT true for serverless/edge SSR (e.g. Netlify Functions) —
// ephemeral + often read-only filesystem. If migrating to serverless SSR,
// swap this for Blobs, Redis, or similar durable KV store.
//
// Cache lives in `<project root>/.data/webmentions.json` (git-ignored)
// rather than Astro's `cacheDir` (under node_modules), since the latter gets
// wiped on every `npm install` and isn't a great place for a file you might
// want to seed/restore manually.

import { root } from "astro:config/server";
import { WEBMENTION_API_KEY, WEBMENTION_DOMAIN } from "astro:env/server";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { WebmentionsCache, WebmentionsChildren, WebmentionsFeed } from "@/types";

const DOMAIN = import.meta.env.SITE;
const CACHE_DIR = path.join(fileURLToPath(root), ".data");
const filePath = path.join(CACHE_DIR, "webmentions.json");
const validWebmentionTypes = ["like-of", "mention-of", "in-reply-to"];

// Falls back to the `site` hostname, but can be overridden via WEBMENTION_DOMAIN
// when the domain verified with webmention.io differs (e.g. a `www.` subdomain).
const hostName = WEBMENTION_DOMAIN || new URL(DOMAIN).hostname;

// Calls webmention.io api.
async function fetchWebmentions(timeFrom: string | null, perPage = 1000) {
	if (!DOMAIN) {
		console.warn("No domain specified. Please set in astro.config.ts");
		return null;
	}

	if (!WEBMENTION_API_KEY) {
		console.warn("No webmention api token specified in .env");
		return null;
	}

	let url = `https://webmention.io/api/mentions.jf2?domain=${hostName}&token=${WEBMENTION_API_KEY}&sort-dir=up&per-page=${perPage}`;

	if (timeFrom) url += `&since=${timeFrom}`;

	const res = await fetch(url);

	if (res.ok) {
		const data = (await res.json()) as WebmentionsFeed;
		return data;
	}

	const body = await res.text();
	console.warn(
		`Webmentions fetch failed for domain "${hostName}" (HTTP ${res.status} ${res.statusText}): ${body}`,
	);
	return null;
}

// Merge cached entries [a] with fresh webmentions [b], merge by wm-id
function mergeWebmentions(a: WebmentionsCache, b: WebmentionsFeed): WebmentionsChildren[] {
	return Array.from(
		[...a.children, ...b.children]
			.reduce((map, obj) => map.set(obj["wm-id"], obj), new Map())
			.values(),
	);
}

// filter out WebmentionChildren
export function filterWebmentions(webmentions: WebmentionsChildren[]) {
	return webmentions.filter((webmention) => {
		// make sure the mention has a property so we can sort them later
		if (!validWebmentionTypes.includes(webmention["wm-property"])) return false;

		// make sure 'mention-of' or 'in-reply-to' has text content.
		if (webmention["wm-property"] === "mention-of" || webmention["wm-property"] === "in-reply-to") {
			return webmention.content && webmention.content.text !== "";
		}

		return true;
	});
}

// save combined webmentions in cache file
function writeToCache(data: WebmentionsCache) {
	const fileContent = JSON.stringify(data, null, 2);

	try {
		// create cache folder if it doesn't exist already
		if (!fs.existsSync(CACHE_DIR)) {
			fs.mkdirSync(CACHE_DIR, { recursive: true });
		}
		// write data to cache json file
		fs.writeFileSync(filePath, fileContent);
	} catch (err) {
		console.warn(
			"Webmentions cache write failed — if you're running SSR on a serverless/ephemeral filesystem, this cache strategy probably won't work.",
			err,
		);
	}
}

function getFromCache(): WebmentionsCache {
	if (fs.existsSync(filePath)) {
		const data = fs.readFileSync(filePath, "utf-8");
		return JSON.parse(data);
	}
	// no cache found
	return {
		lastFetched: null,
		children: [],
	};
}

async function getAndCacheWebmentions() {
	const cache = getFromCache();
	const mentions = await fetchWebmentions(cache.lastFetched);

	if (mentions) {
		mentions.children = filterWebmentions(mentions.children);
		const webmentions: WebmentionsCache = {
			lastFetched: new Date().toISOString(),
			// Make sure the first arg is the cache
			children: mergeWebmentions(cache, mentions),
		};

		writeToCache(webmentions);
		return webmentions;
	}

	console.warn("Live webmentions fetch failed — falling back to existing cache, if any.");
	return cache;
}

// Normalizes a URL for comparison purposes: ignores protocol, a leading "www.",
// and a trailing slash. This lets webmentions recorded against a different host
// (e.g. a `www.` subdomain used at the time) or with/without a trailing slash
// still match the current page.
function normalizeUrl(rawUrl: string): string {
	try {
		const parsed = new URL(rawUrl);
		const host = parsed.hostname.replace(/^www\./, "");
		const pathname =
			parsed.pathname !== "/" && parsed.pathname.endsWith("/")
				? parsed.pathname.slice(0, -1)
				: parsed.pathname;
		return `${host}${pathname}`;
	} catch {
		return rawUrl;
	}
}

let webMentionsPromise: Promise<WebmentionsCache> | null = null;

export async function getWebmentionsForUrl(url: string) {
	if (!webMentionsPromise) webMentionsPromise = getAndCacheWebmentions();
	const webMentions = await webMentionsPromise;
	const target = normalizeUrl(url);
	return webMentions.children.filter((entry) => normalizeUrl(entry["wm-target"]) === target);
}
