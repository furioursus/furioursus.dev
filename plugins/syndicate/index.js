// Local Netlify Build Plugin — see docs/syndication.md.
// Credentials live in Netlify's environment variables, never in this public repo.

import { readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { escapeHtml, sendTelegramMessage } from "../shared/telegram.js";
import { fetchLiveManifest, newEntries, readBuiltManifest, syndicate } from "./lib.js";

const TAG = "syndicate";
const PENDING_FILE = path.join(os.tmpdir(), "furioursus-syndicate-pending.json");
const MAX_PER_DEPLOY = Number(process.env.SYNDICATE_MAX_PER_DEPLOY) || 3;

const notify = (text) => sendTelegramMessage(`🔁 <b>syndicate</b>\n${text}`, TAG);

// Diff against the live manifest has to happen before the deploy replaces it.
export async function onPostBuild({ constants }) {
	await writeFile(PENDING_FILE, "[]");

	if (process.env.CONTEXT !== "production") {
		console.log(`[${TAG}] Skipping: ${process.env.CONTEXT ?? "local"} isn't a production deploy.`);
		return;
	}

	try {
		const built = await readBuiltManifest(constants.PUBLISH_DIR);
		const live = await fetchLiveManifest(process.env.URL);
		const pending = newEntries(built, live);

		if (pending.length > MAX_PER_DEPLOY) {
			const list = pending.map((entry) => `• ${escapeHtml(entry.url)}`).join("\n");
			console.warn(
				`[${TAG}] ${pending.length} new entries exceeds ${MAX_PER_DEPLOY}; posting none.`,
			);
			await notify(
				`⚠️ ${pending.length} new flagged entries (max ${MAX_PER_DEPLOY}), posted none:\n${list}`,
			);
			return;
		}

		await writeFile(PENDING_FILE, JSON.stringify(pending));
		console.log(
			`[${TAG}] ${pending.length} new flagged entr${pending.length === 1 ? "y" : "ies"}.`,
		);
	} catch (error) {
		console.warn(`[${TAG}] Posting nothing: ${error.message}`);
		await notify(
			`⚠️ couldn't diff manifests, posted nothing\n<pre>${escapeHtml(error.message)}</pre>`,
		);
	}
}

export async function onSuccess() {
	let pending = [];
	try {
		pending = JSON.parse(await readFile(PENDING_FILE, "utf8"));
		await rm(PENDING_FILE, { force: true });
	} catch {}
	if (pending.length === 0) return;

	const dryRun = process.env.SYNDICATE_ENABLED !== "true";
	const { enabled, results } = await syndicate(pending, { env: process.env, dryRun });

	if (enabled.length === 0) {
		await notify("⚠️ flagged entries found but no network credentials are set, posted nothing");
		return;
	}

	const lines = results.map(({ entry, network, ok, url, error, dryRun: dry }) => {
		const target = escapeHtml(entry.url);
		if (dry) return `🧪 ${network} (dry run) · ${target}`;
		if (ok) return `✅ ${network} · ${escapeHtml(url ?? target)}`;
		return `❌ ${network} · ${target}\n<pre>${escapeHtml(String(error).slice(0, 300))}</pre>`;
	});
	console.log(`[${TAG}]\n${lines.join("\n")}`);
	await notify(lines.join("\n"));
}
