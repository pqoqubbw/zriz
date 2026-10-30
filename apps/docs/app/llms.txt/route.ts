import { pages } from "@/lib/pages";

export const dynamic = "force-static";

export const GET = () =>
  new Response(
    [
      "# zriz",
      "",
      "> Headless image cropper for React with the feel of iOS Photos. Packages: @zriz/react, @zriz/core.",
      "",
      "## Docs",
      "",
      ...pages.map(
        (page) =>
          `- [${page.title}](https://zriz.dev/docs/${page.slug}.md): ${page.description}`
      ),
      "",
      "- [Full docs in one file](https://zriz.dev/llms-full.txt)",
      "",
    ].join("\n"),
    { headers: { "Content-Type": "text/plain; charset=utf-8" } }
  );
