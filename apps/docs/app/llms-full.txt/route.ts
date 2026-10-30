import { pageMarkdown } from "@/lib/markdown";
import { pages } from "@/lib/pages";

export const dynamic = "force-static";

export const GET = async () => {
  const docs = await Promise.all(
    pages.map(async (page) => await pageMarkdown(page.slug))
  );
  return new Response(docs.join("\n\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
