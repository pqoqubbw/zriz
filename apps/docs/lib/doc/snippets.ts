import { readFileSync } from "node:fs";
import path from "node:path";

import type { BlockOf } from "@/lib/doc/schema";

const SNIPPETS_DIR = path.join(process.cwd(), "snippets");

const EXAMPLE_PREFIX = "export const example = ";

const LANGUAGES = {
  css: { fence: "css", shiki: "css" },
  html: { fence: "html", shiki: "html" },
  json: { fence: "json", shiki: "json" },
  sh: { fence: "sh", shiki: "shellscript" },
  ts: { fence: "ts", shiki: "ts" },
  tsx: { fence: "tsx", shiki: "tsx" },
} as const;

type Language = (typeof LANGUAGES)[keyof typeof LANGUAGES];

const read = (file: string): string =>
  readFileSync(path.join(SNIPPETS_DIR, file), "utf-8").replace(/\n+$/u, "");

const fragment = (source: string, file: string): string => {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line.startsWith(EXAMPLE_PREFIX));
  const first = lines[start];

  if (first === undefined) {
    throw new Error(`${file}: no ${EXAMPLE_PREFIX}`);
  }

  if (!first.endsWith("(")) {
    return first.slice(EXAMPLE_PREFIX.length).replace(/;$/u, "");
  }

  const end = lines.findIndex((line, i) => i > start && line === ");");

  if (end === -1) {
    throw new Error(`${file}: no closing );`);
  }

  let body = lines.slice(start + 1, end).map((line) => line.slice(2));

  if (body[0] === "<>" && body.at(-1) === "</>") {
    body = body.slice(1, -1).map((line) => line.slice(2));
  }

  return body.join("\n");
};

const isFragment = (file: string): boolean => file.endsWith(".jsx.tsx");

const sourceOf = (file: string): string => {
  const source = read(file);

  return isFragment(file) ? fragment(source, file) : source;
};

const lineOf = (
  lines: readonly string[],
  prefix: string,
  from: number,
  file: string
): number => {
  const hits = lines.flatMap((line, i) =>
    i >= from && line.trim().startsWith(prefix) ? [i] : []
  );
  const [hit] = hits;

  if (hit === undefined) {
    throw new Error(`${file}: no line starts with ${prefix}`);
  }

  return hit;
};

const dedent = (lines: readonly string[]): string => {
  const cut = Math.min(
    ...lines
      .filter((line) => line.trim() !== "")
      .map((line) => line.length - line.trimStart().length)
  );

  return lines.map((line) => line.slice(cut)).join("\n");
};

const excerptOf = ({ file, ranges }: BlockOf<"excerpt">): string => {
  const lines = sourceOf(file).split("\n");
  const chunks: string[] = [];
  let after = 0;

  for (const [start, end] of ranges) {
    const from = lineOf(lines, start, after, file);
    const to = end === null ? from : lineOf(lines, end, from, file);

    chunks.push(dedent(lines.slice(from, to + 1)));
    after = to + 1;
  }

  return chunks.join("\n\n");
};

const textOf = (block: BlockOf<"code" | "excerpt">): string =>
  block.kind === "code" ? sourceOf(block.file) : excerptOf(block);

const isExtension = (ext: string): ext is keyof typeof LANGUAGES =>
  Object.hasOwn(LANGUAGES, ext);

const languageOf = (file: string): Language => {
  const ext = file.split(".").pop() ?? "";

  return isExtension(ext) ? LANGUAGES[ext] : LANGUAGES.tsx;
};

export { isFragment, languageOf, textOf };
