#!/usr/bin/env node
// scripts/generate-cover-alt.mjs
//
// Backfills src/data/discogs-cover-alt.json with AI-generated alt text describing each
// record's cover art — the actual imagery (subject, color, composition), not just
// "{artist} – {title}", which is already visible as text right next to the cover in
// RecordCard.astro. See docs/discogs.md.
//
// Run manually after adding new records to your collection (needs ANTHROPIC_API_KEY,
// e.g. in .env — DISCOGS_USERNAME/DISCOGS_TOKEN too, same as any other local build):
//
//   npm run generate:cover-alt
//
// Never regenerates or overwrites an existing entry, including ones still flagged
// `reviewed: false` — so a hand-edit always sticks, and re-running only fills gaps for
// new releases. This file is committed (unlike src/assets/discogs-collection/, which is
// gitignored and rebuilt from scratch every build) specifically so a production build
// never needs to call this script or hold the API key — it only has to be re-run locally.

import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { loadCollection } from "astro-discogs-collection/collection";

try {
	process.loadEnvFile();
} catch {
	// No .env file — fine in CI, where real env vars are already set. Mirrors the same
	// try/catch in astro.config.ts, for the same reason (see the comment there).
}

const ROOT = process.cwd();
// Mirrors astro-discogs-collection's own default imageCacheDir — this repo doesn't
// override it in astro.config.ts. The package only exposes its resolved config to its own
// Astro integration, not to a plain Node script, so this has to be kept in sync by hand if
// that default (or an override in astro.config.ts) ever changes.
const IMAGE_CACHE_DIR = path.join(ROOT, "src/assets/discogs-collection/cover-images");
const OUTPUT_PATH = path.join(ROOT, "src/data/discogs-cover-alt.json");
const MODEL = "claude-opus-5";

const PROMPT = `Describe this album cover's imagery in one concise sentence, for use as alt
text on a website. Cover only what's visually depicted — subject matter, color palette,
composition, style. Don't mention the artist name, album title, genre, or year; that's
already shown as visible text next to the image. If the cover is purely typographic (just
text/logo, no imagery), say so briefly. Respond with only the sentence itself — no preamble,
no surrounding quotation marks.`;

function loadCache() {
	try {
		return JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8"));
	} catch {
		return {};
	}
}

function saveCache(cache) {
	fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
	// Sorted keys + trailing newline so re-runs produce a clean, reviewable diff.
	const sorted = Object.fromEntries(
		Object.keys(cache)
			.sort((a, b) => Number(a) - Number(b))
			.map((id) => [id, cache[id]]),
	);
	fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(sorted, null, "\t")}\n`);
}

async function describeCover(client, imagePath) {
	const image = fs.readFileSync(imagePath).toString("base64");
	const response = await client.messages.create({
		model: MODEL,
		max_tokens: 300,
		// A short, single-image captioning call — "low" effort is the right tier (see the
		// claude-api skill: low for simple, well-scoped tasks), no need for adaptive
		// thinking's default depth here.
		output_config: { effort: "low" },
		messages: [
			{
				role: "user",
				content: [
					{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
					{ type: "text", text: PROMPT },
				],
			},
		],
	});
	const text = response.content.find((block) => block.type === "text")?.text ?? "";
	return text.trim().replace(/^["']|["']$/g, "");
}

async function main() {
	if (!process.env.ANTHROPIC_API_KEY) {
		console.error("ANTHROPIC_API_KEY isn't set — add it to .env and re-run.");
		process.exitCode = 1;
		return;
	}

	const { releases, missingConfig, error } = await loadCollection();
	if (missingConfig) {
		console.error("DISCOGS_USERNAME/DISCOGS_TOKEN aren't set — can't load the collection.");
		process.exitCode = 1;
		return;
	}
	if (error) {
		console.error(`Failed to load the Discogs collection: ${error}`);
		process.exitCode = 1;
		return;
	}

	const cache = loadCache();
	const client = new Anthropic();

	// Cached cover filenames are `{artist-slug}_{title-slug}-{id}.jpg` (astro-discogs-
	// collection's slug.js, not part of its public exports) — the id suffix is documented as
	// the one stable part, so match on that rather than reimplementing the slugify logic
	// (accent-stripping etc.) and risking a mismatch.
	const filesById = new Map();
	try {
		for (const filename of fs.readdirSync(IMAGE_CACHE_DIR)) {
			const match = filename.match(/-(\d+)\.jpg$/);
			if (match) filesById.set(match[1], filename);
		}
	} catch {
		// Cache dir doesn't exist yet — e.g. astro dev/build hasn't run once to populate it.
	}

	const pending = releases.filter(
		(release) => !cache[String(release.id)] && filesById.has(String(release.id)),
	);

	if (pending.length === 0) {
		console.log(`Nothing to do — all ${releases.length} release(s) already have cached alt text.`);
		return;
	}

	console.log(`Generating alt text for ${pending.length} release(s)...`);
	let generated = 0;
	let failed = 0;

	for (const release of pending) {
		const imagePath = path.join(IMAGE_CACHE_DIR, filesById.get(String(release.id)));
		try {
			const alt = await describeCover(client, imagePath);
			cache[String(release.id)] = {
				artist: release.artist,
				title: release.title,
				alt,
				reviewed: false,
				model: MODEL,
				generatedAt: new Date().toISOString(),
			};
			generated += 1;
			console.log(`  ✓ ${release.artist} – ${release.title}`);
		} catch (err) {
			failed += 1;
			console.error(
				`  ✗ ${release.artist} – ${release.title}: ${err instanceof Error ? err.message : err}`,
			);
		}
	}

	saveCache(cache);

	const unreviewed = Object.values(cache).filter((entry) => !entry.reviewed).length;
	console.log(
		`\n${generated} generated${failed > 0 ? `, ${failed} failed` : ""}. ${unreviewed} entr${unreviewed === 1 ? "y" : "ies"} in ${path.relative(ROOT, OUTPUT_PATH)} still need${unreviewed === 1 ? "s" : ""} human review.`,
	);
}

main();
