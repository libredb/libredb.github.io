# Toolchain & Quality Gates

> `libredb-website` projesinin geliştirme araç zinciri (toolchain) ve kalite
> kapıları (quality gates) referansı. Hangi kütüphane neden kuruldu, nasıl
> konfigüre edildi ve hangi aşamada çalıştığını açıklar.

Bu site **Astro** ile üretilen, GitHub Pages'e deploy edilen **statik** bir
sitedir. Sunucu çalışma zamanı (runtime) yoktur — bütün çıktı build sırasında
HTML/CSS/JS olarak üretilir. Araç zinciri buna göre seçilmiştir: hızlı, statik
analize dayalı, runtime maliyeti olmayan araçlar.

---

## 1. Çalışma Zamanı ve Paket Yöneticisi: Bun

| Öğe | Değer | Dosya |
| --- | --- | --- |
| Paket yöneticisi & test runner | **Bun** | `bunfig.toml`, `bun.lock` |
| Sabitlenen sürüm | `1.3.14` | `.bun-version` |

**Neden Bun?**
- Tek araçta paket yöneticisi + test runner + script çalıştırıcı. `bun test`
  için ayrı bir test framework'ü (Vitest/Jest) kurmaya gerek kalmıyor.
- CI'da `oven-sh/setup-bun` ile `.bun-version` dosyasından okunarak yerel ve CI
  ortamı birebir aynı Bun sürümünü kullanır (deterministik).

**Nasıl konfigüre edildi — `bunfig.toml`:**
```toml
[install]
exact = true
```
`exact = true`, `bun add` ile eklenen her bağımlılığı **caret (`^`) aralığı
olmadan, tam sürümle** kaydeder. Böylece bir bağımlılık sessizce yeni bir
minor sürüme "kayamaz". `package.json` içindeki tüm sürümler bu nedenle tam
sabitlenmiştir (`astro: 7.0.3`, `oxlint: 1.71.0` …). Sürüm yükseltmeleri
yalnızca **Dependabot** üzerinden, açıkça PR olarak gelir.

> **Reprodüklenebilir kurulum:** CI hem `ci.yml` hem `deploy.yml` içinde
> `bun install --frozen-lockfile` kullanır — `bun.lock` ile birebir uyumsuz
> bir kurulum varsa build başarısız olur.

---

## 2. Build Çatısı ve Çalışma Bağımlılıkları

`package.json > dependencies` (yalnızca build çıktısında rol alanlar):

| Paket | Sürüm | Rolü |
| --- | --- | --- |
| `astro` | 7.0.3 | Statik site üreteci (SSG) |
| `@astrojs/sitemap` | 3.7.3 | `sitemap-index.xml` otomatik üretimi |
| `tailwindcss` + `@tailwindcss/vite` | 4.3.1 | Stil; Tailwind v4 Vite eklentisi olarak çalışır |
| `@libredb/libredb` | 0.1.3 | `/playground` OPFS editörünün kullandığı LibreDB istemcisi |

**Astro konfigürasyonu — `astro.config.mjs`:**
- `site: 'https://libredb.org'` → sitemap ve kanonik URL üretimi için zorunlu.
- `redirects: { '/databases': '/providers' }` → eski URL'in kalıcı yönlendirmesi.
- `integrations: [sitemap(...)]` → her build'de `lastmod` damgalı sitemap.
- `vite.plugins: [tailwindcss()]` → Tailwind v4 artık PostCSS yerine **Vite
  eklentisi** olarak entegre (v4'ün önerdiği yol).
- `build.assets: 'assets'` → üretilen statik varlıklar `assets/` altına yazılır.

İlk satırdaki `// @ts-check`, bu yapılandırma dosyasının da tip kontrolünden
geçmesini sağlar.

---

## 3. Kalite Kapısı (The "Gate")

Projedeki merkezi sözleşme `package.json` içindeki `gate` script'idir:

```json
"gate": "bun run typecheck && bun run format && bun run lint && bun run knip && bun run test"
```

Beş aşamadan **herhangi biri** başarısız olursa zincir durur (`&&`). Aynı komut
hem yerel `pre-push` hook'unda hem CI'da çalışır — yani "bende geçiyordu" durumu
oluşmaz. Aşağıda her aşama tek tek:

### 3.1 `typecheck` → `astro check`
- **Araç:** `@astrojs/check` (0.9.9) + `typescript` (6.0.3)
- **Ne yapar:** `.astro` bileşenleri dahil tüm projede tip kontrolü.
- **Konfig — `tsconfig.json`:**
  ```jsonc
  {
    "extends": "astro/tsconfigs/strict",   // Astro'nun en katı preset'i
    "compilerOptions": { "types": ["bun"] },// bun:test ve Node global'leri
    "include": [".astro/types.d.ts", "**/*"],
    "exclude": ["dist"]
  }
  ```
  - `astro/tsconfigs/strict` → `strict` + Astro'ya özgü ek katılıklar.
  - `types: ["bun"]` → `*.test.ts` dosyalarındaki `bun:test` importları ve
    `@types/bun` üzerinden gelen Node global'leri tanınır. (Astro'nun kendi
    ambient tipleri `.astro/types.d.ts` triple-slash ile yüklenir; `types`
    dizisi bunu kapatmaz, bu yüzden ayrıca eklemeye gerek yok.)

