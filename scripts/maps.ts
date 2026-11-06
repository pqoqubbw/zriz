import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

interface SourceMap {
  sources: string[];
}

const isSourceMap = (value: unknown): value is SourceMap =>
  typeof value === "object" &&
  value !== null &&
  "sources" in value &&
  Array.isArray(value.sources) &&
  value.sources.every((source) => typeof source === "string");

const dist = path.resolve(process.cwd(), process.argv[2] ?? "dist");
const maps = readdirSync(dist, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".js.map"))
  .map((entry) => path.join(entry.parentPath, entry.name));

if (maps.length === 0) {
  throw new Error(`no source maps in ${dist}`);
}

for (const file of maps) {
  const map: unknown = JSON.parse(readFileSync(file, "utf-8"));

  if (!isSourceMap(map)) {
    throw new TypeError(`${file} is not a source map`);
  }

  for (const source of map.sources) {
    if (!existsSync(path.resolve(path.dirname(file), source))) {
      throw new Error(`${file} points at ${source}, which does not exist`);
    }
  }

  writeFileSync(file, JSON.stringify({ ...map, sourcesContent: undefined }));
}
