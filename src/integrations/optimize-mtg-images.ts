// src/integrations/optimize-mtg-images.ts
// A small local Astro integration (not an npm package, unlike astro-mtg-collection itself) that
// batch-resizes the MTG collection's cached card art into small static webp files under
// public/mtg-cards/, once, up front — see docs/mtg.md's "Card images are pre-optimized, not
// astro:assets" section for why this exists.
//
// Rendering ~6,200 unique cards through astro:assets' <Image> (one component instance per card,
// each triggering its own build-time Sharp transform) broke astro build specifically on /mtg/ —
// every other route built fine; only the one route with thousands of inline Image components
// failed, deep inside an Astro/Vite internal function that should never run during a static
// build. Sidestepping astro:assets for this one page's card art avoids it entirely, rather than
// chasing the exact root cause of what looks like an upstream scale-related edge case.
//
// Must run *after* astro-mtg-collection's own integration in astro.config.ts's `integrations`
// array — Astro fires astro:build:start/astro:server:setup hooks in registration order, and this
// reads the raw JPGs astro-mtg-collection's own hook just finished downloading into
// imageCacheDir (src/assets/mtg-collection/card-images/, see its README) rather than
// re-downloading them from Scryfall itself.
//
// Runs from astro:build:start specifically so its output lands in public/ *before* Astro copies
// public/ to dist/ (part of the client Vite build, itself before route generation) — writing
// these files later, e.g. from mtg.astro's own frontmatter (which runs during route generation),
// would be too late for that copy and the files would never reach dist/.
import fs from "node:fs";
import path from "node:path";
import type { AstroIntegration } from "astro";
import sharp from "sharp";

const SOURCE_DIR = "src/assets/mtg-collection/card-images";
const OUTPUT_DIR = "public/mtg-cards";
// Wide enough to look sharp both in the grid (rendered at up to ~13rem/208px per
// CardCollection.astro's column size) and in the lightbox's enlarged view, without generating a
// second, larger variant — CardTile.astro reuses this one file for both, the same tradeoff
// RecordCard.astro's own remote-fallback path already makes for un-cached covers.
const WIDTH = 480;

async function optimize(log: (message: string) => void): Promise<void> {
	const root = process.cwd();
	const sourceDir = path.join(root, SOURCE_DIR);
	const outputDir = path.join(root, OUTPUT_DIR);

	let files: string[];
	try {
		files = fs.readdirSync(sourceDir).filter((file) => file.endsWith(".jpg"));
	} catch {
		// No cache yet — astro-mtg-collection's own hook hasn't run (e.g. missing collection.csv),
		// or hasn't registered before this integration. Nothing to optimize either way.
		return;
	}
	if (files.length === 0) return;

	fs.mkdirSync(outputDir, { recursive: true });
	const existing = new Set(fs.readdirSync(outputDir));
	const toProcess = files.filter((file) => !existing.has(toWebpName(file)));
	if (toProcess.length === 0) return;

	log(`Optimizing ${toProcess.length} MTG card image(s) for /mtg/...`);
	let done = 0;
	for (const file of toProcess) {
		await sharp(path.join(sourceDir, file))
			.resize({ width: WIDTH })
			.webp({ quality: 80 })
			.toFile(path.join(outputDir, toWebpName(file)));
		done++;
		if (done % 250 === 0) log(`${done}/${toProcess.length} optimized...`);
	}
	log(`MTG card image optimization: ${done} done, ${existing.size} already present.`);
}

function toWebpName(jpgFilename: string): string {
	return `${jpgFilename.slice(0, -".jpg".length)}.webp`;
}

export default function optimizeMtgImages(): AstroIntegration {
	return {
		name: "optimize-mtg-images",
		hooks: {
			"astro:build:start": async ({ logger }) => {
				await optimize((message) => logger.info(message));
			},
			"astro:server:setup": async ({ logger }) => {
				await optimize((message) => logger.info(message));
			},
		},
	};
}
