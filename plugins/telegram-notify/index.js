// Local Netlify Build Plugin — see docs/deploy-notifications.md.
//
// Runs inside Netlify's own build process (no relay server needed) and posts to Telegram's Bot
// API directly. TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set as Netlify environment
// variables (Site settings → Environment variables) — never hardcode them here or in
// netlify.toml, both of which are committed to this public repo.

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

// SITE_NAME/URL/CONTEXT/BRANCH/COMMIT_REF are standard Netlify build environment variables —
// see https://docs.netlify.com/configure-builds/environment-variables/.
export async function onSuccess() {
	const site = process.env.SITE_NAME ?? "site";
	const url = process.env.DEPLOY_PRIME_URL ?? process.env.URL;
	const context = process.env.CONTEXT ?? "unknown";
	const branch = process.env.BRANCH ?? "unknown";

	await sendTelegramMessage(
		`✅ <b>${site}</b> deploy succeeded\n` +
			`${context} · <code>${branch}</code>\n` +
			(url ? url : ""),
	);
}

export async function onError({ error }) {
	const site = process.env.SITE_NAME ?? "site";
	const context = process.env.CONTEXT ?? "unknown";
	const branch = process.env.BRANCH ?? "unknown";
	// Telegram caps messages at 4096 chars; keep this well under that so it stays skimmable in a
	// chat notification rather than dumping a full stack trace.
	const message = (error?.message ?? String(error)).slice(0, 500);

	await sendTelegramMessage(
		`❌ <b>${site}</b> deploy failed\n` +
			`${context} · <code>${branch}</code>\n` +
			`<pre>${message}</pre>`,
	);
}
