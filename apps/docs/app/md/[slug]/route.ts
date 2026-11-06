import { pageMarkdown } from "@/lib/doc/markdown";
import { isSlug, slugParams } from "@/lib/nav";
import { textResponse } from "@/lib/responses";
import { LLMS_URL, pageUrl } from "@/lib/site";

const generateStaticParams = slugParams;

const GET = async (_: Request, context: RouteContext<"/md/[slug]">) => {
  const { slug } = await context.params;

  if (!isSlug(slug)) {
    return textResponse("Not found\n", "text/markdown", { status: 404 });
  }

  return textResponse(pageMarkdown(slug), "text/markdown", {
    headers: {
      Link: `<${pageUrl(slug)}>; rel="canonical", <${LLMS_URL}>; rel="llms-txt"`,
      Vary: "Accept",
    },
  });
};

export { GET, generateStaticParams };
export const dynamic = "force-static";
export const dynamicParams = false;
