# Kubernetes-Class Platform Listing Roadmap — LibreDB Studio

**Date:** 2026-06-22
**Audience:** LibreDB Studio maintainers
**Scope:** What it takes to achieve an official / first-class listing for `ghcr.io/libredb/libredb-studio` (Docker image + Helm chart on GHCR OCI + Artifact Hub) on each major Kubernetes-class platform.

---

## Quick-Reference Table

| Platform | "Official" Mechanism | Effort | Gating Constraint |
|---|---|---|---|
| Artifact Hub — Verified Publisher | Add `artifacthub-repo.yml` with `repositoryID` | **Low** | Must register repo first |
| Artifact Hub — Official Status | GitHub issue request; manual grant | **Low-Medium** | Must have Verified Publisher first |
| Red Hat OpenShift — Community Operator | PR to `k8s-operatorhub/community-operators` | **High** | Must write an Operator (OLM bundle + CSV) |
| Red Hat OpenShift — Certified Helm Chart | PR via connect.redhat.com pipeline | **High** | Container image must be Red Hat–certified; needs Red Hat Partner Connect account |
| Red Hat OpenShift — Community Helm Chart | PR to `openshift-helm-charts/charts` (community profile) | **Medium** | Image certification not required for community profile |
| Rancher Partner Charts | PR to `rancher/partner-charts` | **High** | Must be a SUSE "Ready" Verified Partner with commercial support obligation |
| Rancher (self-service repo) | Point Rancher at any Helm repo URL | **Low** | No official listing; users add repo manually |
| Kubero Templates | PR to `kubero-dev/templates` | **Low** | No formal gating; open-source projects accepted |

---

## 1. Red Hat OpenShift

### 1a. What "official" means here

There are three distinct tiers in OpenShift's embedded OperatorHub and OpenShift Helm chart repository:

| Tier | Who publishes | Support | Appears in |
|---|---|---|---|
| **Certified Operator** | ISV partner via connect.redhat.com | Joint Red Hat + ISV | OpenShift embedded OperatorHub |
| **Community Operator (OpenShift)** | Any contributor | Community only | OpenShift embedded OperatorHub |
| **Upstream Community Operator** | Any contributor | Community only | operatorhub.io (Kubernetes, not OpenShift embedded) |
| **Certified Helm Chart** | ISV partner via connect.redhat.com | Joint Red Hat + ISV | OpenShift Helm chart repo (charts.openshift.io) |
| **Community Helm Chart** | Any contributor (community profile) | Community only | OpenShift Helm chart repo |

> **OKD vs OCP:** OKD (community distribution) and OCP (commercial Red Hat OpenShift) share the same community operator catalog sourced from `redhat-openshift-ecosystem/community-operators-prod`. Certified operators and certified Helm charts only appear in OCP (commercial). A community listing is visible on both.

### 1b. Option A — Operator (OLM bundle)

**What is "official":** Listed in the OpenShift embedded OperatorHub, visible in the web console's catalog UI. Users install with a single click. The top tier is "Certified"; below it is "Community".

**Required artifacts:**
- An actual Kubernetes Operator (controller built with Operator SDK, Helm Operator, or Ansible Operator)
- OLM **bundle** directory: `ClusterServiceVersion` (CSV) YAML + CRDs + RBAC manifests
- Bundle container image pushed to a registry
- `ci.yaml` file for version management

