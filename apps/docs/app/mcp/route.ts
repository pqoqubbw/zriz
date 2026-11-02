import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

import { plain } from "@/lib/doc/inline";
import { pageMarkdown } from "@/lib/doc/markdown";
import { docs } from "@/lib/docs";
import { entries, isSlug } from "@/lib/nav";
import type { Slug } from "@/lib/nav";

export const runtime = "nodejs";

const stopwords = new Set(
  "a an and are can do does for from how i in is it my of on or the to use what when with you your".split(
    " "
  )
);

const wordsOf = (text: string): string[] =>
  (text.toLowerCase().match(/[a-z0-9@./-]+/gu) ?? []).filter(
    (word) => word.length > 2 && !stopwords.has(word)
  );

const index = entries.map((entry) => {
  const body = wordsOf(pageMarkdown(entry.slug, true));
  const counts = new Map<string, number>();
  for (const word of body) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return {
    counts,
    entry,
    lede: new Set(wordsOf(plain(docs[entry.slug].lede))),
    size: body.length,
    title: new Set(wordsOf(entry.title)),
  };
});

const search = (query: string): string => {
  const words = wordsOf(query);
  const hits = index
    .map((page) => ({
      page,
      score: words.reduce(
        (sum, word) =>
          sum +
          (page.title.has(word) ? 10 : 0) +
          (page.lede.has(word) ? 5 : 0) +
          ((page.counts.get(word) ?? 0) * 100) / page.size,
        0
      ),
    }))
    .filter((hit) => hit.score > 0)
    .toSorted((a, b) => b.score - a.score)
    .slice(0, 8);
  if (hits.length === 0) {
    return "no page matches. call get_page with introduction to start.";
  }
  return hits
    .map(
      ({ page }) =>
        `${page.entry.slug}: ${page.entry.title}. ${plain(docs[page.entry.slug].lede)}`
    )
    .join("\n");
};

const slugOf = (input: string): string =>
  input
    .trim()
    .replace(/^.*\/docs\//u, "")
    .replace(/\.md$/u, "")
    .replaceAll(" ", "-");

const page = (slug: Slug): string => pageMarkdown(slug, true);

const serverOf = (): McpServer => {
  const server = new McpServer({ name: "zriz docs", version: "1.0.0" });
  server.registerTool(
    "search_docs",
    {
      description:
        "find zriz docs pages for a question. returns page slugs, titles and summaries.",
      inputSchema: { query: z.string().describe("words to look for") },
    },
    ({ query }) => ({ content: [{ text: search(query), type: "text" }] })
  );
  server.registerTool(
    "get_page",
    {
      description:
        "read one zriz docs page as markdown, by slug, such as quick-start or dial.",
      inputSchema: { slug: z.string().describe("the page slug or its url") },
    },
    ({ slug }) => {
      const wanted = slugOf(slug);
      if (!isSlug(wanted)) {
        return {
          content: [
            {
              text: `no page ${slug}. pages: ${entries.map((entry) => entry.slug).join(", ")}`,
              type: "text",
            },
          ],
          isError: true,
        };
      }
      return { content: [{ text: page(wanted), type: "text" }] };
    }
  );
  return server;
};

const handle = async (request: Request): Promise<Response> => {
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  });
  await serverOf().connect(transport);
  return await transport.handleRequest(request);
};

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
