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
	loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
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
			// Strict, so a freeform date fails the build instead of silently mis-parsing — hand-edited
			// frontmatter only; Decap already writes this format. See docs/content-model.md.
			publishDate: z.iso.datetime({ offset: true }).transform((val) => new Date(val)),
			updatedDate: z.iso
				.datetime({ offset: true })
				.optional()
				.transform((val) => (val ? new Date(val) : undefined)),
			pinned: z.boolean().default(false),
		}),
});

const note = defineCollection({
	loader: glob({ base: "./src/content/notes", pattern: "**/*.{md,mdx}" }),
	schema: baseSchema.extend({
		description: z.string().optional(),
		publishDate: z.iso.datetime({ offset: true }).transform((val) => new Date(val)),
	}),
});

const tag = defineCollection({
	loader: glob({ base: "./src/content/tags", pattern: "**/*.{md,mdx}" }),
	schema: z.object({
		title: titleSchema.optional(),
		description: z.string().optional(),
	}),
});

export const collections = { blog, note, tag };
