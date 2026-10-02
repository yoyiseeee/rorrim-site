# Rorrim Site

An interactive mirror-themed web experience built with Next.js, React, Framer Motion, and Three.js.

Live site: <https://yoyiseeee.github.io/rorrim-site/>

## Local development

```bash
npm ci
npm run dev
```

Open <http://localhost:3000>.

## Production build

```bash
NEXT_PUBLIC_BASE_PATH=/rorrim-site npm run build
npm run pages:prepare -- out
```

The repository deploys automatically to GitHub Pages after a push to `main`. The deployment workflow exports the Next.js app, prefixes root-relative CSS assets with `/rorrim-site`, verifies that referenced fonts and cursor assets exist, and publishes a fresh `gh-pages` branch.

Large source datasets used to generate some experiments are intentionally excluded from Git. The public build uses the checked-in, pre-baked web assets so that it remains deployable on GitHub Pages.

## License

The source code is available under the [MIT License](LICENSE). Fonts, audio, video, images, and other media assets are not covered by that license; see [ASSETS_LICENSE.md](ASSETS_LICENSE.md).