**Certified Operator path (ISV):**
1. Join Red Hat Partner Connect at [connect.redhat.com](https://connect.redhat.com) — **free to join**
2. Certify the container image(s) in the Red Hat Ecosystem Catalog
3. Build an OLM operator bundle; all referenced images must already be Red Hat–certified
4. Run the operator certification pipeline (Tekton-based, hosted by Red Hat)
5. Pipeline auto-submits a PR to `redhat-openshift-ecosystem/certified-operators`; on pass, auto-merged and published

**Community Operator path (free, no partner account needed):**
- Submit a PR to [`k8s-operatorhub/community-operators`](https://github.com/k8s-operatorhub/community-operators) (appears on operatorhub.io)
- Submit a PR to [`redhat-openshift-ecosystem/community-operators-prod`](https://github.com/redhat-openshift-ecosystem/community-operators-prod) (appears in OpenShift embedded OperatorHub)
- Both repos use automated CI + manual review; no fees

**Effort:** **High** — LibreDB Studio is a web app, not natively an Operator. Building an Operator requires writing a controller or using the Helm Operator wrapper (which wraps a Helm chart as an Operator). This is weeks of work for someone unfamiliar with OLM.

**Resources:**
- [Certified Operator Build Guide](https://redhat-connect.gitbook.io/certified-operator-guide/)
- [community-operators contributing guide](https://k8s-operatorhub.github.io/community-operators/)
- [Build Helm-based Operator](https://www.redhat.com/en/blog/build-kubernetes-operators-from-helm-charts-in-5-steps)

### 1b. Option B — Helm Chart Certification (recommended for LibreDB)

**What is "official":** Listed on [charts.openshift.io](https://charts.openshift.io/), the OpenShift Helm chart repository. Users can install directly from the OpenShift developer console.

**Two profiles:**

| Profile | Who | `images-are-certified` | Other mandatory checks |
|---|---|---|---|
| **Partner** | ISVs via connect.redhat.com | **Required** (images must be Red Hat–certified) | All checks mandatory |
| **Community** | Anyone via GitHub PR | **Optional** | Only `helm-lint` mandatory |

**Mandatory checks for community profile (helm-lint only):**
The full partner profile has 12+ mandatory checks including:
- Helm v3, README.md, test files, `kubeVersion` in `Chart.yaml`
- `values.schema.json` present
- No CRDs in chart (use separate CRD chart)
- No CSI objects
- `images-are-certified` (partner only; **optional for community**)
- `helm install` succeeds on an OpenShift cluster

**Community Helm Chart submission steps:**
1. Run [chart-verifier](https://github.com/redhat-certification/chart-verifier) locally: `docker run --rm quay.io/redhat-certification/chart-verifier verify <chart>`
2. Generate a verification report
3. Submit PR to [openshift-helm-charts/charts](https://github.com/openshift-helm-charts/charts) with chart and/or report
4. CI pipeline runs; if passing, merged and published

**For certified Helm chart (partner profile):**
- Join Red Hat Partner Connect (free)
- Certify container image(s) first (images-are-certified check)
- Submit via connect.redhat.com hosted pipeline

**Effort (community profile):** **Medium** — No partner account needed. Main work: fix chart to pass chart-verifier checks (add `values.schema.json`, `kubeVersion`, README, test), run on an OpenShift cluster. Estimate: 1–2 weeks.

**Effort (partner/certified):** **High** — Requires Red Hat–certifying the container image, which involves rebuilding on a Red Hat UBI base image or going through the Red Hat Ecosystem Catalog container certification process.

**LibreDB gaps for community Helm chart:**
- [ ] `values.schema.json` (likely missing — mandatory)
- [ ] At least one `helm test` file
- [ ] `kubeVersion` field in `Chart.yaml`
- [ ] Access to an OpenShift cluster (can use Developer Sandbox: [console.redhat.com/openshift/sandbox](https://console.redhat.com/openshift/sandbox))
- [ ] Chart must not contain CRDs

**Resources:**
- [Chapter 4 — Helm chart policy guide (2025)](https://docs.redhat.com/en/documentation/red_hat_software_certification/2025/html/red_hat_openshift_software_certification_policy_guide/products-managed-by-helm-charts_openshift-sw-cert-policy-products-managed)
- [chart-verifier GitHub](https://github.com/redhat-certification/chart-verifier)
- [Helm chart checks reference](https://github.com/redhat-certification/chart-verifier/blob/main/docs/helm-chart-checks.md)

---

## 2. Rancher (SUSE)

### 2a. What "official" means here

Rancher's Apps & Marketplace (in the Rancher Manager UI) pulls from three catalog sources:
1. **Rancher Charts** (`rancher/charts`) — Rancher's own maintained charts
2. **Partner Charts** (`rancher/partner-charts`) — ISV partner charts; shown by default to all Rancher users
3. **RKE2/K3s Charts** — Kubernetes distribution charts

Getting into `rancher/partner-charts` is what gives a **first-class listing** — it appears in the Rancher UI Apps & Marketplace without any user configuration.

Self-hosting a Helm repository and pointing Rancher at it is always possible but gives no "official" listing.

### 2b. Required artifacts and steps

**Prerequisite — SUSE "Ready" Verified Partner status:**
This is a **commercial support obligation** and is the gating constraint for open-source projects:
- Organization must be the primary developer/maintainer of the software
- Must provide **commercial support** for the software on declared RKE2/K3s versions
- Must not compete commercially with Rancher Prime
- Apply at [partner.suse.com/s/apply](https://partner.suse.com/s/apply)

> **Important caveat for LibreDB:** The `rancher/partner-charts` README explicitly states it is "not intended for software maintained by an open source community without any backing organization with which SUSE can have a partnership." LibreDB as an open-source project with a commercial platform (libredb-platform) likely qualifies, but only if the organization is willing to commit to commercial support obligations.

**Technical chart requirements:**
- Helm 3 compatible
- `kubeVersion` in `Chart.yaml` (e.g., `>=1.21-0`)
- `app-readme.md` in the chart overlay directory (1–2 paragraph description for Rancher UI)
- Deployable with default values in current Rancher
- Sourced from a public Helm or Git repository

**`questions.yaml`** (optional but recommended for good UX):
Located in the chart root; defines form fields shown in the Rancher UI configuration panel. Example:
```yaml
questions:
  - variable: service.type
    default: "ClusterIP"
    description: "Service type"
    type: enum
    options:
      - "ClusterIP"
      - "LoadBalancer"
    label: "Service Type"
```

**Submission process:**
1. Become SUSE Ready Verified Partner (partner.suse.com — timeline unspecified, likely weeks to months)
2. Fork `rancher/partner-charts`
3. Run `scripts/pull-scripts` to get the `partner-charts-ci` tool
4. Run `PACKAGE=<vendor>/<chart> bin/partner-charts-ci update`
5. Create PR targeting `main-source` branch with only your package changes (never edit `charts/` or `assets/` manually)
6. Automated CI + manual review

**Effort:** **High** — gated by the SUSE Ready partner process (commercial support obligation, timeline unknown). Technical chart work is **Medium**. Not a viable path for a pure community project without commercial backing.

**LibreDB assessment:**
- Has: Helm chart, public repository, open-source license
- Needs: SUSE Ready partner status (commercial support commitment), `app-readme.md`, `questions.yaml`, RKE2/K3s testing documentation

**Workaround (Low effort, no official listing):** Any Rancher user can add a custom Helm repository URL in Apps > Repositories. This gives no official listing but lets users install immediately.

**Resources:**
- [rancher/partner-charts README](https://github.com/rancher/partner-charts)
- [SUSE Rancher Certification Requirements](https://www.suse.com/product-certification/ready/rancher-certification-requirements/)
- [Creating Apps — Rancher docs](https://ranchermanager.docs.rancher.com/how-to-guides/new-user-guides/helm-charts-in-rancher/create-apps)

---

## 3. Artifact Hub

### 3a. What "official" means here

Artifact Hub has two trust-signal tiers above a basic listing:

| Badge | Meaning | How Granted |
|---|---|---|
| **Verified Publisher** | Publisher owns/controls the source repository | Automated — add `artifacthub-repo.yml` |
| **Official** | Publisher is the creator/developer of the software | Manual — GitHub issue request to Artifact Hub maintainers |

Artifact Hub became a **CNCF Incubating project in May 2024**, increasing its authority as the canonical cloud-native package index.

### 3b. Step-by-step to high-quality listing

**Step 1 — Register the repository (basic listing)**
- Go to [artifacthub.io](https://artifacthub.io), create account, add repository under Settings > Add repository
- For OCI (GHCR): URL format `oci://ghcr.io/libredb/libredb-studio`
- Artifact Hub processes repositories every ~30 minutes

**Step 2 — Verified Publisher badge (Low effort, ~30 min)**
- Note your repository ID from the Artifact Hub control panel
- Add `artifacthub-repo.yml` to your chart repository root (same level as `index.yaml` for HTTP repos; for OCI push with tag `artifacthub.io` and MIME type `application/vnd.cncf.artifacthub.repository-metadata.layer.v1.yaml`):
```yaml
repositoryID: <your-repo-uuid-from-artifacthub>
```
- Trigger a repository re-scan (update `index.yaml` or push a new chart version)
- Badge appears on next processing cycle

**Step 3 — Official status (Low-Medium effort)**
Prerequisites:
- Verified Publisher status already active
- All packages in the repository have `README.md` documentation
- Requestor is the repository publisher or org member

Process: Open a GitHub issue in [artifacthub/hub](https://github.com/artifacthub/hub) requesting official status (see [example: cert-manager issue #3394](https://github.com/artifacthub/hub/issues/3394)).

> LibreDB Studio qualifies because LibreDB is the software creator. This is the ideal badge to pursue.

**Step 4 — Security scanning (automatic)**
- Artifact Hub automatically scans container images referenced in Helm charts using **Trivy**
- Latest version: scanned **daily**; older versions: **weekly**
- Versions > 1 year old or with > 15 images are excluded
- Results are displayed as an informational security report per package version
- Does not affect listing eligibility but is visible to users; keep vulnerabilities low

**Step 5 — Package signing (Medium effort)**

*Option A — Helm provenance file (`.prov`)* — traditional PGP signing:
```bash
helm package --sign --key 'LibreDB Studio' --keyring ~/.gnupg/secring.gpg .
```
Add `artifacthub.io/signKey` annotation to `Chart.yaml`:
```yaml
annotations:
  artifacthub.io/signKey: |
    fingerprint: <PGP fingerprint>
    url: https://libredb.io/gpg-key.asc
```

*Option B — Cosign (OCI-native, recommended for GHCR distribution):*
```bash
cosign sign ghcr.io/libredb/libredb-studio:1.0.0
```
For keyless signing via GitHub Actions OIDC (no long-lived keys):
```yaml
- uses: sigstore/cosign-installer@v3
- run: cosign sign --yes ghcr.io/libredb/libredb-studio:${{ env.VERSION }}
  env:
    COSIGN_EXPERIMENTAL: "1"
```
Artifact Hub detects both `.prov` files and Cosign signatures and displays a "signed" indicator.

**Step 6 — Annotations that raise quality/discoverability**
Add to `Chart.yaml`:
```yaml
annotations:
  artifacthub.io/license: "AGPL-3.0"                  # or your actual license
  artifacthub.io/category: "database"
  artifacthub.io/changes: |
    - kind: added
      description: "Initial release"
  artifacthub.io/maintainers: |
    - name: LibreDB Team
      email: hello@libredb.io
  artifacthub.io/screenshots: |
    - title: Query Editor
      url: https://libredb.io/screenshots/editor.png
  artifacthub.io/alternativeName: "libre-db-studio"
```

**LibreDB gaps:**
- [ ] Register on Artifact Hub and note repository ID
- [ ] Add `artifacthub-repo.yml` (trivial)
- [ ] Request Official status (after Verified Publisher — easy, just a GitHub issue)
- [ ] Add `artifacthub.io/category`, `license`, `changes`, `screenshots` annotations
- [ ] Implement Cosign signing in CI/CD (1–2 hours with GitHub Actions)
- [ ] Keep container image CVE count low (monitor Trivy reports)

**Resources:**
- [Artifact Hub Repositories documentation](https://artifacthub.io/docs/topics/repositories/)
- [Artifact Hub Helm annotations reference](https://artifacthub.io/docs/topics/annotations/helm/)
- [Verified Publishers and Official Status blog post](https://blog.artifacthub.io/blog/verified-and-official-repos/)
- [Security reports documentation](https://artifacthub.io/docs/topics/security_report/)

---

## 4. Kubernetes General — Helm Chart Best Practices

These practices are prerequisites for or raise quality scores on all platforms above.

### Chart distribution
- **OCI on GHCR:** Helm v3.8+ supports OCI natively. Push with `helm push`. LibreDB already uses GHCR — this is correct.
- Keep the OCI chart and container image in the same registry for unified auth/ACLs.

### Chart signing
- **Cosign (recommended):** Sign OCI-stored charts with `cosign sign`. Use keyless signing via OIDC in GitHub Actions — no long-lived keys to manage. Artifact Hub detects this.
- **Helm `.prov` files:** Still valid for HTTP-hosted repos; generated with `helm package --sign`. Less relevant for OCI-only distribution.
- Automate signing in CI; never skip on release builds.

### Values schema
- **`values.schema.json` is mandatory for Red Hat certification** and is a strong quality signal everywhere.
- Generate from `values.yaml` with `helm-schema` tool or write by hand.
- Schema validation runs at `helm install` time, giving users early feedback on misconfiguration.

### UX
- `Chart.yaml` must have: `description`, `home`, `sources`, `maintainers`, `kubeVersion`, `appVersion`.
- Include a working `NOTES.txt` with post-install instructions.
- Include at least one `helm test` (a simple connectivity test suffices).
- Do not bundle CRDs in the chart package if targeting OpenShift certification (use a separate CRD chart or Operator).

### Provenance and supply chain
- Pin image tags to exact digests in `values.yaml` default for security-conscious environments.
- Sign container images with Cosign in the same CI step as chart signing.
- Add SBOM attestation with `cosign attest` for supply chain transparency (increasingly expected by enterprise users).

**Resources:**
- [Helm OCI registries guide](https://helm.sh/docs/topics/registries/)
- [Cosign keyless signing with GitHub Actions](https://www.qcecuring.com/blog/sigstore-cosign-keyless-github-actions)
- [Helm chart signing guide](https://oneuptime.com/blog/post/2026-01-17-helm-chart-signing-verification/view)

---

## 5. Kubero

### What it is
Kubero is a self-hosted PaaS alternative to Heroku/Netlify running on Kubernetes. It is **not** a package marketplace in the Artifact Hub or OperatorHub sense — it is a deployment platform that ships with 172+ application templates.

### Is it a meaningful "official listing" target?
**Partially — low effort, low strategic value.** Getting listed in Kubero's templates index means submitting a PR to [`kubero-dev/templates`](https://github.com/kubero-dev/templates) with a JSON entry pointing at your GitHub repo. The process is informal (no partner program, no commercial requirements), and it reaches Kubero's self-hosted user community (small but growing — actively developed, v3.0 planned mid-2025). Since Kubero deploys apps from Docker images/git repos rather than Helm charts, the integration is different from the Helm-chart-centric platforms. **Worth doing as a quick win** if LibreDB wants visibility with the self-hosted Kubernetes PaaS crowd, but it is not a first-class "Kubernetes marketplace" listing in the same tier as Artifact Hub or OperatorHub.

**Effort:** Low (~2–4 hours to create a template PR)

**Resources:**
- [kubero-dev/templates repository](https://github.com/kubero-dev/templates)
- [Kubero templates page](https://www.kubero.dev/templates/)

---

## Prioritized Recommendation

### Phase 1 — Do now (Low effort, high ROI)

1. **Artifact Hub Verified Publisher** (estimate: 1–2 hours)
   - Register the Helm chart repo on Artifact Hub
   - Add `artifacthub-repo.yml` with `repositoryID`
   - Add quality annotations (`category`, `license`, `changes`, `maintainers`, `screenshots`) to `Chart.yaml`
   - Immediate payoff: professional listing with badges, Trivy scanning, discoverability

2. **Artifact Hub Official Status** (estimate: 30 min after step 1)
   - Open a GitHub issue at [artifacthub/hub](https://github.com/artifacthub/hub) requesting official status
   - LibreDB is the software creator — this is the strongest trust signal Artifact Hub offers

3. **Cosign chart + image signing in CI** (estimate: 2–4 hours)
   - Add keyless Cosign signing to the GitHub Actions release workflow
   - Satisfies Artifact Hub "signed" indicator, Flux/Argo policy enforcement, and enterprise procurement requirements

### Phase 2 — Do next quarter (Medium effort)

4. **Red Hat OpenShift Community Helm Chart** (estimate: 1–2 weeks)
   - Adds chart to `charts.openshift.io`, visible in OpenShift developer console
   - Key work: add `values.schema.json`, `kubeVersion`, helm tests; run chart-verifier; get access to OpenShift sandbox
   - No commercial requirements; community profile means `images-are-certified` is optional
   - High strategic value: OpenShift is widely deployed in enterprise

### Phase 3 — Consider when company is ready (High effort, high strategic value)

5. **Red Hat Certified Helm Chart (Partner profile)** (estimate: 1–3 months)
   - Requires Red Hat Partner Connect account (free) + container image certification
   - Image certification likely requires rebuilding on Red Hat UBI base
   - Unlocks the "certified" badge and joint support statement — valuable for enterprise sales

6. **Rancher Partner Charts** (estimate: 2–6 months, uncertain)
   - Gated by SUSE Ready partner status + commercial support commitment
   - Evaluate only if there is a clear SUSE/Rancher customer demand
   - Consider the self-service repo workaround (point users at GHCR Helm URL) in the interim

7. **Kubero Templates** (estimate: half a day, anytime)
   - Low effort quick win for the self-hosted PaaS community
   - No gating; submit a PR when convenient

### What LibreDB already has (advantages)
- Image on GHCR (correct registry for OCI Helm)
- Helm chart on GHCR OCI (already the modern distribution format)
- Open-source license (no commercial friction for community paths)
- Active maintainership (required by all programs)

### Critical gaps to close first
1. `values.schema.json` — blocks Red Hat certification; improves all listings
2. Helm test file(s) — blocks Red Hat certification
3. `kubeVersion` in `Chart.yaml` — blocks Red Hat and Rancher
4. Cosign signing in CI — needed for all supply-chain trust signals
5. `artifacthub-repo.yml` — needed for Artifact Hub Verified Publisher

---

## Sources

- [Red Hat Software Certification Workflow Guide 2025](https://docs.redhat.com/en/documentation/red_hat_software_certification/2024/html-single/red_hat_software_certification_workflow_guide/index)
- [Red Hat OpenShift Software Certification Policy Guide 2025](https://docs.redhat.com/en/documentation/red_hat_software_certification/2025/html-single/red_hat_openshift_software_certification_policy_guide/index)
- [Helm chart checks for Red Hat OpenShift certification](https://github.com/redhat-certification/chart-verifier/blob/main/docs/helm-chart-checks.md)
- [chart-verifier tool](https://github.com/redhat-certification/chart-verifier)
- [Certified Operator Build Guide](https://redhat-connect.gitbook.io/certified-operator-guide/)
- [community-operators (operatorhub.io)](https://k8s-operatorhub.github.io/community-operators/)
- [community-operators-prod (OpenShift embedded OperatorHub)](https://github.com/redhat-openshift-ecosystem/community-operators-prod)
- [Red Hat Partner Connect — cost FAQ](https://connect.redhat.com/about/faq/what-does-it-cost-become-red-hat-partner-connect-technology-partner)
- [rancher/partner-charts README](https://github.com/rancher/partner-charts)
- [SUSE Rancher Certification Requirements](https://www.suse.com/product-certification/ready/rancher-certification-requirements/)
- [Rancher Apps & Marketplace documentation](https://ranchermanager.docs.rancher.com/how-to-guides/new-user-guides/helm-charts-in-rancher)
- [Artifact Hub Repositories documentation](https://artifacthub.io/docs/topics/repositories/)
- [Artifact Hub Helm annotations reference](https://artifacthub.io/docs/topics/annotations/helm/)
- [Artifact Hub — Verified Publishers and Official Status](https://blog.artifacthub.io/blog/verified-and-official-repos/)
- [Artifact Hub — Security reports](https://artifacthub.io/docs/topics/security_report/)
- [Artifact Hub — CNCF Incubating announcement (May 2024)](https://www.cncf.io/blog/2024/09/17/artifact-hub-becomes-a-cncf-incubating-project/)
- [artifacthub-repo.yml real-world example (Traefik mesh)](https://github.com/traefik/mesh-helm-chart/blob/master/artifacthub-repo.yml)
- [cert-manager Official status GitHub issue (example)](https://github.com/artifacthub/hub/issues/3394)
- [Helm OCI registries guide](https://helm.sh/docs/topics/registries/)
- [Cosign keyless signing PoC](https://blog.ediri.io/poc-to-create-a-keyless-signed-oci-helm-chart)
- [kubero-dev/templates repository](https://github.com/kubero-dev/templates)
- [Kubero templates listing](https://www.kubero.dev/templates/)
