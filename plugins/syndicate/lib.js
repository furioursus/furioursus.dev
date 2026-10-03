// Shared by the syndicate build plugin and scripts/syndicate-preview.mjs — see docs/syndication.md.

import { readFile } from "node:fs/promises";
import path from "node:path";

export const MANIFEST_PATH = "syndicate.json";

// Bluesky counts graphemes, Mastodon counts code points with every URL as 23.
const BLUESKY_TEXT_LIMIT = 300;
const MASTODON_TEXT_LIMIT = 500 - 23 - 2;
const BLUESKY_THUMB_MAX_BYTES = 976_560;

const graphemes = new Intl.Segmenter("en", { granularity: "grapheme" });

function truncate(units, max) {
	if (units.length <= max) return units.join("");
	return `${units
		.slice(0, max - 1)
		.join("")
		.trimEnd()}…`;
}

function parseManifest(json) {
	if (!Array.isArray(json?.entries)) throw new Error("manifest has no `entries` array");
	return json.entries;
}

export async function readBuiltManifest(publishDir) {
	return parseManifest(JSON.parse(await readFile(path.join(publishDir, MANIFEST_PATH), "utf8")));
}

export async function fetchLiveManifest(siteUrl) {
	const res = await fetch(new URL(`/${MANIFEST_PATH}`, siteUrl));
	if (!res.ok) throw new Error(`live ${MANIFEST_PATH} responded ${res.status}`);
	return parseManifest(await res.json());
}

export function newEntries(built, live) {
	const seen = new Set(live.map((entry) => entry.url));
	return built.filter((entry) => !seen.has(entry.url));
}

export function blueskyText(entry) {
	return truncate(
		[...graphemes.segment(entry.text)].map((s) => s.segment),
		BLUESKY_TEXT_LIMIT,
	);
}

export function mastodonStatus(entry) {
	return `${truncate([...entry.text], MASTODON_TEXT_LIMIT)}\n\n${entry.url}`;
}

async function xrpc(service, method, { token, body, contentType = "application/json" }) {
	const res = await fetch(new URL(`/xrpc/${method}`, service), {
		method: "POST",
		headers: { "Content-Type": contentType, ...(token && { Authorization: `Bearer ${token}` }) },
		body: contentType === "application/json" ? JSON.stringify(body) : body,
	});
	if (!res.ok) throw new Error(`${method} responded ${res.status}: ${await res.text()}`);
	return res.json();
}

function createBluesky(env) {
	const entryway = env.BLUESKY_SERVICE || "https://bsky.social";
	let session;

	async function login() {
		const created = await xrpc(entryway, "com.atproto.server.createSession", {
			body: { identifier: env.BLUESKY_HANDLE, password: env.BLUESKY_APP_PASSWORD },
		});
		const pds = created.didDoc?.service?.find((s) => s.id === "#atproto_pds")?.serviceEndpoint;
		return { ...created, pds: pds || entryway };
	}

	async function uploadThumb(imageUrl) {
		try {
			const res = await fetch(imageUrl);
			if (!res.ok) return undefined;
			const bytes = new Uint8Array(await res.arrayBuffer());
			if (bytes.byteLength > BLUESKY_THUMB_MAX_BYTES) return undefined;
			const { blob } = await xrpc(session.pds, "com.atproto.repo.uploadBlob", {
				token: session.accessJwt,
				body: bytes,
				contentType: res.headers.get("content-type") || "image/png",
			});
			return blob;
		} catch (error) {
			console.warn(`[syndicate] Bluesky thumbnail skipped: ${error.message}`);
			return undefined;
		}
	}

	return {
		name: "Bluesky",
		enabled: Boolean(env.BLUESKY_HANDLE && env.BLUESKY_APP_PASSWORD),
		preview: blueskyText,
		async post(entry) {
			session ??= await login();
			const thumb = await uploadThumb(entry.image);
			const { uri } = await xrpc(session.pds, "com.atproto.repo.createRecord", {
				token: session.accessJwt,
				body: {
					repo: session.did,
					collection: "app.bsky.feed.post",
					record: {
						$type: "app.bsky.feed.post",
						text: blueskyText(entry),
						createdAt: new Date().toISOString(),
						langs: ["en"],
						embed: {
							$type: "app.bsky.embed.external",
							external: {
								uri: entry.url,
								title: entry.title,
								description: entry.description,
								...(thumb && { thumb }),
							},
						},
					},
				},
			});
			return `https://bsky.app/profile/${session.handle}/post/${uri.split("/").pop()}`;
		},
	};
}

function createMastodon(env) {
	return {
		name: "Mastodon",
		enabled: Boolean(env.MASTODON_INSTANCE && env.MASTODON_ACCESS_TOKEN),
		preview: mastodonStatus,
		async post(entry) {
			const res = await fetch(new URL("/api/v1/statuses", env.MASTODON_INSTANCE), {
				method: "POST",
				headers: {
					Authorization: `Bearer ${env.MASTODON_ACCESS_TOKEN}`,
					"Content-Type": "application/json",
					"Idempotency-Key": entry.url,
				},
				body: JSON.stringify({
					status: mastodonStatus(entry),
					visibility: "public",
					language: "en",
				}),
			});
			if (!res.ok) throw new Error(`statuses responded ${res.status}: ${await res.text()}`);
			return (await res.json()).url;
		},
	};
}

export function networks(env) {
	return [createBluesky(env), createMastodon(env)];
}

async function isLive(url, { attempts = 3, delayMs = 5000 } = {}) {
	for (let i = 0; i < attempts; i++) {
		try {
			if ((await fetch(url, { method: "HEAD" })).ok) return true;
		} catch {}
		if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, delayMs));
	}
	return false;
}

/** Posts each entry to every enabled network. Never throws; returns one result per attempt. */
export async function syndicate(entries, { env, dryRun, liveCheck }) {
	const enabled = networks(env).filter((network) => network.enabled);
	const results = [];

	for (const entry of entries) {
		if (!dryRun && !(await isLive(entry.url, liveCheck))) {
			results.push({ entry, network: "all", ok: false, error: "entry URL isn't live" });
			continue;
		}
		for (const network of enabled) {
			if (dryRun) {
				console.log(
					`[syndicate] DRY RUN ${network.name} ← ${entry.url}\n${network.preview(entry)}`,
				);
				results.push({ entry, network: network.name, ok: true, dryRun: true });
				continue;
			}
			try {
				const url = await network.post(entry);
				results.push({ entry, network: network.name, ok: true, url });
			} catch (error) {
				results.push({ entry, network: network.name, ok: false, error: error.message });
			}
		}
	}

	return { enabled: enabled.map((network) => network.name), results };
}
