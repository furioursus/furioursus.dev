import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

function removeDupsAndLowerCase(array: string[]) {
	return [...new Set(array.map((str) => str.toLowerCase()))];
}

const titleSchema = z.string().max(60);

const baseSchema = z.object({
	title: titleSchema,
});

const blog = defineCollection({
	loader: glob({ base: "./content/blog", pattern: "**/*.{md,mdx}" }),
	schema: ({ image }) =>
		baseSchema.extend({
			description: z.string(),
			coverImage: z
				.object({
					alt: z.string(),
					src: image(),
					// Caption shown below the image. Omitted/true → shows `alt`
					// (the default). A string → shows that instead, overriding `alt`.
					// null/false → no caption at all, opting out of the default.
					caption: z.union([z.string(), z.boolean(), z.null()]).optional(),
				})
				.optional(),
			draft: z.boolean().default(false),
			ogImage: z.string().optional(),
			tags: z.array(z.string()).default([]).transform(removeDupsAndLowerCase),
			// Strict ISO 8601 (with offset) — matches the `note` collection's schema below. Decap's
			// `datetime` widget (public/admin/config.yml) already writes this format by default, so
			// this doesn't change what the CMS produces, only what a hand-edited frontmatter value is
			// allowed to look like. Previously `z.string().or(z.date())` accepted anything
			// `new Date()` could parse — every post so far happened to parse correctly, but freeform
			// strings like "01 January 2024" aren't guaranteed consistent across JS engines/versions,
			// so a bad one would have silently mis-parsed instead of failing the build.
			publishDate: z.iso.datetime({ offset: true }).transform((val) => new Date(val)),
			updatedDate: z.iso
				.datetime({ offset: true })
				.optional()
				.transform((val) => (val ? new Date(val) : undefined)),
			pinned: z.boolean().default(false),
		}),
});

const note = defineCollection({
	loader: glob({ base: "./content/notes", pattern: "**/*.{md,mdx}" }),
	schema: baseSchema.extend({
		description: z.string().optional(),
		publishDate: z.iso
			.datetime({ offset: true }) // Ensures ISO 8601 format with offsets allowed (e.g. "2024-01-01T00:00:00Z" and "2024-01-01T00:00:00+02:00")
			.transform((val) => new Date(val)),
	}),
});

const tag = defineCollection({
	loader: glob({ base: "./content/tags", pattern: "**/*.{md,mdx}" }),
	schema: z.object({
		title: titleSchema.optional(),
		description: z.string().optional(),
	}),
});

export const collections = { blog, note, tag };
