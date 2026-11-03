import { indexMarkdown } from "@/lib/doc/llms";
import { textResponse } from "@/lib/responses";

const GET = () => textResponse(indexMarkdown(), "text/plain");

export { GET };
export const dynamic = "force-static";
