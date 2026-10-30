import { readFile } from "node:fs/promises";
import path from "node:path";

import { createGenerator } from "fumadocs-typescript";
import type { DocEntry, GeneratedDoc } from "fumadocs-typescript";

const generator = createGenerator({
  tsconfigPath: path.join(process.cwd(), "tsconfig.json"),
});
const source = path.join(process.cwd(), "../../packages/react/src");
const own = source.toLowerCase();

const declarationPath = (symbol: unknown): string | undefined => {
  if (typeof symbol !== "object" || symbol === null) {
    return undefined;
  }
  const declarations: unknown[] = [];
  if ("valueDeclaration" in symbol) {
    declarations.push(symbol.valueDeclaration);
  }
  if ("declarations" in symbol && Array.isArray(symbol.declarations)) {
    declarations.push(...(symbol.declarations as unknown[]));
  }
  for (const declaration of declarations) {
    if (
      typeof declaration === "object" &&
      declaration !== null &&
      "path" in declaration &&
      typeof declaration.path === "string"
    ) {
      return declaration.path;
    }
  }
  return undefined;
};

export const apiDoc = async (
  file: string,
  name: string
): Promise<GeneratedDoc> => {
  const kept = new Set<string>();
  const full = path.join(source, file);
  const [doc] = await generator.generateDocumentation(
    { content: await readFile(full, "utf-8"), path: full },
    name,
    {
      transform(entry, _type, symbol) {
        if (declarationPath(symbol)?.toLowerCase().startsWith(own) === true) {
          kept.add(entry.name);
        }
      },
    }
  );
  if (doc === undefined) {
    throw new Error(`no docs for ${name} in ${file}`);
  }
  return {
    ...doc,
    entries: doc.entries.filter((entry) => kept.has(entry.name)),
  };
};

export const defaultOf = (entry: DocEntry): string | undefined =>
  entry.tags.find((tag) => tag.name === "default")?.text;
