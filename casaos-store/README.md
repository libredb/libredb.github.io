# LibreDB's own CasaOS / ZimaOS app store

A user adds this store in CasaOS or ZimaOS under **App Store → Add source** with

```
https://libredb.org/casaos-store
```

and installs the current LibreDB Studio from it.

## Why this exists

The official CasaOS store carries LibreDB Studio, and a version bump there is a
pull request that a maintainer merges. Measured on 23 October 2026: our bump to
1.0.0 (IceWhaleTech/CasaOS-AppStore#1089) had been open for seven days, its
checks were green and nothing was asked of us - the repository merged no pull
request at all in the two days before, so the delay was attention rather than a
defect on our side. A store we publish ourselves does not wait for that, and the
official pull request stays open: both channels end up on the same release.

This is their own documented third-party path, not a workaround - the official
store's README links a third-party store guide and lists third-party stores.

## Layout

- `casaos-store/` - the source we edit: `store-config.json`,
  `supported-languages.json`, `Apps/LibreDBStudio/`.
- `public/casaos-store/` - the generated output the site serves. It is committed
  rather than built at deploy time so that the store answers even if a build
  step changes, and so a reviewer can read exactly what is published.

## Regenerating

`.github/workflows/casaos-store.yml` rebuilds it with IceWhaleTech's own
`build-appstore-action` whenever the source changes, and can be run by hand for
a release. It was also verified locally before the first commit: the build
produced `store.json`, `index.json` (carrying 1.0.0), per-architecture compose
files, `meta.json` for eight locales, webp assets, and `metadata.tar.gz` with
its sha256.

## What the store serves

| file                                                       | what it is                          |
| ---------------------------------------------------------- | ----------------------------------- |
| `store.json`, `store.{locale}.json`                        | store identity and localized text   |
| `index.json`, `index.{locale}.json`                        | the app list a client reads first   |
| `apps/org.libredb.studio/docker-compose.yml`               | the install the client runs         |
| `apps/org.libredb.studio/docker-compose.{amd64,arm64}.yml` | per-architecture variants           |
| `apps/org.libredb.studio/meta.json`                        | title, tagline, description, assets |
| `metadata.tar.gz` + `metadata.sha256`                      | the whole metadata set, hashed      |

The app id is `org.libredb.studio`. In the official store the same app is
`org.icewhale.libredbstudio`, because an id there belongs to that store's
namespace; the two can sit side by side.
