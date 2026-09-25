import { canonicalUrl } from './site';

/**
 * The two namespaces and the self link every feed on this site declares.
 *
 * RSS 2.0 defines <author> as an email address, so a bare name there fails the
 * W3C feed validator: the live site feed answers "Invalid email address" once
 * per item. The author's name is Dublin Core's job. rel="self" is the
 * validator's one standing recommendation for a feed that does not say where
 * it lives.
 *
 * Both are declared on the channel, so dropping either one leaves every feed
 * on the site not well-formed. tests/dist-smoke.test.ts holds them down.
 */
export const feedXmlns = {
  dc: 'http://purl.org/dc/elements/1.1/',
  atom: 'http://www.w3.org/2005/Atom',
} as const;

/**
 * `<dc:creator>` for a feed item.
 *
 * @astrojs/rss parses item customData as XML and re-serialises it, so a bare
 * `&` would survive on its own. `<` would not: it opens an element and the
 * name after it is lost. Escaping all three is cheaper than depending on which
 * ones the library happens to handle.
 */
export function feedCreator(name: string): string {
  const safe = name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<dc:creator>${safe}</dc:creator>`;
}

/** `<atom:link rel="self">` for the feed served at `path`. */
export function feedSelfLink(path: string): string {
  return `<atom:link href="${canonicalUrl(path)}" rel="self" type="application/rss+xml"/>`;
}
