import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const NAMESPACES = [
  "font-weight",
  "inset-shadow",
  "radius",
  "shadow",
  "text",
] as const;

const css = await readFile("app/globals.css", "utf-8");
const config = await readFile("lib/cn.ts", "utf-8");

const themeNamesOf = (namespace: string) => {
  const pattern = new RegExp(
    `^\\s*--${namespace}-(?<name>[a-z0-9-]+?):`,
    "gmu"
  );

  return [...css.matchAll(pattern)]
    .map((match) => match.groups?.name ?? "")
    .filter((name) => !name.includes("--"))
    .toSorted();
};

const listedNamesOf = (namespace: string) => {
  const key = namespace.includes("-") ? `"${namespace}"` : namespace;
  const list = new RegExp(`${key}: \\[(?<list>[^\\]]*)\\]`, "u").exec(config)
    ?.groups?.list;

  return [...(list ?? "").matchAll(/"(?<name>[^"]+)"/gu)]
    .map((match) => match.groups?.name ?? "")
    .toSorted();
};

describe("theme tokens", () => {
  it.each(NAMESPACES)(
    "lists the %s names of globals.css in cn",
    (namespace) => {
      expect(listedNamesOf(namespace)).toStrictEqual(themeNamesOf(namespace));
    }
  );
});
