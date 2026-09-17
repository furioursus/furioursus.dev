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
			// Standard "small UI text" size — captions, meta lines, tab labels, section headers —
			// used across Last.fm/RecordCard components. Between Tailwind's default xs (0.75rem)
			// and sm (0.875rem); named 2xs to match the common community convention for this size.
			fontSize: {
				"2xs": "0.8rem",
				// Page-title scale, used by `.title` in global.css and nothing else. Two steps
				// rather than one because the 48px desktop size wraps a short headline onto three
				// lines on a 375px screen; see docs/theming.md for the full scale and its ratios.
				title: ["2.25rem", { lineHeight: "2.5rem" }],
				"title-lg": ["3rem", { lineHeight: "3.25rem" }],
			},
			// A separate micro-spacing scale for the handful of compact UI elements that need
			// finer steps than Tailwind's own 0.25rem-based spacing scale offers — "tight-N" keys
			// so they read as whole numbers (tight-1, tight-4, ...) without colliding with
			// spacing's own existing numeric keys (spacing-1 is already 0.25rem, spacing-4 is
			// already 1rem, etc.) — this is a distinct scale, not an extension of that one, so N
			// here means tenths of a rem, not multiples of the 0.25rem base unit.
			spacing: {
				// Tight vertical margin on a title/name sitting close to an adjacent line
				// (RecordCard, LastfmNowPlaying).
				"tight-1": "0.1rem",
				// Compact list-row / pill padding, standardized across RecordCard,
				// LastfmRankedList, LastfmNowPlaying, and LastfmListeningStats onto these three
				// steps (previously 0.3rem/0.4rem/0.6rem/0.8rem, hand-tuned per component).
				"tight-4": "0.4rem",
				"tight-6": "0.6rem",
				"tight-8": "0.8rem",
			},
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
			letterSpacing: {
				// Extra tracking on small uppercase labels (LastfmNowPlaying's status line,
				// LastfmRankedList's section heading) so the caps stay readable.
				label: "0.04em",
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
							border: "1px dotted #666",
							borderRadius: "2px",
						},
						kbd: {
							"&:where([data-theme='dark'], [data-theme='dark'] *)": {
								background: "var(--color-global-text)",
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
							borderTop: "1px dashed #666",
						},
						thead: {
							borderBottomWidth: "none",
						},
						"thead th": {
							borderBottom: "1px dashed #666",
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
