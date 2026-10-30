import { pageMarkdown } from "@/lib/markdown";
import { pages } from "@/lib/pages";

export const dynamic = "force-static";
export const dynamicParams = false;
export const generateStaticParams = () => pages.map(({ slug }) => ({ slug }));

export const GET = async (_: Request, context: RouteContext<"/md/[slug]">) => {
  const { slug } = await context.params;
  return new Response(await pageMarkdown(slug), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
