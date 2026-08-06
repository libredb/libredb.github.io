// src/data/section-seo.ts
// Per-section structured data injected into <head> by the dynamic route.
import { deployTargets } from './deploy-targets';
import { VENDOR } from './company';

const SITE = 'https://libredb.org';
const REPO = 'https://github.com/libredb/libredb-studio';
const rawFileURL = `${SITE}/docker-compose.example.yml`;

export const sectionSeo: Record<string, object[]> = {
  deploy: [
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'LibreDB Studio deployment targets',
      about: { '@id': 'https://libredb.org/#application' },
      itemListElement: deployTargets.map((t, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: t.name,
        url: t.deployUrl ?? t.docsUrl ?? t.url,
      })),
    },
  ],
  database: [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareSourceCode',
      name: 'LibreDB',
      description:
        'A small, readable, embeddable, multi-model database in TypeScript. One ordered key-value core, three lenses, zero dependencies, every line tested.',
      programmingLanguage: 'TypeScript',
      codeRepository: 'https://github.com/libredb/libredb-database',
      license: 'https://opensource.org/licenses/MIT',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'LibreDB',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Cross-platform (Bun, Node 22+)',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      softwareVersion: 'early-beta (0.0.x)',
    },
  ],
  platform: [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'LibreDB Platform',
      applicationCategory: 'BusinessApplication',
      description:
        'Managed, multi-tenant Database Access Governance for teams — authorized, audited database access built on the open-source LibreDB Studio engine.',
      operatingSystem: 'Web',
      url: 'https://platform.libredb.org',
      softwareVersion: 'beta',
    },
  ],
  // Partner programmes resolve the support provider from structured data as well
  // as the prose, so the Service node points at the same @id as the vendor
  // Organization node in company.ts — one entity, described once.
  support: [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'LibreDB Studio commercial support',
      serviceType: 'Commercial software support',
      description:
        'Commercial support for LibreDB Studio on Kubernetes, K3s, RKE2, Rancher and OpenShift — installation and upgrades, configuration, defect fixes and security patches.',
      provider: { '@id': VENDOR.schemaId },
      areaServed: 'Worldwide',
      availableLanguage: ['en', 'tr'],
      url: `${SITE}/support/`,
      about: { '@id': 'https://libredb.org/#application' },
    },
  ],
  docker_compose: [
    {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: 'Run LibreDB Studio with Docker Compose',
      description: 'Self-host the open-source LibreDB Studio SQL IDE using Docker Compose.',
      totalTime: 'PT5M',
      tool: [
        { '@type': 'HowToTool', name: 'Docker' },
        { '@type': 'HowToTool', name: 'Docker Compose' },
      ],
      step: [
        {
          '@type': 'HowToStep',
          position: 1,
          name: 'Download the compose file',
          text: 'Download docker-compose.example.yml and rename it to docker-compose.yml.',
          url: `${SITE}/docker-compose-example/`,
        },
        {
          '@type': 'HowToStep',
          position: 2,
          name: 'Configure environment',
          text: 'Set JWT_SECRET (min 32 chars), ADMIN_PASSWORD and USER_PASSWORD in your .env file.',
          url: `${SITE}/docker-compose-example/`,
        },
        {
          '@type': 'HowToStep',
          position: 3,
          name: 'Start the container',
          text: 'Run "docker compose up -d" and open http://localhost:3000.',
          url: `${SITE}/docker-compose-example/`,
        },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareSourceCode',
      name: 'docker-compose.example.yml',
      description: 'Ready-to-use Docker Compose configuration for LibreDB Studio.',
      programmingLanguage: 'YAML',
      codeRepository: REPO,
      url: rawFileURL,
      license: 'https://opensource.org/licenses/MIT',
      about: { '@id': 'https://libredb.org/#application' },
    },
  ],
};
