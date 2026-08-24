#!/usr/bin/env node
// Pulls top-level, non-reply posts from a Bluesky account's public author feed and writes each
// one that isn't already synced as a `content/notes/bsky-<rkey>/index.md` note — a PESOS
// (Publish Elsewhere, Syndicate to your Own Site) import. See docs/bluesky-notes-sync.md.
//
// Idempotent by design: a post's slug is derived from its rkey, so re-running is safe — already
// synced posts are skipped by checking whether their note folder already exists, no separate
// cursor/state file needed. Run via .github/workflows/sync-bluesky-notes.yml on a schedule.
//
// No dependencies beyond Node's own fetch/fs — this runs standalone in CI, not as part of the
// Astro build, so it deliberately doesn't pull in the app's dependency tree.

import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

const ACTOR = process.env.BSKY_ACTOR || "furioursus.dev";
// Default: only the newest page (up to 100 posts) — plenty for an incremental, regularly
// scheduled sync. Set BSKY_SYNC_ALL=true (e.g. for a one-off manual backfill) to paginate
// through the entire author feed instead.
const SYNC_ALL = process.env.BSKY_SYNC_ALL === "true";

const API_URL = "https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed";
const CONTENT_DIR = path.join(process.cwd(), "content", "notes");
const TITLE_MAX_LENGTH = 60; // matches titleSchema in src/content.config.ts

async function fetchFeedPage(cursor) {
	const url = new URL(API_URL);
	url.searchParams.set("actor", ACTOR);
	// Excludes replies server-side; reposts still come through and are filtered out below.
	url.searchParams.set("filter", "posts_no_replies");
	url.searchParams.set("limit", "100");
	if (cursor) url.searchParams.set("cursor", cursor);

	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(
			`Bluesky API request failed (${res.status} ${res.statusText}): ${await res.text()}`,
		);
	}
	return res.json();
}

async function fetchPosts() {
	const items = [];
	let cursor;
	// Safety cap so a bug in cursor handling can't turn into an unbounded loop.
	do {
		const page = await fetchFeedPage(cursor);
		items.push(...page.feed);
		cursor = page.cursor;
	} while (SYNC_ALL && cursor && items.length < 2000);
	return items;
}

// Resolves a post's `record.facets` (byte-range annotations for links/mentions/tags) into
// inline markdown, so links in the original post stay clickable in the synced note. Facet
// byte offsets are UTF-8 byte offsets, not JS string indices, so this has to slice a Buffer
// rather than the string directly — otherwise multi-byte characters (emoji, etc.) shift things.
function applyFacets(text, facets) {
	if (!facets?.length) return text;

	const bytes = Buffer.from(text, "utf-8");
	const sorted = [...facets].sort((a, b) => a.index.byteStart - b.index.byteStart);

	let cursor = 0;
	let out = "";
	for (const facet of sorted) {
		const { byteStart, byteEnd } = facet.index;
		if (byteStart < cursor) continue; // overlapping facet — skip defensively, keep the earlier one

		out += bytes.subarray(cursor, byteStart).toString("utf-8");
		const segment = bytes.subarray(byteStart, byteEnd).toString("utf-8");
		const feature = facet.features?.[0];

		if (feature?.$type === "app.bsky.richtext.facet#link") {
			out += `[${segment}](${feature.uri})`;
		} else if (feature?.$type === "app.bsky.richtext.facet#mention") {
			out += `[${segment}](https://bsky.app/profile/${feature.did})`;
		} else {
			// hashtags (#tag) and anything unrecognized: leave the original text as-is
			out += segment;
		}
		cursor = byteEnd;
	}
	out += bytes.subarray(cursor).toString("utf-8");
	return out;
}

function deriveTitle(plainText, createdAt) {
	const singleLine = plainText.trim().replace(/\s+/g, " ");
	if (!singleLine) {
		const date = new Date(createdAt).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
		return `Note — ${date}`; // media-only post, no text to draw a title from
	}
	if (singleLine.length <= TITLE_MAX_LENGTH) return singleLine;
	return `${singleLine.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…`;
}

