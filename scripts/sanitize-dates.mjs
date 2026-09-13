#!/usr/bin/env node
// scripts/sanitize-dates.mjs
//
// Astro Editor <https://astroeditor.danny.is/> isn't aware of this repo's content conventions
// (see docs/content-model.md) and leaves two kinds of raw YYYY-MM-DD behind:
//
//   1. publishDate/updatedDate written as a bare date, not the strict ISO-8601-with-offset
//      z.iso.datetime({ offset: true }) requires (src/content.config.ts) — e.g. `2024-01-01`
//      instead of `"2024-01-01T00:00:00Z"`.
//   2. A brand-new post/note saved with the file itself named after today's date
//      (`2026-09-03.md`) rather than a slug — since the glob loader derives a collection
//      entry's `id`/URL from the filename, that date ends up as the post's actual `/blog/[id]/`
//      URL.
//
// This fixes both: rewrites bare dates to strict ISO, and renames any `YYYY-MM-DD.md(x)` file to
// a slug derived from its `title` field (matching Decap's own slugify — lowercase, strip
// diacritics, non-alphanumeric runs collapsed to `-`). Already-correct files are left untouched,
// so it's safe to run repeatedly.
//
//   npm run sanitize:dates
//
// Add --check to report without writing/renaming (exits 1 if anything needs fixing) — e.g. as a
// pre-build guard in CI.
//
// Add --watch to run once and then keep re-running on every change under the content dirs, so
// Astro Editor's bare dates and date-named files get fixed the moment they're saved during a dev
// session — see `npm run dev`, which starts this in the background alongside `astro dev`. Uses
// fs.watch's recursive option, which is macOS/Windows only (not Linux) — fine for local dev, not
// something to rely on in CI.
//
// Frontmatter is read with a small line-based regex, not a full YAML parser (matching how little
// of it this actually needs to touch) — an unusual title (multiline, embedded `title:`-looking
// text) could confuse the slug derivation. Review a rename before committing it.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
// tag entries have no date field (src/content.config.ts) but can still be filename-dated.
const DATE_FIELD_DIRS = ["src/content/blog", "src/content/notes"];
const ALL_CONTENT_DIRS = [...DATE_FIELD_DIRS, "src/content/tags"];
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
const DATE_FIELD = /^(\s*(?:publishDate|updatedDate):\s*)(['"]?)(\d{4}-\d{2}-\d{2})\2\s*$/;
const TITLE_FIELD = /^\s*title:\s*(['"]?)(.*)\1\s*$/m;
const DATE_FILENAME = /^\d{4}-\d{2}-\d{2}$/;

const checkOnly = process.argv.includes("--check");
const watch = process.argv.includes("--watch");

function walk(dir) {
	let entries;
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch (err) {
		if (err.code === "ENOENT") return []; // e.g. src/content/tags/ — no override files exist yet
		throw err;
	}

	let files = [];
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) files = files.concat(walk(full));
		else if (/\.mdx?$/.test(entry.name)) files.push(full);
	}
	return files;
}

function slugify(title) {
	return title
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "") // strip accents, e.g. "café" -> "cafe"
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

// Only touches date fields inside the frontmatter block itself — a body that happens to mention
// "publishDate:" in prose or a code sample shouldn't get rewritten.
function sanitizeDateFields(content) {
	const match = content.match(FRONTMATTER);
	if (!match) return { content, changed: false };

	const frontmatter = match[1];
	let changed = false;
	const fixed = frontmatter
		.split("\n")
		.map((line) => {
			const m = line.match(DATE_FIELD);
			if (!m) return line;
			changed = true;
			return `${m[1]}"${m[3]}T00:00:00Z"`;
		})
		.join("\n");

	if (!changed) return { content, changed: false };

	const start = match.index + match[0].indexOf(frontmatter);
	const next = content.slice(0, start) + fixed + content.slice(start + frontmatter.length);
	return { content: next, changed: true };
}

// Renames a `YYYY-MM-DD.md(x)` file to a slug derived from its title, so the glob loader's
// filename-derived `id` (and thus the entry's URL) reflects the post, not the day it was saved.
// Returns the file's new path (or the original if no rename was needed/possible).
function renameIfDateNamed(file) {
	const ext = path.extname(file);
	const base = path.basename(file, ext);
	if (!DATE_FILENAME.test(base)) return { file, renamed: false };

	const content = fs.readFileSync(file, "utf-8");
	const titleMatch = content.match(TITLE_FIELD);
	const title = titleMatch?.[2]?.trim();
	if (!title) {
		console.warn(
			`  ! ${path.relative(ROOT, file)}: date-named but no title to slugify from — skipping rename`,
		);
		return { file, renamed: false };
	}

	const dir = path.dirname(file);
	const slug = slugify(title) || base;
	let candidate = path.join(dir, `${slug}${ext}`);
	let suffix = 2;
	while (fs.existsSync(candidate) && candidate !== file) {
		candidate = path.join(dir, `${slug}-${suffix}${ext}`);
		suffix += 1;
	}

	if (!checkOnly) fs.renameSync(file, candidate);
	return { file: checkOnly ? file : candidate, renamed: true, from: file, to: candidate };
}

function main() {
	const renamed = [];
	for (const dir of ALL_CONTENT_DIRS) {
		for (const file of walk(path.join(ROOT, dir))) {
			const result = renameIfDateNamed(file);
			if (result.renamed) renamed.push(result);
		}
	}

	const dateFixed = [];
	for (const dir of DATE_FIELD_DIRS) {
		for (const file of walk(path.join(ROOT, dir))) {
			const original = fs.readFileSync(file, "utf-8");
			const { content, changed } = sanitizeDateFields(original);
			if (!changed) continue;
			dateFixed.push(path.relative(ROOT, file));
			if (!checkOnly) fs.writeFileSync(file, content);
		}
	}

	if (renamed.length === 0 && dateFixed.length === 0) {
		console.log(
			"Nothing to sanitize — filenames and publishDate/updatedDate values all look right.",
		);
		return;
	}

	if (renamed.length > 0) {
		console.log(`${renamed.length} date-named file(s) ${checkOnly ? "need" : "were"} renamed:`);
		for (const r of renamed) {
			console.log(
				`  ${checkOnly ? "✗" : "✓"} ${path.relative(ROOT, r.from)} -> ${path.relative(ROOT, r.to)}`,
			);
		}
	}
	if (dateFixed.length > 0) {
		console.log(`${dateFixed.length} file(s) ${checkOnly ? "need" : "had"} date fixes:`);
		for (const file of dateFixed) console.log(`  ${checkOnly ? "✗" : "✓"} ${file}`);
	}

	if (checkOnly) process.exitCode = 1;
}

main();

if (watch) {
	console.log("\nWatching src/content/{blog,notes,tags} for bare dates and date-named files...");

	// Astro Editor's writes (and our own fixes) fire several fs events in quick succession —
	// debounce so one save triggers one pass instead of a handful of overlapping ones.
	let pending = null;
	const rerun = () => {
		clearTimeout(pending);
		pending = setTimeout(main, 150);
	};

	for (const dir of ALL_CONTENT_DIRS) {
		try {
			fs.watch(path.join(ROOT, dir), { recursive: true }, (_event, filename) => {
				if (filename && /\.mdx?$/.test(filename)) rerun();
			});
		} catch (err) {
			if (err.code !== "ENOENT") throw err; // e.g. src/content/tags/ — no override files exist yet
		}
	}
}
