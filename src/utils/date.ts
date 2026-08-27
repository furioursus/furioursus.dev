import type { CollectionEntry } from "astro:content";
import { siteConfig } from "@/site.config";

export function getFormattedDate(
	date: Date | undefined,
	options?: Intl.DateTimeFormatOptions,
): string {
	if (date === undefined) {
		return "Invalid Date";
	}

	return new Intl.DateTimeFormat(siteConfig.lang, {
		...(siteConfig.date.options as Intl.DateTimeFormatOptions),
		...options,
	}).format(date);
}

export function collectionDateSort(
	a: CollectionEntry<"blog" | "note">,
	b: CollectionEntry<"blog" | "note">,
) {
	return b.data.publishDate.getTime() - a.data.publishDate.getTime();
}

// Just the singular units `getRelativeTime` actually reaches for — `Intl.RelativeTimeFormatUnit`
// also includes plural forms ("years", "quarters", ...) and "quarter", which would force DIVISORS
// below to fill in entries this function never produces.
type RelativeTimeUnit = "day" | "hour" | "minute" | "month" | "second" | "week" | "year";

const RELATIVE_TIME_UNITS: { limitSeconds: number; unit: RelativeTimeUnit }[] = [
	{ limitSeconds: 60, unit: "second" },
	{ limitSeconds: 3600, unit: "minute" },
	{ limitSeconds: 86400, unit: "hour" },
	{ limitSeconds: 604800, unit: "day" },
	{ limitSeconds: 2629800, unit: "week" },
	{ limitSeconds: 31557600, unit: "month" },
	{ limitSeconds: Number.POSITIVE_INFINITY, unit: "year" },
];

const DIVISORS: Record<RelativeTimeUnit, number> = {
	second: 1,
	minute: 60,
	hour: 3600,
	day: 86400,
	week: 604800,
	month: 2629800,
	year: 31557600,
};

/** e.g. "3 hours ago" — used by the Last.fm now-playing widget for "last played" timestamps. */
export function getRelativeTime(date: Date, now: Date = new Date()): string {
	const diffSeconds = (date.getTime() - now.getTime()) / 1000;
	const { unit } = RELATIVE_TIME_UNITS.find(
		({ limitSeconds }) => Math.abs(diffSeconds) < limitSeconds,
	) ?? {
		unit: "year" as const,
	};

	const formatter = new Intl.RelativeTimeFormat(siteConfig.lang, { numeric: "auto" });
	return formatter.format(Math.round(diffSeconds / DIVISORS[unit]), unit);
}
