import { readFileSync } from "node:fs";

import { createCropper, parse, serialize } from "@zriz/core";
import {
  assert,
  constant,
  constantFrom,
  double,
  oneof,
  property,
  record,
} from "fast-check";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cleanCopy } from "../snippets/security/clean-copy";
import { serveUpload } from "../snippets/security/serve-upload";
import { POST } from "../snippets/server-crop/app/api/crop/route";
import { canCrop } from "../snippets/server-crop/can-crop";

vi.mock(import("../snippets/server-crop/can-crop"), async (actual) => {
  const { canCrop: real } = await actual();

  return { canCrop: vi.fn<typeof real>(real) };
});

const gradient = (width: number, height: number) => {
  const bytes = Buffer.alloc(width * height * 3);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = (y * width + x) * 3;

      bytes[at] = (x * 255) / width;
      bytes[at + 1] = (y * 255) / height;
      bytes[at + 2] = 128;
    }
  }

  return sharp(bytes, { raw: { channels: 3, height, width } });
};

const post = async (
  file: Buffer | null,
  value: string | null,
  length?: string | null
): Promise<Response> => {
  const form = new FormData();

  if (file) {
    form.append("file", new File([new Uint8Array(file)], "photo"));
  }

  if (value !== null) {
    form.append("value", value);
  }

  const encoded = new Response(form);
  const body = await encoded.arrayBuffer();
  const headers = new Headers(encoded.headers);

  if (length === undefined) {
    headers.set("content-length", String(body.byteLength));
  } else if (length !== null) {
    headers.set("content-length", length);
  }

  return await POST(
    new Request("http://zriz.test/api/crop", { body, headers, method: "POST" })
  );
};

const sizeOf = async (response: Response) => {
  const { width, height } = await sharp(
    Buffer.from(await response.arrayBuffer())
  ).metadata();

  return [width, height];
};

const IMAGE = { height: 300, width: 400 };

const clientPlan = (patch: Parameters<typeof createCropper>[0]) => {
  const cropper = createCropper({ image: IMAGE, ...patch });

  return {
    plan: cropper.getPixelCrop(),
    value: serialize(cropper.getValue()),
  };
};

describe("the security recipes", () => {
  it("cleanCopy drops the blocks of an upload and turns it upright", async () => {
    const input = await gradient(64, 48)
      .jpeg()
      .withExif({ IFD0: { Copyright: "a-marker" } })
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const out = await cleanCopy(
      Buffer.concat([input, Buffer.from("a-marker")])
    );
    const meta = await sharp(out).metadata();

    expect(out.includes("a-marker")).toBeFalsy();
    expect(meta.exif).toBeUndefined();
    expect([meta.width, meta.height]).toStrictEqual([48, 64]);
  });

  it("serveUpload names the type and turns off sniffing and scripts", async () => {
    const response = serveUpload(Buffer.from([1, 2, 3]));

    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");

    expect(response.headers.get("content-security-policy")).toContain(
      "sandbox"
    );

    await expect(response.arrayBuffer()).resolves.toHaveProperty(
      "byteLength",
      3
    );
  });
});

