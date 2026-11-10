import type { Config } from "tailwindcss";

export default {
	plugins: [require("@tailwindcss/typography")],
	theme: {
		extend: {
			// grid-cols-auto-1fr — repeated verbatim (5x as of writing) as the arbitrary
			// grid-cols-[auto_1fr] on every post-preview <li> (index.astro, blog/[...page].astro,
			// tags/[tag]/[...page].astro): PostPreview.astro's fixed-width date column beside its
			// flexible title/excerpt column. Named here so it reads as one deliberate layout
			// primitive instead of five separately hand-typed arbitrary values.
			gridTemplateColumns: {
				"auto-1fr": "auto 1fr",
			},
			// text-2xs, text-title(-lg), p-tight-* and tracking-label come from @furioursus/ui's
			// tokens (src/styles/global.css imports them). Don't redefine them here.
			// Magic: The Gathering's standard card ratio (2.5"×3.5", i.e. 63mm×88mm), reduced —
			// also the exact ratio of Scryfall's "normal" card images (488×680px), used both as
			// this Tailwind aspect-ratio utility (CardTile.astro's no-image placeholder) and as
			// the matching `aspectRatio` prop string passed to LightboxImage (a separate,
			// non-Tailwind convention — see its own prop docs) for the card art itself.
			aspectRatio: {
				card: "61/85",
			},
			lineHeight: {
				// LastfmRankedList's tightly-packed two-line (name + artist) rows.
				compact: "1.3",
			},
			typography: () => ({
				DEFAULT: {
					css: {
						// Headline face, everywhere `.prose` shows up (post/note bodies, About, tag
						// descriptions) — not just BlogPost.astro's own `prose-headings:*` utilities,
						// which only cover weight/color/anchor-link chrome for that one usage.
						"h1, h2, h3, h4, h5, h6": {
							fontFamily: "var(--font-display)",
						},
						a: {
							textUnderlineOffset: "2px",
							"&:hover": {
								"@media (hover: hover)": {
									textDecorationColor: "var(--color-link)",
									textDecorationThickness: "2px",
								},
							},
						},
						blockquote: {
							borderLeftWidth: "0",
						},
						code: {
							border: "1px dotted var(--color-hairline)",
							borderRadius: "2px",
						},
						kbd: {
							"&:where([data-theme='dark'], [data-theme='dark'] *)": {
								background: "var(--color-ink)",
							},
						},
						hr: {
							borderTopStyle: "dashed",
						},
						strong: {
							fontWeight: "700",
						},
						sup: {
							marginInlineStart: "calc(var(--spacing) * 0.5)",
							a: {
								"&:after": {
									content: "']'",
								},
								"&:before": {
									content: "'['",
								},
								"&:hover": {
									"@media (hover: hover)": {
										color: "var(--color-link)",
									},
								},
							},
						},
						/* Table */
						"tbody tr": {
							borderBottomWidth: "none",
						},
						tfoot: {
							borderTop: "1px dashed var(--color-hairline)",
						},
						thead: {
							borderBottomWidth: "none",
						},
						"thead th": {
							borderBottom: "1px dashed var(--color-hairline)",
							fontWeight: "700",
						},
						'th[align="center"], td[align="center"]': {
							"text-align": "center",
						},
						'th[align="right"], td[align="right"]': {
							"text-align": "right",
						},
						'th[align="left"], td[align="left"]': {
							"text-align": "left",
						},
						".expressive-code, .admonition, .github-card, .lightbox": {
							marginTop: "calc(var(--spacing)*4)",
							marginBottom: "calc(var(--spacing)*4)",
						},
					},
				},
				// Heading sizes are set per size-modifier rather than in DEFAULT because they are
				// `em`-relative: the same em value resolves differently against prose-sm's 14px
				// body and prose-lg's 18px. `sm` is the MOBILE step and `lg` is the desktop one
				// (the call sites read `prose-sm sm:prose-lg`). Targets are 36/30/20px on mobile
				// and 48/36/24px on desktop — see docs/theming.md.
				sm: {
					css: {
						code: {
							fontSize: "var(--text-sm)",
							fontWeight: "400",
						},
						// Matches `.title`'s 36px so a markdown-level h1 (the CV's name heading is the
						// only one in the content today) reads as the same rank as every other page
						// title, rather than landing on the typography plugin's own smaller default.
						h1: {
							fontSize: "2.5714em",
							lineHeight: "1.1111",
						},
						h2: {
							fontSize: "2.1429em",
							lineHeight: "1.2",
						},
						h3: {
							fontSize: "1.4286em",
							lineHeight: "1.3",
						},
					},
				},
				lg: {
					css: {
						code: {
							fontSize: "var(--text-sm)",
							fontWeight: "400",
						},
						// Matches `.title`'s 48px — see the base block above.
						h1: {
							fontSize: "2.6667em",
							lineHeight: "1.0833",
						},
						h2: {
							fontSize: "2em",
							lineHeight: "1.2222",
						},
						h3: {
							fontSize: "1.3333em",
							lineHeight: "1.25",
						},
					},
				},
			}),
		},
	},
} satisfies Config;
