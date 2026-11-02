import { pageMarkdown } from "@/lib/doc/markdown";
import { isSlug, order, pathOf } from "@/lib/nav";
import { origin } from "@/lib/site";

export const dynamic = "force-static";
export const dynamicParams = false;
export const generateStaticParams = () => order.map((slug) => ({ slug }));

export const GET = async (_: Request, context: RouteContext<"/md/[slug]">) => {
  const { slug } = await context.params;
  if (!isSlug(slug)) {
    return new Response("not found\n", {
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
      status: 404,
    });
  }
  return new Response(pageMarkdown(slug), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      Link: `<${origin}${pathOf(slug)}>; rel="canonical", <${origin}/llms.txt>; rel="llms-txt"`,
      Vary: "Accept",
    },
  });
};
