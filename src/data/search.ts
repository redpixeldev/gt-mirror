/**
 * What the header's search dialog looks through.
 *
 * Built at build time from the demo content, so the theme searches without an
 * index file or a network call. On a real Ghost install this is the fallback:
 * Ghost injects its own Sodo Search, and the dialog stands aside (see
 * `SearchDialog.astro`).
 */
import { ARCHIVE_POSTS } from './archive';
import { AUTHOR, AUTHOR_POSTS } from './authorArchive';
import { postHref } from './navigation';
import { ALL_POSTS, type DecoratedPost } from './posts';
import { TAG, TAG_POSTS } from './tagArchive';

export interface SearchEntry {
	title: string;
	excerpt: string;
	tag: string;
	author: string;
	/** "12 Mar 2026 · 7 min read" */
	meta: string;
	tier: string;
	href: string;
}

const toEntry = (post: DecoratedPost): SearchEntry => ({
	title: post.title,
	excerpt: post.excerpt,
	tag: post.tag,
	author: post.author,
	meta: post.meta,
	tier: post.tier,
	href: postHref(post.locked),
});

/**
 * Everything the site displays, so a search finds a post wherever it was seen.
 * The four demo sets overlap; the first occurrence of a title wins.
 */
const seen = new Set<string>();

const add = (acc: SearchEntry[], entry: SearchEntry) => {
	if (seen.has(entry.title)) return acc;
	seen.add(entry.title);
	acc.push(entry);
	return acc;
};

export const SEARCH_INDEX: SearchEntry[] = [
	...[...ALL_POSTS, ...ARCHIVE_POSTS].map(toEntry),
	// The single-tag and single-author archives ship their own posts.
	...TAG_POSTS.map((post) => ({
		title: post.title,
		excerpt: post.excerpt,
		tag: TAG.name,
		author: post.author,
		meta: post.meta,
		tier: post.tier,
		href: postHref(post.locked),
	})),
	...AUTHOR_POSTS.map((post) => ({
		title: post.title,
		excerpt: post.excerpt,
		tag: post.tag,
		author: AUTHOR.name,
		meta: post.meta,
		tier: post.tier,
		href: postHref(post.locked),
	})),
].reduce<SearchEntry[]>(add, []);
