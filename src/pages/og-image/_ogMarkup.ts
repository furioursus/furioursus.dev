import { html } from "satori-html";
import { siteConfig } from "@/site.config";

// OG image markup, use https://og-playground.vercel.app/ to design your own.
export const ogMarkup = (title: string, pubDate: string) =>
	// bg-[...]/border-[...] interpolate siteConfig.backgroundColor/themeColor — the same
	// webmanifest colors astro.config.ts sets, kept in sync from one place (see site.config.ts's
	// comment) rather than as separate hand-typed hex literals here.
	html`<div tw="flex flex-col w-full h-full bg-[${siteConfig.backgroundColor}] text-[#c9cacc]">
		<div tw="flex flex-col flex-1 w-full p-10 justify-center">
			<p tw="text-2xl mb-6">${pubDate}</p>
			<h1 tw="text-6xl font-bold leading-snug text-white">${title}</h1>
		</div>
		<div tw="flex items-center justify-between w-full p-10 border-t-2 border-[${siteConfig.themeColor}] text-white">
			<p tw="text-2xl ml-3 font-semibold">${siteConfig.title}</p>
			<p>by ${siteConfig.author}</p>
		</div>
	</div>`;
