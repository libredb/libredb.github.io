/**
 * The vendor support statement.
 *
 * Nothing here is sold. The publisher supports the software at no charge, and
 * this page exists because partner programmes require a named entity to be
 * answerable for it - not because there is a service to buy. Do not reintroduce
 * "commercial support" wording: it described an offering that does not exist,
 * and a support page that overstates is worse evidence than one that does not.
 *
 * This page is evidence, not marketing. Partner programmes — SUSE Ready for
 * Rancher, Red Hat's community operator catalog, the cloud marketplaces — all
 * ask a vendor to publish who supports the software and on which versions, and
 * a reviewer opens this page to check the answer against the submission. So it
 * is written as a general support statement rather than as a certification
 * artefact: a page that reads as though it exists for one programme is weaker
 * evidence for all of them.
 *
 * EVERY VERSION BELOW IS TRACEABLE. If one of these moves in the studio repo,
 * it moves here in the same change:
 *   platform table   libredb-studio  docs/RANCHER.md § Supported versions
 *   Kubernetes floor libredb-studio  charts/libredb-studio/Chart.yaml kubeVersion
 *   OpenShift range  libredb-studio  docs/DISTRIBUTION.md § the catalogs/v4.15..v4.22 tree
 *   Node tiers       libredb-studio  docs/DISTRIBUTION.md § npx
 *   image platforms  libredb-studio  Chart.yaml artifacthub.io/images
 *
 * "Supported" is what the commitment covers. "Validated" is what has actually
 * been exercised end to end with a published result — an em dash means the same
 * support terms apply, but no run is published yet. Never turn a dash into a
 * version without a run behind it: this table is read as evidence.
 */

export interface SupportedPlatform {
  component: string;
  supported: string;
  validated: string;
}

/** Transcribed from docs/RANCHER.md § Supported versions, which is the authority. */
export const platforms: SupportedPlatform[] = [
  { component: 'Kubernetes', supported: '1.26 or later', validated: 'v1.31.14, v1.35.5' },
  { component: 'SUSE K3s', supported: '1.26 or later', validated: 'v1.31.14+k3s1, v1.35.5+k3s1' },
  { component: 'SUSE RKE2', supported: '1.26 or later', validated: '—' },
  {
    component: 'SUSE Rancher Prime and Rancher (community)',
    supported: '2.9 or later',
    validated: '2.14.3 (community build)',
  },
  { component: 'Red Hat OpenShift', supported: '4.15 to 4.22', validated: '—' },
  { component: 'Any CNCF-conformant distribution', supported: '1.26 or later', validated: '—' },
];

export interface SupportedRuntime {
  runtime: string;
  detail: string;
  href?: string;
  linkLabel?: string;
}

/**
 * Kept apart from the platform table on purpose: these are runtime floors, not
 * distributions, and they have no "validated version" in the same sense.
 *
 * The Node floor is 24, and it is stated as 24 because that is what
 * `engines.node` declares today. An earlier version of this page said 20.9 with
 * per-feature exceptions, which stopped being true when the launcher moved to
 * Node 24 — a support statement that is one release stale is worse than none.
 */
export const runtimes: SupportedRuntime[] = [
  {
    runtime: 'Container runtime',
    detail:
      'Any OCI-compatible runtime — Docker, containerd or CRI-O. The image is published for linux/amd64 and linux/arm64 on every release, so an Apple silicon laptop and an Ampere node run the same tag as an x86 server.',
  },
  {
    runtime: 'Node.js',
    detail:
      'Node 24 LTS or later, on Linux, macOS (x64 and arm64) or Windows (x64). Node 24 is the reference runtime — it is what the release payload is built on — and Node 25 and 26 run that same payload, native module included. Below 24 npm does not error; it silently resolves an older release instead, which is why the floor is stated rather than assumed.',
    href: 'https://github.com/libredb/libredb-studio/blob/main/docs/DISTRIBUTION.md#npx',
    linkLabel: 'Runtime support tiers',
  },
];

export interface SupportArea {
  area: string;
  detail: string;
}

export const scope: SupportArea[] = [
  {
    area: 'Deployment',
    detail:
      'Helm chart installation, upgrades and rollback on the platforms above, plus the container and npx paths — including catalog installs (Rancher Apps via a ClusterRepo, OpenShift OperatorHub) and air-gapped installs from your own registry.',
  },
  {
    area: 'Configuration',
    detail:
      'OIDC single sign-on, role mapping, storage backends, seed connections, ingress and TLS, and the hardened chart defaults — non-root, read-only root filesystem, NetworkPolicy, PodDisruptionBudget and HPA.',
  },
  {
    area: 'Defects',
    detail:
      'Triage and fixes for reproducible defects, shipped in tagged releases. Serious bugs are disclosed in the release notes rather than fixed quietly.',
  },
  {
    area: 'Security',
    detail:
      'Coordinated disclosure, timely patching of critical vulnerabilities, and advisories published in the repository security tab.',
  },
];

/**
 * Only listings that are live and verifiable. A pending submission is not a
 * listing — it goes here the day it merges, not the day it is opened. This is
 * the same rule the deploy page applies to distribution channels.
 */
export const listings = [
  {
    name: 'SUSE Partner Certification & Solutions Catalog',
    href: 'https://www.suse.com/pcsc/viewVersionPage?versionID=26969',
  },
  {
    name: 'Red Hat OpenShift community catalog',
    href: 'https://github.com/redhat-openshift-ecosystem/community-operators-prod',
  },
  { name: 'Artifact Hub', href: 'https://artifacthub.io/packages/helm/libredb-studio/libredb-studio' },
];
