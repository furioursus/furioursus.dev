import { h as _h, type Properties } from "hastscript";
import type { Paragraph } from "mdast";
// Type-only side-effect import: mdast-util-to-hast's index.d.ts is what augments mdast's `Data`
// with `hName`/`hProperties`. It used to reach the program incidentally (astro's
// @astrojs/markdown-remark depended on remark-rehype), but no longer does as of astro 7.3, so
// load the augmentation explicitly instead of relying on a hoisted transitive dependency.
import type {} from "mdast-util-to-hast";

/** From Astro Starlight: Function that generates an mdast HTML tree ready for conversion to HTML by rehype. */
// biome-ignore lint/suspicious/noExplicitAny: allow any children
export function h(el: string, attrs: Properties = {}, children: any[] = []): Paragraph {
	const { properties, tagName } = _h(el, attrs);
	return {
		children,
		data: { hName: tagName, hProperties: properties },
		type: "paragraph",
	};
}
