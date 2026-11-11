import type { NextFetchEvent, NextRequest } from "next/server";

import { trackServer } from "@/lib/analytics";

type AgentKind = "bot" | "llms" | "markdown" | "skill";

const AI_AGENTS =
  /gptbot|chatgpt|oai-searchbot|claudebot|claude-user|claude-searchbot|anthropic|perplexity|google-extended|ccbot|bytespider|amazonbot|applebot-extended|cohere|meta-externalagent|mistral|duckassistbot|youbot/iu;

const LLMS_PATHS = new Set(["/llms-full.txt", "/llms.txt"]);

const kindOf = (request: NextRequest): AgentKind | null => {
  const { pathname } = request.nextUrl;
  const agent = request.headers.get("user-agent") ?? "";

  if (LLMS_PATHS.has(pathname)) {
    return "llms";
  }

  if (pathname === "/skill.md" || pathname === "/migrate.md") {
    return "skill";
  }

  if (
    pathname.endsWith(".md") ||
    (request.headers.get("accept") ?? "").includes("text/markdown")
  ) {
    return "markdown";
  }

  return AI_AGENTS.test(agent) ? "bot" : null;
};

const agentOf = (userAgent: string): string =>
  AI_AGENTS.exec(userAgent)?.[0]?.toLowerCase() ??
  userAgent.split(/[\s/]/u)[0]?.toLowerCase() ??
  "";

const proxy = (request: NextRequest, event: NextFetchEvent): void => {
  const kind = kindOf(request);

  if (kind === null) {
    return;
  }

  const userAgent = request.headers.get("user-agent") ?? "";

  event.waitUntil(
    trackServer(request, {
      name: "agent_request",
      properties: {
        agent: agentOf(userAgent),
        kind,
        path: request.nextUrl.pathname,
        user_agent: userAgent.slice(0, 300),
      },
    })
  );
};

export const config = {
  matcher: ["/", "/docs/:path*", "/llms.txt", "/llms-full.txt", "/skill.md"],
};

export { proxy };
