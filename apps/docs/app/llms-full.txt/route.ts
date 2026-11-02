import { fullMarkdown } from "@/lib/doc/markdown";

export const dynamic = "force-static";

export const GET = () =>
  new Response(fullMarkdown(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
