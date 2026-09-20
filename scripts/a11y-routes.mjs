import site from '../site.config.json' with { type: 'json' };

/**
 * Which routes the Lighthouse gate audits.
 *
 * Derived from site.config.json rather than typed out, because a hand-kept copy
 * of the route inventory drifts: /code-signing-policy had to be added in a
 * follow-up commit, and /helper shipped with no audit at all. Adding a page to
 * the inventory now adds it to the audit, which is the only behaviour that
 * cannot fall behind.
 */

/** In the inventory, but not an HTML page a Lighthouse run means anything for. */
const NOT_A_PAGE = new Set(['/rss.xml']);

/**
 * Routes built from a template, where auditing every instance would audit the
 * same markup over and over. One stands for the family: the accessibility of
 * the 104th post is the accessibility of the first.
 */
const TEMPLATE_REPRESENTATIVES = ['/blog/the-tool-goes-to-the-data', '/blog/engine/postgresql'];

export const a11yRoutes = [...site.routes.filter((route) => !NOT_A_PAGE.has(route)), ...TEMPLATE_REPRESENTATIVES];
