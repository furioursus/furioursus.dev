// Local Netlify Build Plugin — see docs/deploy-notifications.md.
//
// Runs inside Netlify's own build process (no relay server needed) and posts to Telegram's Bot
// API directly. TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set as Netlify environment
// variables (Site settings → Environment variables) — never hardcode them here or in
// netlify.toml, both of which are committed to this public repo.

import { execSync } from "node:child_process";

// Netlify's standard build env vars expose COMMIT_REF (the SHA) but not the message itself — the
// plugin runs inside the checked-out repo, so `git log` reads it straight from there. Subject
// line only (%s), not the full body, to keep the notification skimmable. Never throws: a shallow
// clone, a detached-HEAD edge case, or any other git hiccup should drop this line, not the build.
function getCommitMessage() {
	try {
		return execSync("git log -1 --pretty=%s", { encoding: "utf8" }).trim() || null;
	} catch {
		return null;
	}
}

// Telegram's `parse_mode: "HTML"` treats <, >, and & as markup — a commit subject is freeform
// text and can contain any of them (e.g. a stray "<" in a description), which would otherwise
// break the message's formatting or silently swallow part of it.
function escapeHtml(text) {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendTelegramMessage(text) {
	const token = process.env.TELEGRAM_BOT_TOKEN;
	const chatId = process.env.TELEGRAM_CHAT_ID;

	if (!token || !chatId) {
		// Missing credentials shouldn't ever fail a deploy over a notification — just skip, loudly,
		// in the build log.
		console.warn("[telegram-notify] Skipping: TELEGRAM_BOT_TOKEN and/or TELEGRAM_CHAT_ID not set.");
		return;
	}

	const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			chat_id: chatId,
			text,
			parse_mode: "HTML",
			disable_web_page_preview: true,
		}),
	});

	if (!res.ok) {
		// Same reasoning as above — a Telegram API hiccup (rate limit, bad chat id) shouldn't take
		// the site down with it.
		console.warn(`[telegram-notify] Telegram API responded ${res.status}: ${await res.text()}`);
	}
}

function pick(variants) {
	return variants[Math.floor(Math.random() * variants.length)];
}

// Each variant is [opening line, closing line] — the info line between them (context/branch,
// url or error) stays fixed across all of them, only the flavor text varies. `${site}` is
// interpolated into the opener at call time, not baked into these arrays, so it stays in one
// place rather than duplicated per variant.
const SUCCESS_VARIANTS = [
	[
		"🐾💨 <i>ZOOMIES</i> — {site} deployed clean and the tail will not stop waggin'!",
		"good build. good pup. 🦴",
	],
	[
		"🐕✨ {site} shipped without a hitch — ears up, tail up, all paws on deck!",
		"<i>happy borks</i> — nailed it.",
	],
	[
		"🦴🐾 {site} just fetched a clean deploy on the first throw.",
		"who's a good build? this build.",
	],
	["🐕💨 {site} deployed so smooth even the floof didn't ruffle.", "10/10, would deploy again."],
	[
		"🐾🌟 {site} rolled over, played dead, and still shipped perfect.",
		"good pup energy all around.",
	],
	["🐕🎾 {site} chased the deploy and CAUGHT it.", "proud tail wags incoming."],
];

const ERROR_VARIANTS = [
	[
		"🐾😖 <i>whimpers</i> — {site} tripped over its own paws and faceplanted.",
		"go sniff out the leash (the deploy log) before more zoomies happen 🐕",
	],
	[
		"🐕💢 ruh-roh — {site} dug a hole instead of a deploy.",
		"time to sniff around the build log for what got buried.",
	],
	[
		"🦴😬 {site} chased its tail and never caught the deploy.",
		"check the log — might need a treat and a nap first.",
	],
	[
		"🐾🚨 {site} got spooked mid-fetch and dropped the build.",
		"the deploy log has the scent, go track it down.",
	],
	[
		"🐕💥 {site} zoomied straight into a wall this time.",
		"shake it off and check what broke in the log.",
	],
	[
		"🐾😵 {site} rolled in something it shouldn't have — build's a mess.",
		"bath time (a.k.a. check the deploy log).",
	],
];

// SITE_NAME/URL/CONTEXT/BRANCH/COMMIT_REF are standard Netlify build environment variables —
// see https://docs.netlify.com/configure-builds/environment-variables/.
export async function onSuccess() {
	const site = process.env.SITE_NAME ?? "site";
	// `URL` is the site's actual domain (custom domain if verified), constant across every
	// deploy regardless of context. `DEPLOY_PRIME_URL` varies by context instead — it's the
	// custom domain only for a genuine production deploy, but a `<branch>--sitename.netlify.app`
	// link for a branch deploy — so it's the fallback here, not the primary.
	const url = process.env.URL ?? process.env.DEPLOY_PRIME_URL;
	const context = process.env.CONTEXT ?? "unknown";
	const branch = process.env.BRANCH ?? "unknown";
	const commitMessage = getCommitMessage();
	const [open, close] = pick(SUCCESS_VARIANTS);

	await sendTelegramMessage(
		`${open.replace("{site}", `<b>${site}</b>`)}\n` +
			`${context} · <code>${branch}</code>\n` +
			(commitMessage ? `💬 ${escapeHtml(commitMessage)}\n` : "") +
			(url ? `${url}\n` : "") +
			`\n${close}`,
	);
}

export async function onError({ error }) {
	const site = process.env.SITE_NAME ?? "site";
	const context = process.env.CONTEXT ?? "unknown";
	const branch = process.env.BRANCH ?? "unknown";
	const commitMessage = getCommitMessage();
	// Telegram caps messages at 4096 chars; keep this well under that so it stays skimmable in a
	// chat notification rather than dumping a full stack trace.
	const message = (error?.message ?? String(error)).slice(0, 500);
	const [open, close] = pick(ERROR_VARIANTS);

	await sendTelegramMessage(
		`${open.replace("{site}", `<b>${site}</b>`)}\n` +
			`${context} · <code>${branch}</code>\n` +
			(commitMessage ? `💬 ${escapeHtml(commitMessage)}\n` : "") +
			`<pre>${escapeHtml(message)}</pre>\n` +
			`\n${close}`,
	);
}
