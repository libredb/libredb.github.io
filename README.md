# LibreDB Studio Website

Official website for LibreDB Studio - The Modern, AI-Powered Open-Source SQL IDE.

## Tech Stack

- [Astro](https://astro.build) - Static Site Generator
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [TypeScript](https://www.typescriptlang.org/) - Type Safety

## Development

```bash
# Install dependencies
bun install

# Start dev server
bun dev

# Build for production
bun run build

# Preview production build
bun preview

# Full verification: typecheck, format, lint, dead-code, tests
bun run gate
```

`bun run gate` is the bar every change must clear. The `pre-push` hook runs it
locally and CI runs the same steps, so a failing gate never reaches `main`.

## Deployment

This site is deployed to GitHub Pages via GitHub Actions, in two deliberately
separate workflows:

| Workflow     | Trigger                                   | What it does                                                                     |
| ------------ | ----------------------------------------- | -------------------------------------------------------------------------------- |
| `ci.yml`     | pull request, push to `main`              | Verifies only — gate, secret scan, dependency audit, build. **Does not deploy.** |
| `deploy.yml` | `release: published` (or manual dispatch) | Builds and deploys to GitHub Pages.                                              |

**Pushing to `main` does not deploy.** Going live means tagging a version and
publishing a GitHub release:

```bash
# 1. Land the change on main (branch protection requires a pull request)
# 2. Bump the version in package.json — commit as `chore(release): X.Y.Z`
# 3. Tag that commit and publish the release
git tag vX.Y.Z && git push origin vX.Y.Z
gh release create vX.Y.Z --verify-tag --title "vX.Y.Z — short summary"
```

Publishing the release is what triggers `deploy.yml`.

See [`docs/TOOLCHAIN.md`](docs/TOOLCHAIN.md) for the full toolchain and CI/CD
reference.

## Links

- **Live Site**: https://libredb.org
- **Main Project**: https://github.com/libredb/libredb-studio
- **Live Demo**: https://app.libredb.org
- **LinkedIn**: https://www.linkedin.com/company/libredb

## License

MIT License
