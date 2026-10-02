import { access, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const outputDirectory = path.resolve(process.argv[2] ?? "out");
const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/rorrim-site";
const basePath = `/${configuredBasePath.replace(/^\/+|\/+$/g, "")}`;

if (basePath === "/") {
  throw new Error("NEXT_PUBLIC_BASE_PATH must name the GitHub Pages repository path");
}

async function collectCssFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectCssFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith(".css")) {
      files.push(entryPath);
    }
  }

  return files;
}

function prefixRootUrls(css) {
  return css.replace(/url\(\s*(["']?)\/([^\)"']+)\1\s*\)/g, (match, quote, asset) => {
    const rootPath = `/${asset}`;
    if (rootPath === basePath || rootPath.startsWith(`${basePath}/`)) return match;
    return `url(${quote}${basePath}/${asset}${quote})`;
  });
}

function getRootUrls(css) {
  return Array.from(css.matchAll(/url\(\s*["']?(\/[^\)"']+)["']?\s*\)/g), (match) => match[1]);
}

function localFileForUrl(url) {
  const withoutQuery = url.split(/[?#]/, 1)[0];
  if (!withoutQuery.startsWith(`${basePath}/`)) {
    throw new Error(`Unprefixed root asset URL remains: ${url}`);
  }

  const relativeUrl = decodeURIComponent(withoutQuery.slice(basePath.length + 1));
  const localPath = path.resolve(outputDirectory, relativeUrl);
  const relativePath = path.relative(outputDirectory, localPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Asset URL escapes the Pages bundle: ${url}`);
  }
  return localPath;
}

const cssFiles = await collectCssFiles(outputDirectory);
let changedFiles = 0;
const assetUrls = new Set();

for (const cssFile of cssFiles) {
  const originalCss = await readFile(cssFile, "utf8");
  const preparedCss = prefixRootUrls(originalCss);
  if (preparedCss !== originalCss) {
    await writeFile(cssFile, preparedCss);
    changedFiles += 1;
  }
  for (const url of getRootUrls(preparedCss)) assetUrls.add(url);
}

for (const url of assetUrls) {
  await access(localFileForUrl(url));
}

console.log(
  `Prepared ${cssFiles.length} CSS files (${changedFiles} changed) and verified ${assetUrls.size} local assets under ${basePath}.`,
);
