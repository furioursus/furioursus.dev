import type { Image, Nodes, Parents } from "mdast";
import { toString as mdastToString } from "mdast-util-to-string";
import getReadingTime from "reading-time";
import type { HastPluginDefinition, MdastPluginDefinition } from "satteri";

export function satteriAutolinkHeadingsPlugin(): HastPluginDefinition {
	return {
		name: "site-autolink-headings",
		element: {
			filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
			visit(node) {
				const id = node.properties?.id;
				if (typeof id !== "string" || !id) return;
				return {
					...node,
					children: [
						{
							type: "element",
							tagName: "a",
							properties: { href: `#${id}`, className: ["not-prose"] },
							children: [...node.children],
						},
					],
				};
			},
		},
	};
}

export function satteriReadingTimePlugin(): () => MdastPluginDefinition {
	return () => {
		let done = false;
		return {
			name: "site-reading-time",
			text(node, ctx) {
				if (done) return;

				let root: Readonly<Nodes> = node;
				let parent: Readonly<Parents> | undefined = ctx.parent(root);
				while (parent) {
					root = parent;
					parent = ctx.parent(root);
				}

				done = true;
				const textOnPage = mdastToString(root);
				const readingTime = getReadingTime(textOnPage);

				ctx.data.astro!.frontmatter.readingTime = readingTime.text;
			},
		};
	};
}

export function satteriUnwrapImagesPlugin(): MdastPluginDefinition {
	return {
		name: "site-unwrap-images",
		paragraph(node): Image | undefined {
			const child = node.children[0];
			if (node.children.length === 1 && child?.type === "image") {
				return child;
			}
			return;
		},
	};
}

// A caption paragraph, built fresh on each call — the trigger and dialog each
// need their own node instance, not two references to the same object.
function lightboxCaptionNode(text: string) {
	return {
		type: "element" as const,
		tagName: "p",
		properties: { className: ["lightbox-caption"] },
		children: [{ type: "text" as const, value: text }],
	};
}

export function satteriLightboxImagesPlugin(): HastPluginDefinition {
	return {
		name: "site-lightbox-images",
		element: {
			filter: ["img"],
			visit(node) {
				// Markdown's optional image title (`![alt](src "caption")`) is
				// otherwise unused here — its presence doubles as the per-image
				// opt-in for a visible caption, since plain markdown has no other
				// way to pass a flag per image. `alt` isn't used as a fallback:
				// it's required on every image already, so defaulting to it would
				// force a caption onto every image rather than making it optional.
				const caption =
					typeof node.properties?.title === "string" && node.properties.title
						? node.properties.title
						: undefined;

				return {
					type: "element",
					tagName: "lightbox-image",
					properties: { className: ["not-prose", "lightbox"] },
					children: [
						{
							type: "element",
							tagName: "button",
							properties: {
								type: "button",
								className: ["lightbox-trigger"],
								"aria-haspopup": "dialog",
							},
							children: [{ ...node }],
						},
						...(caption ? [lightboxCaptionNode(caption)] : []),
						{
							type: "element",
							tagName: "dialog",
							properties: { className: ["lightbox-dialog"] },
							children: [
								{
									type: "element",
									tagName: "button",
									properties: {
										type: "button",
										className: ["lightbox-icon-button", "lightbox-close"],
										"aria-label": "Close image",
									},
									children: [],
								},
								// Only shown when Lightbox.astro's script finds this dialog inside a
								// [data-lightbox-gallery] with more than one navigable member — see
								// docs/lightbox.md's "Gallery grouping and navigation". `hidden` by
								// default here for the same reason RecordCard.astro/LightboxImage.astro
								// render them hidden too: no per-image way to know at author time
								// whether a markdown image will end up inside a gallery container.
								{
									type: "element",
									tagName: "button",
									properties: {
										type: "button",
										className: ["lightbox-icon-button", "lightbox-nav-prev"],
										"aria-label": "Previous image",
										hidden: true,
									},
									children: [],
								},
								{
									type: "element",
									tagName: "button",
									properties: {
										type: "button",
										className: ["lightbox-icon-button", "lightbox-nav-next"],
										"aria-label": "Next image",
										hidden: true,
									},
									children: [],
								},
								...(caption ? [lightboxCaptionNode(caption)] : []),
							],
						},
					],
				};
			},
		},
	};
}

export function satteriFootnoteLabelPlugin(): HastPluginDefinition {
	return {
		name: "site-footnote-label",
		element: {
			filter: ["h2"],
			visit(node, ctx) {
				if (node.properties?.id !== "footnote-label") return;
				ctx.setProperty(node, "className", [""]);
			},
		},
	};
}

export function satteriExternalLinksPlugin(): HastPluginDefinition {
	return {
		name: "site-external-links",
		element: {
			filter: ["a"],
			visit(node, ctx) {
				const href = node.properties?.href;
				if (typeof href !== "string" || !href) return;

				let url: URL;
				try {
					url = new URL(href);
				} catch {
					return; // relative path or fragment, not "external"
				}

				if (url.protocol !== "http:" && url.protocol !== "https:") return;

				ctx.setProperty(node, "rel", ["noreferrer", "noopener"]);
				ctx.setProperty(node, "target", "_blank");
			},
		},
	};
}
