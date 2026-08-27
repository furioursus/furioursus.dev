// src/utils/lastfm.ts
//
// Thin client for the bits of Last.fm's user.* API the /music/ page needs. Safe to import from
// both server code (music.astro's frontmatter, at build time) and a browser <script> (the live
// now-playing widget) — everything here is plain `fetch`, and the env vars are "client" context
// (see the LASTFM_API_KEY comment in astro.config.ts), so `astro:env/client` resolves the same
// way in both places. See docs/lastfm.md.
import { LASTFM_API_KEY, LASTFM_USERNAME } from "astro:env/client";

const API_ROOT = "https://ws.audioscrobbler.com/2.0/";

// Last.fm's own profile page offers this same set of ranges.
export const LASTFM_PERIODS = [
	{ value: "7day", label: "Past week" },
	{ value: "1month", label: "Past month" },
	{ value: "12month", label: "Past year" },
	{ value: "overall", label: "All time" },
] as const satisfies ReadonlyArray<{ value: string; label: string }>;

export type LastfmPeriod = (typeof LASTFM_PERIODS)[number]["value"];

const TOP_LIMIT = 10;

interface LastfmErrorResponse {
	error: number;
	message: string;
}

interface LastfmArtistRef {
	name?: string;
	"#text"?: string;
}

// The `@attr.total` on a top-artists/albums/tracks response is the *unique* count across the
// whole period, not just the `limit`-sized page we ask for — Last.fm computes it same as
// `totalPages * perPage` would suggest, paging metadata for a list we only ever fetch page 1 of.
interface LastfmTopListAttr {
	total: string;
}

interface RawLastfmTopArtist {
	name: string;
	playcount: string;
	url: string;
}

interface RawLastfmTopAlbum {
	name: string;
	artist?: LastfmArtistRef;
	playcount: string;
	url: string;
}

interface RawLastfmTopTrack {
	name: string;
	artist?: LastfmArtistRef;
	playcount: string;
	url: string;
}

interface RawLastfmRecentTrack {
	name: string;
	artist?: LastfmArtistRef;
	album?: LastfmArtistRef;
	url: string;
	date?: { uts: string };
	"@attr"?: { nowplaying?: string };
}

export interface LastfmTopItem {
	// `| undefined`, not just `?:` — album/track responses don't always carry an artist ref, and
	// exactOptionalPropertyTypes (see tsconfig) treats the two as distinct.
	artist?: string | undefined;
	name: string;
	playcount: number;
	url: string;
}

export interface LastfmNowPlaying {
	album: string | null;
	artist: string;
	name: string;
	nowPlaying: boolean;
	playedAt: Date | null;
	url: string;
}

export interface MusicStatsPeriod {
	albums: LastfmTopItem[];
	artists: LastfmTopItem[];
	tracks: LastfmTopItem[];
	/** Unique artist/album/track counts for the whole period — not just the top-10 slice above. */
	totalAlbums: number;
	totalArtists: number;
	totalTracks: number;
}

export interface MusicStats {
	error: string | null;
	missingConfig: boolean;
	periods: Partial<Record<LastfmPeriod, MusicStatsPeriod>>;
}

function hasLastfmConfig(): boolean {
	return Boolean(LASTFM_API_KEY && LASTFM_USERNAME);
}

function buildUrl(method: string, params: Record<string, number | string> = {}): string {
	const url = new URL(API_ROOT);
	url.searchParams.set("method", method);
	url.searchParams.set("user", LASTFM_USERNAME ?? "");
	url.searchParams.set("api_key", LASTFM_API_KEY ?? "");
	url.searchParams.set("format", "json");
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, String(value));
	}
	return url.toString();
}

