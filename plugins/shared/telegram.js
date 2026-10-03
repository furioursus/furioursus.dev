// Shared by the local Netlify build plugins — see docs/deploy-notifications.md.
// TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID live in Netlify's environment variables, never in this
// public repo.

// Telegram's `parse_mode: "HTML"` treats <, >, and & as markup; escape any freeform text.
export function escapeHtml(text) {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Never throws: a notification hiccup must not take the deploy down with it.
export async function sendTelegramMessage(text, tag = "telegram") {
	const token = process.env.TELEGRAM_BOT_TOKEN;
	const chatId = process.env.TELEGRAM_CHAT_ID;

	if (!token || !chatId) {
		console.warn(`[${tag}] Skipping Telegram: TELEGRAM_BOT_TOKEN and/or TELEGRAM_CHAT_ID not set.`);
		return;
	}

	try {
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
			console.warn(`[${tag}] Telegram API responded ${res.status}: ${await res.text()}`);
		}
	} catch (error) {
		console.warn(`[${tag}] Telegram request failed: ${error.message}`);
	}
}
