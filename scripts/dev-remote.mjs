#!/usr/bin/env node
// scripts/dev-remote.mjs
//
// Starts `astro dev` bound to every interface so the dev server is reachable over Tailscale, and
// prints the tailnet URL plus a QR code for scanning onto a phone. See docs/dev-server.md.
//
//   npm run dev:remote

import { spawn, spawnSync } from "node:child_process";

// macOS installs the GUI app's CLI here; the Homebrew/Linux binary is just on PATH.
const TAILSCALE_BINS = ["tailscale", "/Applications/Tailscale.app/Contents/MacOS/Tailscale"];

const PORT = process.env.PORT ?? "4321";

/** The machine's own MagicDNS name (`hostname.tailnet.ts.net`), or null if Tailscale isn't up. */
function detectTailscaleHost() {
	for (const bin of TAILSCALE_BINS) {
		const { status, stdout } = spawnSync(bin, ["status", "--json"], { encoding: "utf8" });
		if (status !== 0 || !stdout) continue;
		try {
			const dnsName = JSON.parse(stdout).Self?.DNSName;
			if (dnsName) return dnsName.replace(/\.$/, ""); // MagicDNS names come fully-qualified
		} catch {
			// malformed output — fall through and try the next candidate binary
		}
	}
	return null;
}

const host = process.env.TAILSCALE_HOST ?? detectTailscaleHost();

if (!host) {
	console.error(
		"\n  Couldn't find a Tailscale hostname — is Tailscale running and logged in?\n" +
			"  Override the lookup with TAILSCALE_HOST=<name>.<tailnet>.ts.net if you know it.\n",
	);
	process.exit(1);
}

const url = `http://${host}:${PORT}/`;

console.log(`\n  Serving over Tailscale at ${url}\n`);

try {
	const { default: qrcode } = await import("qrcode-terminal");
	// `small: true` uses half-block glyphs so the code fits an 80-col terminal. The renderer only
	// draws to a real TTY — piping this script's output shows a blank gap here, not a bug.
	qrcode.generate(url, { small: true });
} catch {
	console.log("  (install qrcode-terminal for a scannable QR code)\n");
}

// Delegates to `npm run dev` rather than calling `astro dev` directly so this inherits the predev
// sanitize-dates pass; npm appends `--host` to the end of that script's command string, which
// lands on `astro dev`.
//
// TAILSCALE_HOST is passed through so astro.config.ts can add it to vite's allowedHosts — without
// it Vite rejects the request by Host header and dev serves a blank "host not allowed" page.
const child = spawn("npm", ["run", "dev", "--", "--host"], {
	stdio: "inherit",
	env: { ...process.env, TAILSCALE_HOST: host },
});

child.on("exit", (code) => process.exit(code ?? 0));