async function lastfmFetch<T>(
	method: string,
	params?: Record<string, number | string>,
): Promise<T> {
	const response = await fetch(buildUrl(method, params));
	if (!response.ok) {
		throw new Error(`Last.fm ${method} request failed: ${response.status} ${response.statusText}`);
	}
	const data = (await response.json()) as T | LastfmErrorResponse;
	if (data && typeof data === "object" && "error" in data) {
		throw new Error(`Last.fm ${method} returned error ${data.error}: ${data.message}`);
	}
	return data as T;
}

/**
 * Fetches top artists/albums/tracks for every range in {@link LASTFM_PERIODS} at once (called
 * once at build time from music.astro's frontmatter — not meant for the browser, since it's one
 * fetch per period per category and there's no reason to repeat that per pageview).
 */
export async function loadMusicStats(): Promise<MusicStats> {
	if (!hasLastfmConfig()) {
		return { error: null, missingConfig: true, periods: {} };
	}

	try {
		const entries = await Promise.all(
			LASTFM_PERIODS.map(async ({ value: period }) => {
				const [artistsRes, albumsRes, tracksRes] = await Promise.all([
					lastfmFetch<{
						topartists: { artist: RawLastfmTopArtist[]; "@attr": LastfmTopListAttr };
					}>("user.gettopartists", { limit: TOP_LIMIT, period }),
					lastfmFetch<{
						topalbums: { album: RawLastfmTopAlbum[]; "@attr": LastfmTopListAttr };
					}>("user.gettopalbums", { limit: TOP_LIMIT, period }),
					lastfmFetch<{
						toptracks: { track: RawLastfmTopTrack[]; "@attr": LastfmTopListAttr };
					}>("user.gettoptracks", { limit: TOP_LIMIT, period }),
				]);

				const stats: MusicStatsPeriod = {
					albums: albumsRes.topalbums.album.map((album) => ({
						artist: album.artist?.name ?? album.artist?.["#text"],
						name: album.name,
						playcount: Number(album.playcount),
						url: album.url,
					})),
					artists: artistsRes.topartists.artist.map((artist) => ({
						name: artist.name,
						playcount: Number(artist.playcount),
						url: artist.url,
					})),
					totalAlbums: Number(albumsRes.topalbums["@attr"].total),
					totalArtists: Number(artistsRes.topartists["@attr"].total),
					totalTracks: Number(tracksRes.toptracks["@attr"].total),
					tracks: tracksRes.toptracks.track.map((track) => ({
						artist: track.artist?.name ?? track.artist?.["#text"],
						name: track.name,
						playcount: Number(track.playcount),
						url: track.url,
					})),
				};

				return [period, stats] as const;
			}),
		);

		const periods: Partial<Record<LastfmPeriod, MusicStatsPeriod>> = Object.fromEntries(entries);

		return { error: null, missingConfig: false, periods };
	} catch (err) {
		return {
			error: err instanceof Error ? err.message : String(err),
			missingConfig: false,
			periods: {},
		};
	}
}

/**
 * Fetches the single most recent scrobble — either the track playing right now
 * (`nowPlaying: true`) or the last one that finished (`playedAt` set). Meant to be called
 * repeatedly from the browser (see LastfmNowPlaying.astro); throws on any failure so the caller
 * can decide how to degrade (this file has no DOM/UI opinions).
 */
export async function fetchNowPlaying(): Promise<LastfmNowPlaying | null> {
	if (!hasLastfmConfig()) return null;

	const data = await lastfmFetch<{ recenttracks: { track: RawLastfmRecentTrack[] } }>(
		"user.getrecenttracks",
		{ limit: 1 },
	);
	const track = data.recenttracks.track[0];
	if (!track) return null;

	const artist = track.artist?.name ?? track.artist?.["#text"] ?? "Unknown artist";

	return {
		album: track.album?.["#text"] || null,
		artist,
		name: track.name,
		nowPlaying: track["@attr"]?.nowplaying === "true",
		playedAt: track.date ? new Date(Number(track.date.uts) * 1000) : null,
		url: track.url,
	};
}
