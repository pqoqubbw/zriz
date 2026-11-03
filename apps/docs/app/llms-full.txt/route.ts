import { fullMarkdown } from "@/lib/doc/llms";
import { textResponse } from "@/lib/responses";

const GET = () => textResponse(fullMarkdown(), "text/plain");

export { GET };
export const dynamic = "force-static";
