import { describe, expect, it } from "vitest";

import config from "../next.config";

const POLICY = {
  "base-uri": ["'none'"],
  "connect-src": ["'self'", "blob:", "data:"],
  "default-src": ["'self'"],
  "font-src": ["'self'"],
  "form-action": ["'none'"],
  "frame-ancestors": ["'none'"],
  "img-src": ["'self'", "blob:", "data:"],
  "object-src": ["'none'"],
  "script-src": ["'self'", "'unsafe-inline'"],
  "style-src": ["'self'"],
  "style-src-attr": ["'unsafe-inline'"],
  "worker-src": ["blob:"],
};

const headersFor = async (source: string) => {
  const rules = (await config.headers?.()) ?? [];
  const rule = rules.find((entry) => entry.source === source);

  return new Map(
    (rule?.headers ?? []).map((header) => [header.key, header.value])
  );
};

const directivesOf = (policy: string) =>
  Object.fromEntries(
    policy.split(";").map((part) => {
      const [name = "", ...values] = part.trim().split(/\s+/u);

      return [name, values];
    })
  );

describe("security headers", () => {
  it("sends the content security policy on every path", async () => {
    const headers = await headersFor("/:path*");
    const policy = headers.get("Content-Security-Policy") ?? "";

    expect(directivesOf(policy)).toStrictEqual(POLICY);

    expect(Object.fromEntries(headers)).toMatchObject({
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    });
  });
});
