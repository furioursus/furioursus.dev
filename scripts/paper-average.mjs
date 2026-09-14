#!/usr/bin/env node
// scripts/paper-average.mjs
//
// Prints each paper tile's average color, which is what --color-global-bg is set to in
// global.css (and duplicated in BaseHead.astro + ThemeProvider.astro). Run it after
// regenerating a tile and paste the reported hsla/hex into those three places.
// See docs/theming.md.
//
//   npm run paper:average

import sharp from "sharp";

const TILES = {
	light: "src/assets/images/paper-light.webp",
	dark: "src/assets/images/paper-dark.webp",
};

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

/** sRGB triple in 0-1 -> [h deg, s %, l %]. */
function toHsl([r, g, b]) {
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const d = max - min;
	const l = (max + min) / 2;
	if (!d) return [0, 0, l * 100];
	const s = d / (1 - Math.abs(2 * l - 1));
	const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
	return [(h * 60 + 360) % 360, s * 100, l * 100];
}

for (const [theme, file] of Object.entries(TILES)) {
	const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
	const pixels = info.width * info.height;

	// Averaged in LINEAR light, not gamma-encoded sRGB: optical mixing is linear, so this is the
	// flat color the tile actually blurs to. The two agree to the same byte on these particular
	// low-contrast tiles, but they diverge as soon as a tile's range widens — don't "simplify"
	// this to a mean of the raw bytes.
	const sum = [0, 0, 0];
	for (let i = 0; i < pixels; i++) {
		const p = i * info.channels;
		for (let c = 0; c < 3; c++) sum[c] += toLinear(data[p + c] / 255);
	}

	const bytes = sum.map((v) => Math.round(toSrgb(v / pixels) * 255));
	const hex = `#${bytes.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
	// Derived from the ROUNDED bytes, not the float average, so the two forms printed below are
	// the same color — off the floats they disagree by a byte and the hsla stops round-tripping.
	const [h, s, l] = toHsl(bytes.map((v) => v / 255));

	console.log(
		`${theme.padEnd(5)} ${file}\n` +
			`      ${hex}   hsla(${h.toFixed(0)}, ${s.toFixed(0)}%, ${l.toFixed(1)}%, 1)\n`,
	);
}
