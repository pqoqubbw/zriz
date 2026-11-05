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
import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "../snippets/server-crop/app/api/crop/route";

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

describe("the documented crop route", () => {
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