### 3.2 `format` → `prettier --check .`
- **Araç:** `prettier` (3.9.0) + `prettier-plugin-astro` + `prettier-plugin-tailwindcss`
- **Ne yapar:** Biçim tutarlılığını **kontrol eder** (yazmaz). Düzeltmek için
  `bun run format:fix`.
- **Konfig — `.prettierrc.json`:**
  - `singleQuote: true`, `printWidth: 120`.
  - `prettier-plugin-astro` → `.astro` dosyalarını biçimlendirir.
  - `prettier-plugin-tailwindcss` → Tailwind sınıflarını kanonik sıraya dizer;
    `tailwindStylesheet: "./src/styles/global.css"` ile v4 sınıf sırasını okur.
- **`.prettierignore`:** `dist`, `.astro`, `node_modules`, `bun.lock`, `public`
  (verbatim sunulan statik varlıklar), `docs` (HTML mockup + plan dosyaları) ve
  **`src/data/docker-compose.example.yml`** (sync adımıyla çakışmaması için).

### 3.3 `lint` → `oxlint`
- **Araç:** `oxlint` (1.71.0) — Rust ile yazılmış, ESLint'e göre çok hızlı linter.
- **Neden ESLint değil:** Statik bir sitede ESLint'in ağır plugin ekosistemine
  ihtiyaç yok; oxlint kurulum/çalışma maliyeti neredeyse sıfır ve tek binary.
- **Konfig — `.oxlintrc.json`:**
  ```jsonc
  {
    "plugins": ["typescript", "oxc"],
    "categories": {
      "correctness": "error",   // gerçek hatalar → build'i durdurur
      "suspicious": "warn",
      "perf": "off", "pedantic": "off", "style": "off" // stil Prettier'ın işi
    },
    "rules": { "no-underscore-dangle": "off" },
    "ignorePatterns": ["dist/**", ".astro/**", "node_modules/**", "public/**"]
  }
  ```
  Stil kategorileri kapalı çünkü **biçim Prettier'ın sorumluluğunda** — iki araç
  aynı konuda çatışmasın diye sınırlar net çizilmiş.

### 3.4 `knip` → ölü kod / kullanılmayan bağımlılık tespiti
- **Araç:** `knip` (6.22.0)
- **Ne yapar:** Kullanılmayan dosya, export ve `package.json` bağımlılıklarını
  bulur. Bağımlılık şişmesini (dependency bloat) önler.
- **Konfig — `knip.json`:**
  ```json
  { "ignoreDependencies": ["@secretlint/secretlint-rule-preset-recommend"] }
  ```
  secretlint preset'i yalnızca `.secretlintrc.json` içinden (statik analizle
  görünmeyen şekilde) referanslandığı için knip onu "kullanılmıyor" sanır →
  açıkça ignore edilmiş.

### 3.5 `test` → `bun test`
- **Araç:** Bun'un yerleşik test runner'ı (ayrı framework yok).
- **Kapsam:** `**/*.test.ts` dosyaları — ör. `github-stars.test.ts`,
  `sections.test.ts`, `deploy-targets.test.ts`, `playground/engine.test.ts`,
  `lib/filter.test.ts`, `lib/export.test.ts` …
