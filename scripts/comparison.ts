import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

interface Page {
  downloads: string;
  repo: string;
  slug: string;
  versions: string[];
}

interface Zriz {
  downloads: number;
  stars: number | undefined;
  version: string;
}

const CONTENT = "apps/docs/content";
const HUB = "comparison.ts";
const KILO = 1000;
const MILLION = 1_000_000;
const KEPT_DIGITS = 2;
const ZRIZ_REPO = "pqoqubbw/zriz";
const ZRIZ_PACKAGE = "@zriz/react";
const DOWNLOADS_CAP = 1000;
const STARS_CAP = 100;
const STARS_CELL = "Under 100";

const PAGES: Page[] = [
  {
    downloads: "react-easy-crop",
    repo: "ValentinH/react-easy-crop",
    slug: "zriz-vs-react-easy-crop",
    versions: ["react-easy-crop"],
  },
  {
    downloads: "react-image-crop",
    repo: "dominictobias/react-image-crop",
    slug: "zriz-vs-react-image-crop",
    versions: ["react-image-crop"],
  },
  {
    downloads: "cropperjs",
    repo: "fengyuanchen/cropperjs",
    slug: "zriz-vs-cropperjs",
    versions: ["cropperjs"],
  },
  {
    downloads: "@ark-ui/react",
    repo: "chakra-ui/ark",
    slug: "zriz-vs-ark-ui",
    versions: ["@ark-ui/react", "@zag-js/image-cropper"],
  },
  {
    downloads: "react-avatar-editor",
    repo: "mosch/react-avatar-editor",
    slug: "zriz-vs-react-avatar-editor",
    versions: ["react-avatar-editor"],
  },
  {
    downloads: "react-cropper",
    repo: "react-cropper/react-cropper",
    slug: "zriz-vs-react-cropper",
    versions: ["react-cropper"],
  },
  {
    downloads: "@uppy/image-editor",
    repo: "transloadit/uppy",
    slug: "zriz-vs-uppy-image-editor",
    versions: ["@uppy/image-editor"],
  },
  {
    downloads: "react-advanced-cropper",
    repo: "advanced-cropper/react-advanced-cropper",
    slug: "zriz-vs-react-advanced-cropper",
    versions: ["react-advanced-cropper"],
  },
  {
    downloads: "croppie",
    repo: "Foliotek/Croppie",
    slug: "zriz-vs-croppie",
    versions: ["croppie"],
  },
  {
    downloads: "antd-img-crop",
    repo: "nanxiaobei/antd-img-crop",
    slug: "zriz-vs-antd-img-crop",
    versions: ["antd-img-crop"],
  },
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const escape = (text: string): string =>
  text.replaceAll(/[.*+?^${}()|[\]\\/]/gu, String.raw`\$&`);

const read = (file: string): string => readFileSync(file, "utf-8");

const getField = async (url: string, field: string): Promise<unknown> => {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`);
  }
  const data: unknown = await response.json();
  if (!isRecord(data)) {
    throw new TypeError(`${url} did not answer with an object`);
  }
  return data[field];
};

const getCount = async (url: string, field: string): Promise<number> => {
  const value = await getField(url, field);
  if (typeof value !== "number") {
    throw new TypeError(`${url} has no number in ${field}`);
  }
  return value;
};

const getText = async (url: string, field: string): Promise<string> => {
  const value = await getField(url, field);
  if (typeof value !== "string") {
    throw new TypeError(`${url} has no text in ${field}`);
  }
  return value;
};

const weekly = async (name: string): Promise<number> =>
  await getCount(
    `https://api.npmjs.org/downloads/point/last-week/${name}`,
    "downloads"
  );

const latest = async (name: string): Promise<string> =>
  await getText(`https://registry.npmjs.org/${name}/latest`, "version");

const starsOf = async (repo: string): Promise<number | undefined> => {
  try {
    return await getCount(
      `https://api.github.com/repos/${repo}`,
      "stargazers_count"
    );
  } catch {
    return undefined;
  }
};

const rounded = (count: number): string => {
  const step = 10 ** Math.max(0, String(count).length - KEPT_DIGITS);
  const value = Math.floor(count / step) * step;
  if (value >= MILLION) {
    return `${value / MILLION}M+`;
  }
  if (value >= KILO) {
    return `${value / KILO}k+`;
  }
  return `${value}+`;
};

const cell = (source: string, label: string): string | undefined =>
  new RegExp(`"${escape(label)}",\\s*"(?<value>[^",]+)`, "u").exec(source)
    ?.groups?.value;

const stale = (
  file: string,
  what: string,
  page: string | undefined,
  now: string
): string[] =>
  page === now
    ? []
    : [
        `stale: ${file}: ${what} is "${page ?? "missing"}" on the page, now "${now}"`,
      ];

const staleStars = (
  file: string,
  repo: string,
  page: string | undefined,
  stars: number | undefined
): string[] =>
  stars === undefined
    ? [`skipped: ${file}: GitHub did not answer for the stars of ${repo}`]
    : stale(file, "GitHub stars", page, rounded(stars));

const limitOf = (config: string, name: string): number => {
  const found = new RegExp(
    `limit: "(?<bytes>\\d+) B",[^}]*name: "${escape(name)}"`,
    "u"
  ).exec(config)?.groups?.bytes;
  if (found === undefined) {
    throw new Error(`no size limit named ${name}`);
  }
  return Number(found);
};

const checkSizes = (file: string, source: string): string[] => {
  const config = read("packages/react/.size-limit.ts");
  const avatar = limitOf(config, "avatar");
  const editor = limitOf(config, "editor (every part)");
  const later = limitOf(config, "avatar total (with lazy chunks)") - avatar;
  const range = `${Math.round(avatar / KILO)} to ${Math.ceil(editor / KILO)} kB`;
  const more = `up to ${Math.round(later / KILO)} kB more`;
  return [
    ...[...new Set(source.match(/\d+ to \d+ kB/gu))].flatMap((found) =>
      stale(file, "zriz size", found, range)
    ),
    ...[...new Set(source.toLowerCase().match(/up to \d+ kb more/gu))].flatMap(
      (found) =>
        stale(file, "zriz size loaded later", found.replace("kb", "kB"), more)
    ),
  ];
};

const checkCaps = (file: string, source: string, zriz: Zriz): string[] => {
  const found: string[] = [];
  if (
    zriz.stars !== undefined &&
    zriz.stars >= STARS_CAP &&
    source.includes(`"${STARS_CELL}"`)
  ) {
    found.push(...stale(file, "zriz stars", STARS_CELL, rounded(zriz.stars)));
  }
  if (
    zriz.downloads >= DOWNLOADS_CAP &&
    /Under 1,000|under a thousand downloads/u.test(source)
  ) {
    found.push(
      ...stale(file, "zriz downloads", "under 1,000", rounded(zriz.downloads))
    );
  }
  return found;
};

const checkZriz = (file: string, source: string, zriz: Zriz): string[] => [
  ...[
    ...source.matchAll(/`@zriz\/(?:core|react)` (?<version>\d+\.\d+\.\d+)/gu),
  ].flatMap((match) =>
    stale(file, "zriz version", match.groups?.version, zriz.version)
  ),
  ...checkCaps(file, source, zriz),
  ...checkSizes(file, source),
];

const checkVersion = async (
  file: string,
  source: string,
  name: string
): Promise<string[]> => {
  const page = new RegExp(
    `\`?${escape(name)}\`? (?<version>\\d+\\.\\d+\\.\\d+)`,
    "u"
  ).exec(source)?.groups?.version;
  const now = await latest(name);
  return page === now
    ? []
    : [
        `new version: ${file}: ${name} is ${page ?? "missing"} on the page, latest is ${now}. Do not edit, report it.`,
      ];
};

const checkPage = async (
  page: Page,
  hub: string,
  zriz: Zriz
): Promise<string[]> => {
  const file = `${page.slug}.ts`;
  const source = read(path.join(CONTENT, file));
  const [downloads, stars, versions] = await Promise.all([
    weekly(page.downloads),
    starsOf(page.repo),
    Promise.all(
      page.versions.map(async (name) => await checkVersion(file, source, name))
    ),
  ]);
  const entry = new RegExp(
    `meta: "(?<value>[^"]+)",[^}]*\\]\\(${escape(page.slug)}\\)`,
    "u"
  ).exec(hub)?.groups?.value;
  return [
    ...stale(
      file,
      "npm downloads a week",
      cell(source, "npm downloads a week"),
      rounded(downloads)
    ),
    ...staleStars(file, page.repo, cell(source, "GitHub stars"), stars),
    ...stale(HUB, `downloads of ${page.slug}`, entry, rounded(downloads)),
    ...versions.flat(),
    ...checkZriz(file, source, zriz),
  ];
};

const ownVersion = (): string => {
  const data: unknown = JSON.parse(read("packages/react/package.json"));
  if (!isRecord(data) || typeof data.version !== "string") {
    throw new TypeError("packages/react/package.json has no version");
  }
  return data.version;
};

const main = async (): Promise<string[]> => {
  const [downloads, stars] = await Promise.all([
    weekly(ZRIZ_PACKAGE),
    starsOf(ZRIZ_REPO),
  ]);
  const zriz: Zriz = { downloads, stars, version: ownVersion() };
  const hub = read(path.join(CONTENT, HUB));
  const pages = await Promise.all(
    PAGES.map(async (page) => await checkPage(page, hub, zriz))
  );
  return [...pages.flat(), ...checkZriz(HUB, hub, zriz)];
};

try {
  const lines = await main();
  process.stdout.write(
    `${lines.length > 0 ? lines.join("\n") : "comparison pages: nothing to update"}\n`
  );
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  process.stdout.write(
    `skipped: the comparison check did not finish. ${reason}\n`
  );
}