function guessExtension(url, contentType) {
	// Bluesky CDN image URLs end in e.g. "@jpeg" / "@png" naming the actual encoding.
	const suffixMatch = url.match(/@([a-z0-9]+)$/i);
	if (suffixMatch) return suffixMatch[1].toLowerCase() === "jpeg" ? "jpg" : suffixMatch[1];
	if (contentType) {
		const subtype = contentType.split("/")[1];
		if (subtype) return subtype.split("+")[0];
	}
	return "jpg";
}

function quoteFromRecord(record) {
	// `record` is a ViewRecord — guard against the "not found"/"blocked" variants, which lack
	// `author`/`value`.
	if (!record?.author || !record.value) return null;
	const rkey = record.uri.split("/").pop();
	return {
		url: `https://bsky.app/profile/${record.author.handle}/post/${rkey}`,
		handle: record.author.handle,
		text: (record.value.text || "").trim().replace(/\s+/g, " "),
	};
}

function extractEmbed(embed) {
	if (!embed) return null;
	switch (embed.$type) {
		case "app.bsky.embed.images#view":
			return { images: embed.images.map((img) => ({ url: img.fullsize, alt: img.alt || "" })) };
		case "app.bsky.embed.external#view":
			return {
				link: { url: embed.external.uri, title: embed.external.title || embed.external.uri },
			};
		case "app.bsky.embed.record#view":
			return { quote: quoteFromRecord(embed.record) };
		case "app.bsky.embed.recordWithMedia#view":
			return { ...extractEmbed(embed.media), quote: quoteFromRecord(embed.record.record) };
		default:
			return null;
	}
}

function yamlString(value) {
	return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
}

async function downloadImage(url, destPath) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`Failed to download image ${url}: ${res.status} ${res.statusText}`);
	await fs.writeFile(destPath, Buffer.from(await res.arrayBuffer()));
}

async function writeNote(post) {
	const record = post.record;
	const rkey = post.uri.split("/").pop();
	const slug = `bsky-${rkey}`;
	const dir = path.join(CONTENT_DIR, slug);
	const indexPath = path.join(dir, "index.md");

	if (existsSync(indexPath)) return null; // already synced

	const plainText = record.text || "";
	const title = deriveTitle(plainText, record.createdAt);
	const description = plainText.trim().replace(/\s+/g, " ") || undefined;

	let body = applyFacets(plainText, record.facets).trim();

	const embed = extractEmbed(post.embed);
	const images = (embed?.images || []).map((img, i) => ({
		...img,
		filename: `img-${i}.${guessExtension(img.url)}`,
	}));
	if (images.length) {
		body += `\n\n${images.map((img) => `![${img.alt}](./${img.filename})`).join("\n\n")}`;
	}
	if (embed?.link) {
		body += `\n\n[${embed.link.title}](${embed.link.url})`;
	}
	if (embed?.quote) {
		body += `\n\n> [@${embed.quote.handle}](${embed.quote.url}): ${embed.quote.text}`;
	}

	const frontmatter = [
		"---",
		`title: ${yamlString(title)}`,
		description ? `description: ${yamlString(description)}` : null,
		`publishDate: ${yamlString(record.createdAt)}`,
		`bskyPostUri: ${yamlString(post.uri)}`,
		"---",
		"",
		body,
		"",
	]
		.filter((line) => line !== null)
		.join("\n");

	await fs.mkdir(dir, { recursive: true });
	for (const img of images) {
		await downloadImage(img.url, path.join(dir, img.filename));
	}
	await fs.writeFile(indexPath, frontmatter);

	return slug;
}

async function main() {
	await fs.mkdir(CONTENT_DIR, { recursive: true });

	const feedItems = await fetchPosts();
	const created = [];

	for (const item of feedItems) {
		if (item.reason) continue; // skip reposts — only the author's own posts become notes
		const post = item.post;
		if (post.author.handle !== ACTOR && post.author.did !== ACTOR) continue;
		if (post.record?.$type !== "app.bsky.feed.post") continue;
		if (post.record.reply) continue; // defensive — filter=posts_no_replies should already exclude these

		const slug = await writeNote(post);
		if (slug) created.push(slug);
	}

	if (created.length) {
		console.log(`Synced ${created.length} new note(s) from Bluesky:`);
		for (const slug of created) console.log(` - ${slug}`);
	} else {
		console.log("No new Bluesky posts to sync.");
	}
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
