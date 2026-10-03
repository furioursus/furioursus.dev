// Read-only: shows what the next production deploy would post — see docs/syndication.md.
// Usage: npm run build && npm run syndicate:preview [-- --site=https://www.furioursus.dev/]

import {
	blueskyText,
	fetchLiveManifest,
	mastodonStatus,
	newEntries,
	readBuiltManifest,
} from "../plugins/syndicate/lib.js";

const siteArg = process.argv.find((arg) => arg.startsWith("--site="));
const site = siteArg ? siteArg.slice("--site=".length) : "https://www.furioursus.dev/";

const built = await readBuiltManifest("dist");
console.log(`${built.length} flagged entr${built.length === 1 ? "y" : "ies"} in dist/.`);

let live;
try {
	live = await fetchLiveManifest(site);
} catch (error) {
	console.log(`Live manifest unavailable (${error.message}): a deploy now would post nothing.`);
	process.exit(0);
}

const pending = newEntries(built, live);
if (pending.length === 0) {
	console.log("Nothing new: a deploy now would post nothing.");
	process.exit(0);
}

for (const entry of pending) {
	console.log(`\n── ${entry.url}`);
	console.log(`\n[Bluesky] card: ${entry.title} · ${entry.image}\n${blueskyText(entry)}`);
	console.log(`\n[Mastodon]\n${mastodonStatus(entry)}`);
}