describe("the documented crop route", () => {
  beforeEach(() => {
    vi.mocked(canCrop).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["level", {}],
    ["cut down", { size: { height: 100, width: 120 } }],
    ["straightened", { rotation: 7 }],
    ["turned and mirrored", { mirrored: true, quarterTurns: 1 as const }],
  ])("cuts what the client sees on a %s crop", async (_name, defaultValue) => {
    const input = await gradient(IMAGE.width, IMAGE.height).png().toBuffer();
    const { plan, value } = clientPlan({ defaultValue });
    const response = await post(input, value);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");

    await expect(sizeOf(response)).resolves.toStrictEqual([
      plan?.width,
      plan?.height,
    ]);
  });

  it("recomputes the plan the client holds from its value, within a pixel", () => {
    assert(
      property(
        record({
          center: record({
            x: double({ max: 200, min: -200, noNaN: true }),
            y: double({ max: 150, min: -150, noNaN: true }),
          }),
          quarterTurns: constantFrom(0, 1, 2, 3),
          rotation: oneof(
            constant(0),
            double({ max: 45, min: 1e-6, noNaN: true }),
            double({ max: -1e-6, min: -45, noNaN: true })
          ),
          size: record({
            height: double({ max: 300, min: 1, noNaN: true }),
            width: double({ max: 400, min: 1, noNaN: true }),
          }),
        }),
        (patch) => {
          const client = createCropper({ image: IMAGE });

          client.setValue(patch);
          const server = createCropper({ image: IMAGE });

          server.setValue(parse(serialize(client.getValue())) ?? {});
          const want = client.getPixelCrop();
          const got = server.getPixelCrop();

          expect(
            Math.abs((got?.width ?? 0) - (want?.width ?? 0))
          ).toBeLessThanOrEqual(1);

          expect(
            Math.abs((got?.height ?? 0) - (want?.height ?? 0))
          ).toBeLessThanOrEqual(1);

          for (const [i, term] of (want?.forward ?? []).entries()) {
            expect(Math.abs((got?.forward[i] ?? 0) - term)).toBeLessThanOrEqual(
              1
            );
          }
        }
      ),
      { numRuns: 5000 }
    );
  });

  it("refuses everyone until the app connects its own session check", async () => {
    const { canCrop: real } = await vi.importActual<{
      canCrop: typeof canCrop;
    }>("../snippets/server-crop/can-crop");

    await expect(
      real(new Request("http://zriz.test/api/crop"))
    ).resolves.toBeFalsy();
  });

  it("answers 401 before it reads the body when the check says no", async () => {
    vi.mocked(canCrop).mockResolvedValue(false);
    const input = await gradient(8, 8).png().toBuffer();
    const response = await post(input, "{}");

    expect(response.status).toBe(401);
  });

  it("refuses a body longer than the length it declares", async () => {
    const response = await post(Buffer.alloc(51 * 1024 * 1024), "{}", "10");

    expect(response.status).toBe(413);
  });

  it("refuses a negative length", async () => {
    const input = await gradient(8, 8).png().toBuffer();

    await expect(post(input, "{}", "-5")).resolves.toHaveProperty(
      "status",
      413
    );
  });

  it.each([
    ["multipart/form-data; boundary=x", "not a form"],
    ["application/json", "{}"],
  ])("answers 400 for a %s body that is no form", async (type, body) => {
    const response = await POST(
      new Request("http://zriz.test/api/crop", {
        body,
        headers: { "content-length": "9", "content-type": type },
        method: "POST",
      })
    );

    expect(response.status).toBe(400);
  });

  it("answers 400 for an empty file", async () => {
    await expect(post(Buffer.alloc(0), "{}")).resolves.toHaveProperty(
      "status",
      400
    );
  });

  it("answers 422 for a value too long to be a crop", async () => {
    const input = await gradient(8, 8).png().toBuffer();
    const value = JSON.stringify({ note: "x".repeat(8192) });

    await expect(post(input, value)).resolves.toHaveProperty("status", 422);
  });

  it.each([
    [
      "svg",
      async () =>
        await Promise.resolve(
          Buffer.from(
            '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"/>'
          )
        ),
    ],
    ["tiff", async () => await gradient(8, 8).tiff().toBuffer()],
    ["gif", async () => await gradient(8, 8).gif().toBuffer()],
  ])("answers 400 for a %s and never decodes it", async (_format, make) => {
    const response = await post(await make(), "{}");

    expect(response.status).toBe(400);
  });

  it("names the formats it takes for a heic it cannot decode", async () => {
    const input = readFileSync(
      new URL("../../../packages/core/test/fixtures/hevc.heic", import.meta.url)
    );
    const response = await post(input, "{}");

    expect(response.status).toBe(415);
    await expect(response.text()).resolves.toContain("jpeg");
  });

  it("opens an avif", async () => {
    const input = await gradient(16, 16).avif({ effort: 0 }).toBuffer();

    await expect(post(input, "{}")).resolves.toHaveProperty("status", 200);
  });

  it("answers 413 for a photo over its pixel limit before it decodes", async () => {
    const toBuffer = vi.spyOn(sharp.prototype, "toBuffer");
    const input = await sharp({
      create: {
        background: "#000",
        channels: 3,
        height: 11_000,
        width: 11_000,
      },
    })
      .png()
      .toBuffer();

    toBuffer.mockClear();
    const response = await post(input, "{}");

    expect(response.status).toBe(413);
    expect(toBuffer).not.toHaveBeenCalled();
  });

  it("answers 503 for a crop over the limit of crops at once", async () => {
    const input = await gradient(8, 8).png().toBuffer();
    const answers = await Promise.all(
      [1, 2, 3].map(async () => await post(input, "{}"))
    );

    expect(
      answers.map(({ status }) => status).toSorted((a, b) => a - b)
    ).toStrictEqual([200, 200, 503]);

    await expect(post(input, "{}")).resolves.toHaveProperty("status", 200);
  });

  it("gives every sharp stage a time limit", async () => {
    const timeout = vi.spyOn(sharp.prototype, "timeout");
    const input = await gradient(16, 16).png().toBuffer();

    timeout.mockClear();
    const response = await post(input, JSON.stringify({ rotation: 7 }));

    expect(response.status).toBe(200);
    expect(timeout.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it.each([
    ["a crop", async () => await gradient(8, 8).png().toBuffer(), 200],
    ["a refusal", async () => await Promise.resolve(Buffer.from("no")), 400],
  ])("marks %s private and not to be sniffed", async (_kind, make, status) => {
    const response = await post(await make(), "{}");

    expect(response.status).toBe(status);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("sends back the crop and nothing else from the upload", async () => {
    const left = Buffer.alloc(64 * 64 * 3);

    for (let at = 0; at < left.length; at += 3) {
      left[at] = (at / 3) % 64 < 32 ? 255 : 0;
    }

    const photo = await sharp(left, {
      raw: { channels: 3, height: 64, width: 64 },
    })
      .jpeg()
      .withExif({ IFD0: { Copyright: "a-marker" } })
      .withXmp(
        '<x:xmpmeta xmlns:x="adobe:ns:meta/"><a>a-marker</a></x:xmpmeta>'
      )
      .withIccProfile("p3")
      .toBuffer();
    const response = await post(
      Buffer.concat([photo, Buffer.from("a-marker")]),
      JSON.stringify({
        center: { x: 0.75, y: 0.5 },
        size: { height: 1, width: 0.5 },
      })
    );
    const out = Buffer.from(await response.arrayBuffer());
    const meta = await sharp(out).metadata();
    const { data } = await sharp(out)
      .raw()
      .toBuffer({ resolveWithObject: true });

    expect(out.includes("a-marker")).toBeFalsy();

    expect([meta.exif, meta.xmp, meta.icc]).toStrictEqual([
      undefined,
      undefined,
      undefined,
    ]);

    expect([meta.width, meta.height]).toStrictEqual([32, 64]);
    expect(Math.max(...data.filter((_, at) => at % 3 === 0))).toBeLessThan(90);
  });

  it("leaves Object.prototype alone for a value that names it", async () => {
    const input = await gradient(8, 8).png().toBuffer();
    const response = await post(
      input,
      '{"__proto__":{"zrizMark":1},"center":{"__proto__":{"zrizMark":1}}}'
    );

    expect(response.status).toBe(200);
    expect("zrizMark" in {}).toBeFalsy();
  });

  it("answers 400 without a file or a value", async () => {
    const input = await gradient(8, 8).png().toBuffer();

    await expect(post(null, "{}")).resolves.toHaveProperty("status", 400);
    await expect(post(input, null)).resolves.toHaveProperty("status", 400);
  });

  it("answers 400 when sharp cannot open the file", async () => {
    const response = await post(Buffer.from("not a photo"), "{}");

    expect(response.status).toBe(400);
  });

  it("answers 422 for a value it cannot read", async () => {
    const input = await gradient(8, 8).png().toBuffer();

    await expect(post(input, "not json")).resolves.toHaveProperty(
      "status",
      422
    );

    await expect(post(input, "[1]")).resolves.toHaveProperty("status", 422);
  });

  it("answers 422 for a value with perspective", async () => {
    const input = await gradient(64, 64).png().toBuffer();
    const value = JSON.stringify({
      perspective: { horizontal: 5, vertical: 5 },
    });

    await expect(post(input, value)).resolves.toHaveProperty("status", 422);
  });

  it.each([2, 3, 6, 8])(
    "answers 422 for a webp tagged with orientation %i",
    async (orientation) => {
      const input = await gradient(64, 48)
        .webp()
        .withMetadata({ orientation })
        .toBuffer();

      await expect(post(input, "{}")).resolves.toHaveProperty("status", 422);
    }
  );

  it("opens a webp tagged upright", async () => {
    const input = await gradient(64, 48)
      .webp()
      .withMetadata({ orientation: 1 })
      .toBuffer();

    await expect(post(input, "{}")).resolves.toHaveProperty("status", 200);
  });

  it("turns a jpeg upright from its tag before it reads the value", async () => {
    const input = await gradient(64, 48)
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const response = await post(input, "{}");

    await expect(sizeOf(response)).resolves.toStrictEqual([48, 64]);
  });

  it("refuses a body over the cap before it reads the form", async () => {
    const formData = vi.spyOn(Request.prototype, "formData");
    const input = await gradient(8, 8).png().toBuffer();
    const response = await post(input, "{}", String(64 * 1024 * 1024));

    expect(response.status).toBe(413);
    expect(formData).not.toHaveBeenCalled();
  });

  it("refuses a body that declares no length", async () => {
    const input = await gradient(8, 8).png().toBuffer();

    await expect(post(input, "{}", null)).resolves.toHaveProperty(
      "status",
      413
    );
  });

  it("stays inside the photo for a value far out of range", async () => {
    const input = await gradient(64, 48).png().toBuffer();
    const value = JSON.stringify({
      center: { x: 1e12, y: -1e12 },
      rotation: 44,
      size: { height: 1e15, width: 1e-30 },
    });
    const response = await post(input, value);

    expect(response.status).toBe(200);
    const [width = 0, height = 0] = await sizeOf(response);

    expect(width * height).toBeLessThanOrEqual(64 * 48);
  });

  it("holds about the crop in memory on a tilted crop of a long photo", async () => {
    const toBuffer = vi.spyOn(sharp.prototype, "toBuffer");
    const input = await gradient(16_000, 100).png().toBuffer();
    const response = await post(input, JSON.stringify({ rotation: 45 }));
    const sizes = await Promise.all(
      toBuffer.mock.results.map(async ({ value }) => {
        const out: unknown = await value;

        return typeof out === "object" &&
          out !== null &&
          "data" in out &&
          out.data instanceof Buffer
          ? out.data.length
          : 0;
      })
    );

    expect(response.status).toBe(200);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(16_000 * 100 * 3);
  });
});
