import { getCollection } from "astro:content";
import { getAllPosts } from "@/data/blog";

interface SyndicatedData {
	title: string;
	description?: string | undefined;
	syndicateText?: string | undefined;
}

function toEntry(path: string, data: SyndicatedData, image: string) {
	const site = import.meta.env.SITE;
	return {
		url: new URL(path, site).href,
		title: data.title,
		description: data.description ?? "",
		text: data.syndicateText ?? [data.title, data.description].filter(Boolean).join("\n\n"),
		image: new URL(image, site).href,
	};
}

export const GET = async () => {
	const posts = (await getAllPosts()).filter(({ data }) => data.syndicate);
	const notes = await getCollection("note", ({ data }) => data.syndicate);

	const entries = [
		...posts.map((post) =>
			toEntry(`blog/${post.id}/`, post.data, post.data.ogImage ?? `/og-image/${post.id}.png`),
		),
		...notes.map((note) => toEntry(`notes/${note.id}/`, note.data, "/social-card.png")),
	];

	return new Response(JSON.stringify({ version: 1, entries }, null, "\t"), {
		headers: { "Content-Type": "application/json" },
	});
};
