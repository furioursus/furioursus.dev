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
				sm: {
					css: {
						code: {
							fontSize: "var(--text-sm)",
							fontWeight: "400",
						},
					},
				},
			}),
		},
	},
} satisfies Config;
