import { readFile } from "node:fs/promises";
import path from "node:path";

import { apiDoc, defaultOf } from "./api";
import { demoSource } from "./demo-source";

const DEMO = /<Demo name="(?<name>[^"]+)" \/>/gu;
const API = /<ApiTable file="(?<file>[^"]+)" name="(?<name>[^"]+)" \/>/gu;
const METADATA = /^export const metadata[\s\S]*?\n\n/mu;

const replaceAsync = async (
  text: string,
  pattern: RegExp,
  render: (groups: Record<string, string>) => Promise<string>
): Promise<string> => {
  const parts = await Promise.all(
    [...text.matchAll(pattern)].map(
      async (match) => await render(match.groups ?? {})
    )
  );
  let index = 0;
  return text.replace(pattern, () => {
    const part = parts[index] ?? "";
    index += 1;
    return part;
  });
};

const cell = (text: string) =>
  text.replaceAll("|", "\\|").replaceAll("\n", " ");

const demoMarkdown = async ({ name = "" }: Record<string, string>) =>
  `\`\`\`tsx\n${await demoSource(name)}\`\`\``;

const apiMarkdown = async ({
  file = "",
  name = "",
}: Record<string, string>) => {
  const doc = await apiDoc(file, name);
  const rows = doc.entries.map((entry) => {
    const fallback = defaultOf(entry);
    const shown = fallback === undefined ? "" : `\`${fallback}\``;
    return `| \`${entry.name}\` | \`${cell(entry.type)}\` | ${shown} | ${cell(entry.description)} |`;
  });
  return [
    "| Name | Type | Default | Description |",
    "| --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
};

export const pageMarkdown = async (slug: string): Promise<string> => {
  const raw = await readFile(
    path.join(process.cwd(), "content", `${slug}.mdx`),
    "utf-8"
  );
  const withDemos = await replaceAsync(
    raw.replace(METADATA, ""),
    DEMO,
    demoMarkdown
  );
  return await replaceAsync(withDemos, API, apiMarkdown);
};