- Veri katmanı (sections, deploy targets), playground motoru/protokolü ve
  yardımcı script'ler için birim testleri.

---

## 4. Gate Dışındaki Güvenlik/Sağlık Kontrolleri

Bunlar `gate` içinde **değil** çünkü ayrı kaygıları var (gizli sızıntı taraması
ve danışma niteliğinde audit), ama hook'larda ve CI'da koşarlar.

### 4.1 `secrets` → `secretlint`
- **Araç:** `secretlint` (13.0.2) + `@secretlint/secretlint-rule-preset-recommend`
- **Ne yapar:** Commit'lenecek dosyalarda API anahtarı, token, kimlik bilgisi
  sızıntısı arar.
- **Konfig — `.secretlintrc.json`:** `preset-recommend` kuralı aktif.
- **`.secretlintignore`:** `dist`, `.astro`, `node_modules`, `bun.lock` ve
  `**/docker-compose.example.yml` — buradaki `postgres:postgres@...` bir
  **yorum satırı şablon varsayılanı**, gerçek sır değil (yanlış pozitif).

### 4.2 `audit` → `bun audit` (danışma niteliğinde)
- **Ne yapar:** Bilinen güvenlik advisory'lerini raporlar.
- **Önemli:** **Bloklamaz.** `pre-push` hook'unda `bun audit || true`, CI'da
  `bun run audit || echo "::notice::..."` ile non-blocking. Gerekçe: mevcut
  advisory'ler build-time transitive bağımlılıklar (picomatch/js-yaml) — statik
  sitede saldırı yüzeyi yok; Dependabot upstream'de düzeltir.

---

## 5. Git Hook'ları (Yerel Kapılar)

Hook'lar `core.hooksPath .githooks` ile bağlanır. Bu ayar `package.json`'daki
`prepare` script'i tarafından (her `bun install` sonrası) otomatik kurulur:
```json
"prepare": "git config core.hooksPath .githooks"
```

| Hook | Çalıştırdığı | Amaç |
| --- | --- | --- |
| **`pre-commit`** | `bun run secrets` + `bun run format` | Hızlı kontroller — sır sızıntısı ve biçim. Commit'i geciktirmeyecek kadar hafif. |
| **`pre-push`** | `bun run gate` + `bun audit \|\| true` | Tam doğrulama — CI'nın enforce ettiğinin aynısı. Push'tan önce her şeyi yakalar. |

**Tasarım mantığı (katmanlı):** Ucuz kontroller her commit'te (`pre-commit`),
pahalı tam gate ise yalnızca push'ta (`pre-push`) çalışır. Böylece sık commit
akışı yavaşlamaz ama hatalı kod uzağa (remote) gitmeden yakalanır.

---

## 6. CI/CD — GitHub Actions

İki ayrı workflow; **build doğrulama** ile **production deploy** kasıtlı olarak
ayrılmıştır.

