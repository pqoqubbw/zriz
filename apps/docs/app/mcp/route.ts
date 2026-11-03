import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

import { plain } from "@/lib/doc/inline";
import { pageMarkdown } from "@/lib/doc/markdown";
import { DOCS } from "@/lib/docs";
import { isSlug, PAGE_ORDER, titleOf } from "@/lib/nav";

const STOP_WORDS = new Set(
  "a an and are can do does for from how i in is it my of on or the to use what when with you your".split(
    " "
  )
);

const wordsOf = (text: string): string[] =>
  (text.toLowerCase().match(/[a-z0-9@./-]+/gu) ?? []).filter(
    (word) => word.length > 2 && !STOP_WORDS.has(word)
  );

const SEARCH_INDEX = new Map(
  PAGE_ORDER.map((slug) => {
    const markdown = pageMarkdown(slug, true);
    const summary = plain(DOCS[slug].lede);
    const title = titleOf(slug);
    const body = wordsOf(markdown);
    const counts = new Map<string, number>();

    for (const word of body) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }

    return [
      slug,
      {
        counts,
        lede: new Set(wordsOf(summary)),
        markdown,
        size: body.length,
        summary,
        title,
        titleWords: new Set(wordsOf(title)),
      },
    ] as const;
  })
);

const search = (query: string): string => {
  const words = wordsOf(query);
  const hits = [...SEARCH_INDEX]
    .map(([slug, page]) => ({
      page,
      score: words.reduce(
        (sum, word) =>
          sum +
          (page.titleWords.has(word) ? 10 : 0) +
          (page.lede.has(word) ? 5 : 0) +
          ((page.counts.get(word) ?? 0) * 100) / page.size,
        0
      ),
      slug,
    }))
    .filter((hit) => hit.score > 0)
    .toSorted((a, b) => b.score - a.score)
    .slice(0, 8);

  if (hits.length === 0) {
    return "no page matches. call get_page with introduction to start.";
  }

  return hits
    .map(({ page, slug }) => `${slug}: ${page.title}. ${page.summary}`)
    .join("\n");
};

const slugOf = (input: string): string =>
  input
    .trim()
    .replace(/^.*\/docs\//u, "")
    .replace(/\.md$/u, "")
    .replaceAll(" ", "-");

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
              text: `no page ${slug}. pages: ${PAGE_ORDER.join(", ")}`,
              type: "text",
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          { text: SEARCH_INDEX.get(wanted)?.markdown ?? "", type: "text" },
        ],
      };
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

export { handle as DELETE, handle as GET, handle as POST };
