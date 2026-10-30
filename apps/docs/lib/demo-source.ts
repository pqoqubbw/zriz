import { readFile } from "node:fs/promises";
import path from "node:path";

const demosDir = path.join(process.cwd(), "demos");

export const demoSource = async (name: string) => {
  const source = await readFile(path.join(demosDir, `${name}.tsx`), "utf-8");
  return source.replace(/^"use client";\n\n?/u, "");
};
