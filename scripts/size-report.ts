import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

interface Entry {
  limit: number | undefined;
  name: string;
  size: number;
}

interface Row {
  base: Entry | undefined;
  head: Entry | undefined;
  key: string;
}

const SHA = /^[0-9a-f]{40}$/u;
const PACKAGE = /^[a-z0-9-]{1,40}\.json$/u;
const MAX_ENTRIES = 200;
const MAX_NAME = 120;
const KILO = 1000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isBytes = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

const toEntry = (value: unknown): Entry => {
  if (!isRecord(value)) {
    throw new TypeError("size entry is not an object");
  }
  const { name, size, sizeLimit } = value;
  if (typeof name !== "string" || name.length > MAX_NAME || !isBytes(size)) {
    throw new TypeError("size entry has no valid name or size");
  }
  if (sizeLimit !== undefined && !isBytes(sizeLimit)) {
    throw new TypeError(`size entry ${name} has an invalid limit`);
  }
  return { limit: sizeLimit, name, size };
};

const readEntries = (file: string): Entry[] => {
  const data: unknown = JSON.parse(readFileSync(file, "utf-8"));
  if (!Array.isArray(data) || data.length > MAX_ENTRIES) {
    throw new TypeError(`${file} is not a size-limit json list`);
  }
  return data.map(toEntry);
};

const readSide = (dir: string): Map<string, Entry> | undefined => {
  if (!existsSync(dir)) {
    return undefined;
  }
  const entries = new Map<string, Entry>();
  for (const file of readdirSync(dir).filter((name) => PACKAGE.test(name))) {
    const pkg = file.slice(0, -".json".length);
    for (const entry of readEntries(path.join(dir, file))) {
      entries.set(`${pkg}\u0000${entry.name}`, entry);
    }
  }
  return entries;
};

const readBase = (dir: string): Map<string, Entry> | undefined => {
  try {
    return readSide(dir);
  } catch {
    return undefined;
  }
};

const cell = (text: string): string =>
  text
    .replaceAll(/[\r\n\t]/gu, " ")
    .replaceAll(/[\\|<>[\]`*_~#&!]/gu, (char) => `\\${char}`);

const bytes = (value: number): string =>
  value < KILO
    ? `${value} B`
    : `${(value / KILO).toFixed(2).replace(/\.?0+$/u, "")} kB`;

const delta = (base: number, head: number): string => {
  const diff = head - base;
  if (diff === 0) {
    return "0";
  }
  const sign = diff > 0 ? "+" : "-";
  const percent =
    base === 0
      ? ""
      : ` (${sign}${((Math.abs(diff) / base) * 100).toFixed(1)}%)`;
  return `${sign}${bytes(Math.abs(diff))}${percent}`;
};

const note = (row: Row, measured: boolean): string => {
  const { base, head } = row;
  if (!head) {
    return "removed";
  }
  if (head.limit !== undefined && head.size > head.limit) {
    return "over limit";
  }
  if (!base) {
    return measured ? "new" : "";
  }
  if (base.limit !== head.limit) {
    return `limit changed, was ${base.limit === undefined ? "none" : bytes(base.limit)}`;
  }
  return "";
};

const HEADER = [
  "| package | entry | base | head | change | limit | note |",
  "| --- | --- | ---: | ---: | ---: | ---: | --- |",
];

const toLine = (row: Row, measured: boolean): string => {
  const [pkg = "", name = ""] = row.key.split("\u0000");
  const before = row.base ? bytes(row.base.size) : "";
  const after = row.head ? bytes(row.head.size) : "";
  const change =
    row.base && row.head ? delta(row.base.size, row.head.size) : "";
  const limit = row.head?.limit === undefined ? "" : bytes(row.head.limit);
  return `| ${cell(pkg)} | ${cell(name)} | ${before} | ${after} | ${change} | ${limit} | ${note(row, measured)} |`;
};

const isQuiet = (row: Row, measured: boolean): boolean =>
  note(row, measured) === "" &&
  (!measured || row.base?.size === row.head?.size);

const subtitle = (measured: boolean, sha: string | undefined): string => {
  if (!measured) {
    return "base not measured";
  }
  return sha === undefined
    ? "compared with the base commit"
    : `compared with ${sha.slice(0, 7)}`;
};

const render = (
  base: Map<string, Entry> | undefined,
  head: Map<string, Entry>,
  sha: string | undefined
): string => {
  const measured = base !== undefined;
  const keys = [...new Set([...head.keys(), ...(base?.keys() ?? [])])];
  const rows: Row[] = keys.map((key) => ({
    base: base?.get(key),
    head: head.get(key),
    key,
  }));
  const changed = rows.filter((row) => !isQuiet(row, measured));
  const lines = [
    "### bundle size",
    "",
    `minified and brotlied, ${subtitle(measured, sha)}`,
    "",
  ];
  if (changed.length === 0) {
    lines.push(
      measured ? "no entry changed" : "every entry is within its limit"
    );
  } else {
    lines.push(...HEADER, ...changed.map((row) => toLine(row, measured)));
  }
  lines.push(
    "",
    `<details><summary>all ${rows.length} entries</summary>`,
    "",
    ...HEADER,
    ...rows.map((row) => toLine(row, measured)),
    "",
    "</details>"
  );
  return `${lines.join("\n")}\n`;
};

const [baseDir, headDir] = process.argv.slice(2);
if (baseDir === undefined || headDir === undefined) {
  throw new Error("usage: node scripts/size-report.ts <base dir> <head dir>");
}
const head = readSide(headDir);
if (!head) {
  throw new Error(`${headDir} has no size-limit results`);
}
const sha = process.env.BASE_SHA;
process.stdout.write(
  render(
    readBase(baseDir),
    head,
    sha !== undefined && SHA.test(sha) ? sha : undefined
  )
);
