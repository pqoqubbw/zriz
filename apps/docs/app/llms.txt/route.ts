import { indexMarkdown } from "@/lib/doc/markdown";

export const dynamic = "force-static";

export const GET = () =>
  new Response(indexMarkdown(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
