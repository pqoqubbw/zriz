import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCropper } from "../../src";
import { attachImage, exportCrop, loadImage } from "../../src/dom";

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

  it("names connect-src for a blocked data url", async () => {
    const message = await messageOf(loadImage(PIXEL));
    await violated("connect-src", "data");
    expect(message).toContain("connect-src");
    expect(message).not.toContain("CORS");
  });

  it("names connect-src for a blocked blob url", async () => {
    const url = URL.createObjectURL(jpeg);
    const message = await messageOf(loadImage(url));
    URL.revokeObjectURL(url);
    await violated("connect-src", "blob");
    expect(message).toContain("connect-src");
    expect(message).not.toContain("CORS");
  });

  it("names img-src and the scheme for a blocked svg", async () => {
    const svg = new Blob(
      ['<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'],
      { type: "image/svg+xml" }
    );
    const message = await messageOf(loadImage(svg));
    await violated("img-src", "data");
    expect(message).toContain("img-src");
    expect(message).toContain("data:");
  });

  it("names img-src and the scheme for a blocked display-p3 export", async () => {
    const cropper = createCropper();
    attachImage(cropper, await loadImage(jpeg));
    const message = await messageOf(
      exportCrop(cropper, { colorSpace: "display-p3", type: "image/png" })
    );
    attachImage(cropper, null);
    await violated("img-src", "blob");
    expect(message).toContain("img-src");
    expect(message).toContain("blob:");
  });
});
