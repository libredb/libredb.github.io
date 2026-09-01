import type { APIRoute } from 'astro';
import { VENDOR, VENDOR_ADDRESS_FULL } from '../data/company';
import { channels } from '../data/deploy-channels';
import { engines } from '../data/engines';
import { featureDetails } from '../data/features';
import { faq } from '../data/faq';
import { features } from '../data/home';
import { site } from '../lib/site';

/**
 * The long form of llms.txt — the same content the site states, in one file a
 * model can read without crawling.
 *
 * GENERATED, for the same reason llms.txt is. The static file this replaces had
 * drifted badly: it advertised "7+ databases" against seventeen, and it carried
 * a competitor comparison ("unlike pgAdmin... or DBeaver...") of exactly the
 * kind /compare was rewritten to stop making, because it asserted absences in
 * other people's products that were not true. Generating it means the honest
 * claims on the site are the only claims here — the `limit` line on every
 * feature and the `not` line on every engine come along whether or not anyone
 * remembers they exist.
 */

const engineTable = () => {
  const rows = engines.map((e) => `| ${e.name} | ${e.cat} | ${e.tr} |`).join('\n');
  return `| Engine | Category | Transport |\n|---|---|---|\n${rows}`;
};

const engineLimits = () => engines.map((e) => `- **${e.name}** — ${e.not}`).join('\n');

const featureBlocks = () =>
  features
    .map((f) => {
      const detail = featureDetails.find((d) => d.n === f.n);
      if (!detail) return `### ${f.t}\n\n${f.d}`;
      const points = detail.points.map((p) => `- ${p}`).join('\n');
      return `### ${f.t}\n\n${detail.body}\n\n${points}\n\n**Limit:** ${detail.limit}`;
    })
    .join('\n\n');

const channelList = () =>
  channels
    .map((c) => `- **${c.name}**${c.command ? ` — \`${c.command}\`` : ''}${c.note ? ` ${c.note}` : ''}`)
    .join('\n');

const faqList = () => faq.map((f) => `**${f.q}**\n\n${f.a}`).join('\n\n');

const body = () => `# ${site.name} — full reference for LLMs

> ${site.description}

- Website: ${site.url}
- Source: ${site.links.github}
- Live demo: ${site.links.demo}
- Documentation: ${site.links.docs}
- Licence: ${site.license}
- Current version: ${site.version}

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
- Contact: ${VENDOR.email}

Vendor support, with the supported Kubernetes and runtime versions, is stated at
${site.url}/support.

## What it is

${site.name} is a database IDE that is deployed next to the data rather than installed
on a laptop. It runs as one container inside the same network as the database, so the
database needs no public exposure, no per-person tunnel and no credential copied onto
each machine. Access is granted and revoked through an OIDC identity provider.

The comparison that matters is not a feature list but where the tool runs; that argument
is at ${site.url}/compare.

## Supported engines (${engines.length})

${engineTable()}

### What each engine does NOT do

These boundaries are documented rather than omitted. Agent mode, for example, is available
on three engines and not on the rest.

${engineLimits()}

## Features

${featureBlocks()}

## Security

What is enforced and where, plus the documented limits it stops at, is at
${site.url}/security. The limits are published deliberately: credentials are held
unencrypted in browser localStorage unless a server-side store is configured, the built-in
local login compares passwords without hashing, masking is a display-level control, and
rate limits are counted per replica. The security policy is at ${site.links.security}.

## Deployment (${channels.length} live channels)

${channelList()}

The full channel inventory, including the update policy per channel, is at
${site.url}/deploy. The canonical docker-compose.yml is served verbatim at
${site.url}/docker-compose.example.yml and explained at ${site.url}/docker-compose.

## The other product: LibreDB the database

LibreDB is also a small embeddable multi-model database in TypeScript — one ordered
key-value core with key-value, document and relational lenses over it, zero runtime
dependencies, crash recovery proven by deterministic simulation testing. It is an early
beta aimed at test and development data. Described at ${site.url}/libredb-database.

## The product that is intended to cost money one day: LibreDB Platform

Multi-tenant database access governance for teams — organisations, five-role RBAC,
per-connection permissions and a query audit log, self-hosted. In beta, not sold today,
and with no plan to sell it within the next year; the editor itself stays MIT and free. Described at ${site.url}/platform.

## FAQ

${faqList()}
`;

export const GET: APIRoute = () => new Response(body(), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
