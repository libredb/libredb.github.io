import type { APIRoute } from 'astro';
import { VENDOR, VENDOR_ADDRESS_FULL } from '../data/company';
import { engines } from '../data/engines';
import { site } from '../lib/site';

/**
 * https://llmstxt.org — an index of the site for a model reading it.
 *
 * GENERATED, not hand-kept. The file this replaces was a static one in public/
 * and it had gone stale in both directions at once: it listed two of the site's
 * pages and named seven of the seventeen engines. That is the same failure the
 * route inventory and the compose page were both fixed for — a second copy of a
 * list nobody remembers to update is a list that lies.
 *
 * The page titles are the one hand-written part, because a route alone does not
 * say what is at the end of it. They live next to the routes they describe, and
 * the test asserts every route has one.
 */

/** What a model should be told each page is for. Keyed by the route. */
const DESCRIPTIONS: Record<string, string> = {
  '/': 'What LibreDB Studio is and why it deploys next to the data instead of onto a laptop.',
  '/features': 'The editor, the AI copilot, EXPLAIN plans, ER diagrams, masking and the monitoring dashboard.',
  '/databases': 'Every engine Studio connects to, what each provider supports and what it does not.',
  '/libredb-database':
    'LibreDB the embeddable database: one ordered key-value core, three lenses, zero dependencies, early beta.',
  '/deploy': 'Every distribution channel that is live today — registries, package managers, Kubernetes and PaaS.',
  '/docker-compose': 'The canonical docker-compose.yml, byte for byte, with every environment variable explained.',
  '/get-started': 'From nothing to a running Studio, by container or by npx.',
  '/playground': 'Run the LibreDB database in the browser, with no install.',
  '/open-source': 'What the MIT licence permits, how to contribute, and how to report a vulnerability.',
  '/supporters':
    'The companies and open-source programmes covering the infrastructure around the project, what a supporter is promised, and why a place there cannot be bought.',
  '/security': 'What the application enforces, where it enforces it, and the documented limits it stops at.',
  '/support': 'The vendor of record, the supported Kubernetes and runtime versions, and how to reach support.',
  '/platform':
    'LibreDB Platform: multi-tenant database access governance for teams. Beta, self-hosted, not currently sold.',
  '/compare': 'Desktop client, hosted editor, or deployed beside the data — what each approach costs you.',
  '/faq': 'The questions asked before adopting it.',
  '/blog': 'Release notes and engineering writing.',
  '/privacy-policy': 'What is collected, by whom, and on what legal basis.',
};

/** Routes that are not pages a reader should be pointed at. */
const NOT_A_PAGE = new Set(['/404', '/rss.xml']);

export const pageRoutes = site.routes.filter((r) => !NOT_A_PAGE.has(r));

const body = () => {
  // The route is the link text on purpose. A prose title here would be a third
  // copy of every page's name, and this file exists because the second copy
  // drifted. tests/llms.test.ts fails if a route reaches here with no line.
  const links = pageRoutes
    .map((r) => `- [${r}](${site.url}${r === '/' ? '' : r}): ${DESCRIPTIONS[r] ?? ''}`)
    .join('\n');

  const engineList = engines.map((e) => e.name).join(', ');

  return `# ${site.name}

> ${site.description}

## Vendor

LibreDB is a product brand. The company that develops, publishes and
supports it is a limited liability company registered in Turkiye. These details are
matters of public record and can be verified independently.

- Registered company name: ${VENDOR.legalName}
- Trade name: ${VENDOR.tradeName}
- Registered office: ${VENDOR_ADDRESS_FULL}
- Tax office: ${VENDOR.taxOffice}
- Tax ID (VKN): ${VENDOR.taxId}
- MERSIS No: ${VENDOR.mersisNo}
- Trade Registry No: ${VENDOR.tradeRegistryNo}
- Company website: ${VENDOR.url}
- Company information: ${VENDOR.companyInfoUrl}
- Contact: ${VENDOR.email}

## Pages

${links}

## Elsewhere

- [Source code](${site.links.github}): the application, MIT licensed.
- [Live demo](${site.links.demo}): a running Studio, no install.
- [Documentation](${site.links.docs}): provider guides, deployment, configuration.
- [Security policy](${site.links.security}): how to report a vulnerability.
- [RSS](${site.url}/rss.xml): the blog feed.

## Supported engines (${engines.length})

${engineList}

## Licence

${site.license}. Every capability, every engine, no paid tier of the editor. The
commercial product is LibreDB Platform, which is governance on top of it and is
described at ${site.url}/platform.
`;
};

export const GET: APIRoute = () => new Response(body(), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
