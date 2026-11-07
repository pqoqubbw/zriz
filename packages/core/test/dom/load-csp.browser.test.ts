import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCropper } from "../../src";
import { attachImage, exportCrop, loadImage } from "../../src/dom";
import { lane } from "../../src/dom/worker";

const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const seen: { directive: string; uri: string }[] = [];
let jpeg: Blob;

const violated = async (directive: string, scheme: string): Promise<void> => {
  await expect
    .poll(
      () =>
        seen.some(
          (entry) =>
            entry.directive === directive && entry.uri.startsWith(scheme)
        ),
      { timeout: 2000 }
    )
    .toBeTruthy();
};

const messageOf = async (work: Promise<unknown>): Promise<string> =>
  await work.then(
    () => "resolved",
    (error: unknown) => (error instanceof Error ? error.message : String(error))
  );

const record = (event: SecurityPolicyViolationEvent): void => {
  seen.push({ directive: event.effectiveDirective, uri: event.blockedURI });
};

describe("load under a policy without blob: or data:", () => {
  beforeAll(async () => {
    const response = await fetch(
      new URL("../fixtures/orient-1.jpg", import.meta.url)
    );

    jpeg = await response.blob();
    document.addEventListener("securitypolicyviolation", record);
    const policy = document.createElement("meta");

    policy.httpEquiv = "Content-Security-Policy";
    policy.content = "img-src 'self'; connect-src 'self' ws: wss:";
    document.head.append(policy);
  });

  afterAll(() => {
    document.removeEventListener("securitypolicyviolation", record);
  });

  it("still opens and exports a raster file", async () => {
    const cropper = createCropper();

    attachImage(cropper, await loadImage(jpeg));
    const result = await exportCrop(cropper, { type: "image/png" });

    expect(result.type).toBe("image/png");
    attachImage(cropper, null);
  });

  it.each([
    ["data", async () => await Promise.resolve(PIXEL)],
    ["blob", async () => await Promise.resolve(URL.createObjectURL(jpeg))],
  ])("names connect-src for a blocked %s url", async (scheme, url) => {
    const source = await url();
    const message = await messageOf(loadImage(source));

    URL.revokeObjectURL(source);
    await violated("connect-src", scheme);
    expect(message).toContain("connect-src");
    expect(message).not.toContain("CORS");
  });

  it.each([
    [
      "data",
      "an svg",
      async () =>
        await loadImage(
          new Blob(
            [
              '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
            ],
            { type: "image/svg+xml" }
          )
        ),
    ],
    [
      "blob",
      "a display-p3 export",
      async () => {
        const cropper = createCropper();

        attachImage(cropper, await loadImage(jpeg));

        try {
          return await exportCrop(cropper, {
            colorSpace: "display-p3",
            type: "image/png",
          });
        } finally {
          attachImage(cropper, null);
        }
      },
    ],
  ])("names img-src and %s: for a blocked %s", async (scheme, _name, run) => {
    const message = await messageOf(run());

    await violated("img-src", scheme);
    expect(message).toContain("img-src");
    expect(message).toContain(`${scheme}:`);
  });
});

describe("under a page that enforces trusted types", () => {
  it("still starts a worker through its own policy", async () => {
    const policy = document.createElement("meta");
    const blocked: string[] = [];

    const note = (event: SecurityPolicyViolationEvent): void => {
      blocked.push(event.effectiveDirective);
    };

    document.addEventListener("securitypolicyviolation", note);
    policy.httpEquiv = "Content-Security-Policy";
    policy.content = "require-trusted-types-for 'script'; trusted-types zriz";
    document.head.append(policy);

    const worker = lane(() => ({ ping: async () => await Promise.resolve(1) }));

    await expect(worker.call("ping", [])).resolves.toBe(1);
    document.removeEventListener("securitypolicyviolation", note);
    expect(blocked).toStrictEqual([]);
  });
});