### 6.1 `ci.yml` — Build Doğrulama
- **Tetik:** `pull_request`, `push: main`, `workflow_dispatch`.
- **Deploy ETMEZ** — sadece doğrular.
- **Adımlar:** checkout → Node 24 → Bun (`.bun-version`'dan) →
  `bun install --frozen-lockfile` → `bun run gate` → `bun run secrets` →
  `bun run audit` (non-blocking) → `bun run build` → job summary tablosu
  (Bun/Node/Astro sürümü, üretilen sayfa sayısı, commit).
- `permissions: contents: read` → en az ayrıcalık (least privilege).
- `concurrency` ile aynı ref'in eski koşumları iptal edilir.

### 6.2 `deploy.yml` — Production Deploy
- **Tetik:** `release: published` (veya manuel `workflow_dispatch`).
  **`main`'e push deploy tetiklemez.** Canlıya çıkış = git tag + GitHub release.
- **İzinler:** `pages: write`, `id-token: write` (GitHub Pages OIDC deploy için).
- **Akış:** `build` job (aynı kurulum, `dist`'i `upload-pages-artifact` ile
  yükler) → `deploy` job (`actions/deploy-pages`, `github-pages` environment).
- `concurrency: group: pages, cancel-in-progress: false` → eşzamanlı deploy
  yarışı önlenir; süren deploy yarıda kesilmez.

**Güvenlik notu — SHA pin:** Tüm action'lar `@<sha> # vX.Y.Z` formatında tam
commit SHA'sına sabitlenmiş (ör. `actions/checkout@9c091bb… # v7.0.0`). Bu,
tag'in kötü niyetle yeniden işaret etmesine (supply-chain) karşı korur.
Dependabot bu SHA pin'lerini ve yorumlarını güncel tutar.

---

## 7. Bağımlılık Yönetimi — Dependabot (`.github/dependabot.yml`)

İki ekosistem:
1. **`bun`** — haftalık, en fazla 5 açık PR, commit prefix `chore(deps)`.
   - `minor` + `patch` güncellemeler tek PR'da gruplanır (review gürültüsü azalır).
   - **Major** bump'lar tek tek gelir (manuel inceleme gerektirir).
   - `bun.lock` kaynak doğruluk (source of truth); Bun ≥ 1.1.39 gerektirir.
2. **`github-actions`** — haftalık, commit prefix `ci`, hepsi tek grupta.
   SHA pin'leri ve `# vX.Y.Z` yorumlarını günceller.

---

## 8. Build-Time Senkronizasyon — `scripts/sync-docker-compose.mjs`

`build` script'i Astro'dan **önce** çalışır:
```json
"build": "node scripts/sync-docker-compose.mjs && astro build"
```

Bu script, ayrı `libredb-studio` reposundaki kanonik
`docker-compose.example.yml` dosyasını siteye çeker ve iki yere yazar:
- `src/data/docker-compose.example.yml` → sayfa tarafından `?raw` import edilir.
- `public/docker-compose.example.yml` → `curl/wget` ile ham indirilir.

**Çözümleme sırası (ilk başaran kazanır), build'i asla kırmayacak biçimde:**
1. Uzak GitHub raw URL (CI'da çalışır; 8 sn timeout'lu `fetch`).
2. Yerel kardeş checkout `../libredb-studio/...` (hızlı yerel geliştirme).
3. Mevcut commit'li kopya (offline / upstream henüz push'lanmamışsa).

Hiçbiri olmaz ve commit'li kopya da yoksa `exit(1)`. Aksi halde mevcut kopya
korunur ve sadece uyarı verilir — upstream geçici erişilemez diye build düşmez.

> ⚠️ **Geliştirici notu:** Bu script iki **takip edilen (tracked)** dosyayı
> her build'de yeniden yazar. Branch'i temiz tutmak için build sonrası bu iki
> dosyayı `git checkout` ile geri al. (Bkz. proje hafıza notu
> *"Build mutates tracked compose files"*.)

---

## 9. Editör Tutarlılığı — `.editorconfig`

IDE'den bağımsız temel kurallar: `utf-8`, `lf` satır sonu, 2 boşluk girinti,
dosya sonunda satır, trailing whitespace temizliği. İstisna: `*.md` dosyalarında
trailing whitespace korunur (Markdown'da satır sonu zorlamak için kullanılır).
Bu, Prettier'ın yapmadığı dil-agnostik tabanı sağlar.

---

## 10. Özet Akış Şeması

```
Geliştirici            Yerel Hook'lar              CI (ci.yml)            Deploy (deploy.yml)
──────────             ──────────────              ───────────            ───────────────────
git commit  ──────►  pre-commit                 (push/PR tetikler)
                     ├─ secrets
                     └─ format

git push    ──────►  pre-push        ──────────►  gate                   (release tetikler)
                     ├─ gate                      ├─ typecheck
                     │  ├─ typecheck              ├─ format
                     │  ├─ format                 ├─ lint
                     │  ├─ lint                   ├─ knip
                     │  ├─ knip                   ├─ test
                     │  └─ test                   ├─ secrets
                     └─ audit (uyarı)             ├─ audit (uyarı)
                                                  └─ build      ──────►  build + deploy
                                                                          (GitHub Pages, OIDC)
```

---

## Ek: Giderilen Tutarsızlık

`README.md` bir süre *"Any push to the `main` branch will trigger an automatic
build and deployment"* diyordu; gerçek davranış ise `deploy.yml`'de
`release: published` ile kapılıdır. README'nin Deployment bölümü, iki
workflow'un ayrımını ve tag + release akışını anlatacak şekilde güncellendi —
artık bu belgeyle tutarlı.
