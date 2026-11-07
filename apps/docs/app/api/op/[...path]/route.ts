import { createRouteHandler } from "@openpanel/nextjs/server";
import type { NextRequest } from "next/server";

import { ANALYTICS_ON } from "@/lib/analytics";

const forward = createRouteHandler();

const handle = async (request: NextRequest): Promise<Response> =>
  ANALYTICS_ON ? await forward(request) : new Response(null, { status: 404 });

export { handle as GET, handle as POST };
