import { describe, expect, it, vi } from "vitest";
import { server } from "vitest/browser";

import { createCropper } from "../../src";
import type { Cropper } from "../../src";
import {
  ZrizError,
  attachImage,
  exportCrop,
  exportImage,
  loadImage,
  setCropShape,
} from "../../src/dom";
import type { LoadedImage } from "../../src/dom";
import { workingToSource } from "../../src/geometry";
import orientations from "../fixtures/orient.json";

const expected: Record<
  string,
  { width: number; height: number; topLeft: number[] }
> = orientations;

const fixture = async (name: string): Promise<Blob> => {
  const response = await fetch(new URL(`../fixtures/${name}`, import.meta.url));

  return await response.blob();
};

const pixels = async (
  blob: Blob,
  points: readonly [number, number][]
): Promise<number[][]> => {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("no 2d context");
  }

  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  return points.map(([x, y]) => [...context.getImageData(x, y, 1, 1).data]);
};

const near = (
  a: readonly number[] | undefined,
  b: readonly number[] | undefined,
  tolerance = 48
): boolean =>
  a !== undefined &&
  b !== undefined &&
  b.every((value, i) => Math.abs((a[i] ?? 0) - value) <= tolerance);

const shown = async (
  blob: Blob,
  imageOrientation = "from-image"
): Promise<HTMLImageElement> => {
  const img = new Image();

  img.style.imageOrientation = imageOrientation;
  img.src = URL.createObjectURL(blob);
  document.body.append(img);
  await img.decode();

  return img;
};

const halves = async (width: number, height: number): Promise<Blob> => {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("no 2d context");
  }

  context.fillStyle = "#f00";
  context.fillRect(0, 0, width / 2, height);
  context.fillStyle = "#00f";
  context.fillRect(width / 2, 0, width / 2, height);

  return await canvas.convertToBlob({ type: "image/png" });
};

const clear = async (): Promise<Blob> => {
  const canvas = new OffscreenCanvas(64, 64);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("no 2d context");
  }

  context.fillStyle = "#f00";
  context.fillRect(16, 16, 32, 32);

  return await canvas.convertToBlob({ type: "image/png" });
};

const encoded = async (type: string): Promise<Blob> => {
  const canvas = new OffscreenCanvas(200, 160);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("no 2d context");
  }

  for (let i = 0; i < 400; i += 1) {
    context.fillStyle = `hsl(${i * 37} 80% ${30 + (i % 40)}%)`;
    context.fillRect((i * 53) % 200, (i * 31) % 160, 9, 9);
  }

  return await canvas.convertToBlob({ type });
};

const otherRealm = async () => {
  const frame = document.createElement("iframe");

  frame.srcdoc = "<!doctype html><body></body>";

  await new Promise((resolve) => {
    frame.addEventListener("load", resolve, { once: true });
    document.body.append(frame);
  });

  return frame;
};

describe("a source from another document", () => {
  it("loads a file and an image that is still loading from that realm", async () => {
    const frame = await otherRealm();
    const blob = await fixture("orient-1.jpg");
    const OtherFile = frame.contentWindow?.File ?? File;
    const file = new OtherFile([blob], "a.jpg", { type: "image/jpeg" });

    expect(file instanceof Blob).toBeFalsy();
    const image = await loadImage(file);

    expect(image.width).toBeGreaterThan(0);
    expect(image.source instanceof Blob).toBeTruthy();
    const url = URL.createObjectURL(blob);
    const img = frame.contentDocument?.createElement("img") ?? new Image();
    const decode = img.decode.bind(img);

    img.decode = async () => {
      img.src = url;
      await decode();
    };

    const loading = await loadImage(img);

    expect(loading.width).toBeGreaterThan(0);
    URL.revokeObjectURL(url);
    frame.remove();
  });
});

describe("load and export", () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    "shows and exports EXIF orientation %i upright",
    async (orientation) => {
      const want = expected[String(orientation)] ?? {
        height: 0,
        topLeft: [],
        width: 0,
      };
      const image = await loadImage(await fixture(`orient-${orientation}.jpg`));

      expect([image.width, image.height]).toStrictEqual([
        want.width,
        want.height,
      ]);

      const cropper = createCropper({ image });
      const result = await exportImage(cropper, image, { type: "image/png" });
      const [topLeft] = await pixels(result.blob, [[1, 1]]);

      expect(near(topLeft, want.topLeft)).toBeTruthy();
      image.preview.close();
    }
  );

  it("exports a larger copy of the attached photo", async () => {
    const thumbnail = await loadImage(await halves(400, 300));
    const original = await loadImage(await halves(1600, 1200));
    const cropper = createCropper();

    attachImage(cropper, thumbnail);
    const result = await exportImage(cropper, original, { type: "image/png" });

    expect([result.width, result.height]).toStrictEqual([400, 300]);
    const [left, right] = await pixels(result.blob, [
      [50, 150],
      [350, 150],
    ]);

    expect(near(left, [255, 0, 0])).toBeTruthy();
    expect(near(right, [0, 0, 255])).toBeTruthy();
    attachImage(cropper, null);
    original.preview.close();
  });

  it("exports a jpeg mesh of a 6000 by 4500 photo at the size it reports", async () => {
    const width = 6000;
    const height = 4500;
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("no 2d context");
    }

    context.fillStyle = "#f00";
    context.fillRect(0, 0, width, height);
    const image = await loadImage(await createImageBitmap(canvas));

    canvas.width = 0;
    const cropper = createCropper();

    attachImage(cropper, image);
    cropper.setValue({ perspective: { horizontal: 0, vertical: 30 } });
    const result = await exportCrop(cropper, { type: "image/jpeg" });
    const written = await createImageBitmap(result.blob);

    expect([written.width, written.height]).toStrictEqual([
      result.width,
      result.height,
    ]);

    written.close();
    const [middle, corner] = await pixels(result.blob, [
      [Math.floor(result.width / 2), Math.floor(result.height / 2)],
      [1, 1],
    ]);

    expect(near(middle, [255, 0, 0])).toBeTruthy();
    expect(near(corner, [255, 0, 0])).toBeTruthy();
    expect(result.scaled).toBeFalsy();
    attachImage(cropper, null);
  });

  it("exports a straightened crop with no empty corners", async () => {
    const image = await loadImage(await fixture("orient-1.jpg"));
    const cropper = createCropper({ image });

    cropper.setRotation(12);
    const result = await exportImage(cropper, image, { type: "image/png" });
    const { width, height } = result;
    const corners = await pixels(result.blob, [
      [0, 0],
      [width - 1, 0],
      [0, height - 1],
      [width - 1, height - 1],
    ]);

    expect(corners.every((pixel) => pixel[3] === 255)).toBeTruthy();
    expect(result.type).toBe(result.blob.type);
  });

  it.each([
    ["a jpeg by default", {}, {}, false, [2, 2], [255, 255, 255, 255]],
    [
      "a jpeg circle",
      { defaultValue: { aspect: 1 } },
      { shape: "circle", type: "image/jpeg" },
      false,
      [0, 0],
      [255, 255, 255, 255],
    ],
    [
      "a jpeg through the perspective mesh",
      { focalLength: 40 },
      {},
      true,
      [1, 1],
      [255, 255, 255, 255],
    ],
    ["a png", {}, { type: "image/png" }, false, [2, 2], [0, 0, 0, 0]],
  ] as const)(
    "fills clear pixels of %s with white, and a png keeps them clear",
    async (_name, options, exportOptions, tilted, [x, y], want) => {
      const image = await loadImage(await clear());
      const cropper = createCropper({ ...options, image });

      if (tilted) {
        cropper.setValue({ perspective: { horizontal: 8, vertical: 10 } });
      }

      const result = await exportImage(cropper, image, exportOptions);
      const [corner, centre] = await pixels(result.blob, [
        [x, y],
        [Math.floor(result.width / 2), Math.floor(result.height / 2)],
      ]);

      expect(result.type).toBe(want[3] === 0 ? "image/png" : "image/jpeg");
      expect(near(corner, want, 8)).toBeTruthy();
      expect(near(centre, [255, 0, 0, 255], 24)).toBeTruthy();
    }
  );

  it.each([
    [
      "the circle option",
      async (cropper: Cropper, image: LoadedImage) =>
        await exportImage(cropper, image, { shape: "circle" }),
    ],
    [
      "a crop drawn as a circle",
      async (cropper: Cropper, image: LoadedImage) => {
        attachImage(cropper, image);
        setCropShape(cropper, "circle");

        return await exportCrop(cropper);
      },
    ],
  ])("exports a round png for %s", async (_name, run) => {
    const image = await loadImage(await fixture("orient-1.jpg"));
    const cropper = createCropper({ defaultValue: { aspect: 1 }, image });
    const result = await run(cropper, image);

    expect(result.type).toBe("image/png");
    const [corner, centre] = await pixels(result.blob, [
      [0, 0],
      [Math.floor(result.width / 2), Math.floor(result.height / 2)],
    ]);

    expect(corner?.[3]).toBe(0);
    expect(centre?.[3]).toBe(255);
  });

  it("falls back from webp and reports the type the browser produced", async () => {
    const image = await loadImage(await fixture("orient-1.jpg"));
    const cropper = createCropper({ image });
    const result = await exportImage(cropper, image, { type: "image/webp" });

    expect(result.type).toBe(result.blob.type);
    expect(["image/webp", "image/jpeg"]).toContain(result.type);
    const round = await exportImage(cropper, image, {
      shape: "circle",
      type: "image/webp",
    });

    expect(round.type).toBe(round.blob.type);
    expect(["image/webp", "image/png"]).toContain(round.type);
  });

  it.each([
    ["a canvas", () => document.createElement("canvas")],
    ["an OffscreenCanvas", () => new OffscreenCanvas(40, 20)],
  ])("loads and exports %s, and a bitmap made from it", async (_name, make) => {
    const canvas = make();

    canvas.width = 40;
    canvas.height = 20;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("no 2d context");
    }

    context.fillStyle = "#f00";
    context.fillRect(0, 0, 40, 20);
    const bitmap = await createImageBitmap(canvas);

    for (const source of [canvas, bitmap]) {
      const image = await loadImage(source);

      expect([image.width, image.height]).toStrictEqual([40, 20]);
      const cropper = createCropper();

      attachImage(cropper, image);
      const result = await exportCrop(cropper, { type: "image/png" });
      const [pixel] = await pixels(result.blob, [[1, 1]]);

      expect(near(pixel, [255, 0, 0, 255])).toBeTruthy();
      attachImage(cropper, null);
      expect(image.preview.width).toBe(source === bitmap ? 40 : 0);
    }

    bitmap.close();
  });

  it("converts a P3-tagged file to sRGB for an sRGB export", async () => {
    const image = await loadImage(await fixture("p3.jpg"));
    const cropper = createCropper({ image });
    const result = await exportImage(cropper, image, { type: "image/png" });
    const [red, green] = await pixels(result.blob, [
      [3, 3],
      [26, 3],
    ]);

    expect(near(red, [255, 0, 0], 8)).toBeTruthy();
    expect(near(green, [0, 255, 0], 8)).toBeTruthy();
  });

  it.each([
    [
      "a format the browser cannot decode",
      async () => await fixture("fake.heic"),
      "unsupported-format",
    ],
    [
      "an element it cannot read",
      async () => {
        const canvas = document.createElement("canvas");

        canvas.width = 0;

        return await Promise.resolve(canvas);
      },
      "decode",
    ],
    [
      "a broken svg",
      async () =>
        await Promise.resolve(
          new Blob(["<svg><rect></svg>"], { type: "image/svg+xml" })
        ),
      "decode",
    ],
  ] as const)("throws a typed error for %s", async (_name, make, code) => {
    const error: unknown = await loadImage(await make()).catch(
      (error_: unknown) => error_
    );

    expect(error).toBeInstanceOf(ZrizError);
    expect(error).toHaveProperty("code", code);
  });

  it("opens bytes the browser cannot through the decode hook, and a throw there rejects with the caller's own error", async () => {
    const junk = new Blob(["this is not an image"], { type: "image/x-custom" });
    const decode = vi.fn<() => Promise<ImageBitmap>>(
      async () => await createImageBitmap(await halves(320, 200))
    );
    const image = await loadImage(junk, { decode });

    expect(decode).toHaveBeenCalledOnce();
    expect([image.width, image.height]).toStrictEqual([320, 200]);
    const cropper = createCropper();

    attachImage(cropper, image);
    const result = await exportCrop(cropper, { type: "image/png" });
    const [left] = await pixels(result.blob, [[10, 100]]);

    expect(near(left, [255, 0, 0])).toBeTruthy();
    attachImage(cropper, null);
    const mine = new Error("mine");

    await expect(
      loadImage(junk, {
        decode: async () => {
          await Promise.resolve();
          throw mine;
        },
      })
    ).rejects.toBe(mine);
  });

  it("throws a typed cross-origin error at load, not at export", async () => {
    const attempt = loadImage("https://zriz.invalid/photo.jpg", {
      timeout: 5000,
    });

    await expect(attempt).rejects.toMatchObject({ code: "cross-origin" });
  });

  it("exports a perspective crop through the mesh", async () => {
    const image = await loadImage(await fixture("orient-1.jpg"));
    const cropper = createCropper({ focalLength: 40, image });

    cropper.setValue({ perspective: { horizontal: 8, vertical: 10 } });
    const state = cropper.getCropState();

    if (!state) {
      throw new Error("no state");
    }

    const result = await exportImage(cropper, image, {
      maxSize: { height: 200, width: 200 },
      type: "image/png",
    });
    const scale = result.width / state.crop.width;
    const samples: [number, number][] = [];

    for (let u = 0.1; u < 1; u += 0.2) {
      for (let v = 0.1; v < 1; v += 0.2) {
        samples.push([
          Math.floor(u * result.width),
          Math.floor(v * result.height),
        ]);
      }
    }

    const got = await pixels(result.blob, samples);
    const misses: number[] = [];
    let checked = 0;

    for (const [i, [x, y]] of samples.entries()) {
      const source = workingToSource(state, {
        x: (x + 0.5 - result.width / 2) / scale + state.crop.x,
        y: (y + 0.5 - result.height / 2) / scale + state.crop.y,
      });

      if (Math.abs(source.x - 15) > 2 && Math.abs(source.y - 10) > 2) {
        let want = [255, 255, 255];

        if (source.x < 15 && source.y < 10) {
          want = [255, 0, 0];
        } else if (source.y < 10) {
          want = [0, 255, 0];
        } else if (source.x < 15) {
          want = [0, 0, 255];
        }

        if (!near(got[i], want)) {
          misses.push(i);
        }

        checked += 1;
      }
    }

    expect(misses).toStrictEqual([]);
    expect(checked).toBeGreaterThan(10);
  });

  it
    .runIf(
      server.browser === "chromium" ||
        (server.browser === "webkit" && server.platform === "darwin")
    )
    .each([
      ["a file", async (blob: Blob) => await loadImage(blob)],
      ["an img", async (blob: Blob) => await loadImage(await shown(blob))],
    ])("keeps a P3 source in P3 through %s", async (_name, load) => {
    const source = new OffscreenCanvas(16, 16);
    const paint = source.getContext("2d", { colorSpace: "display-p3" });

    if (!paint) {
      throw new Error("no P3 canvas");
    }

    paint.fillStyle = "color(display-p3 1 0 0)";
    paint.fillRect(0, 0, 16, 16);
    const image = await load(await source.convertToBlob({ type: "image/png" }));
    const cropper = createCropper();

    attachImage(cropper, image);
    const result = await exportCrop(cropper, {
      colorSpace: "display-p3",
      type: "image/png",
    });
    const element = new Image();

    element.src = URL.createObjectURL(result.blob);
    await element.decode();
    const canvas = new OffscreenCanvas(
      element.naturalWidth,
      element.naturalHeight
    );
    const context = canvas.getContext("2d", { colorSpace: "display-p3" });

    context?.drawImage(element, 0, 0);
    URL.revokeObjectURL(element.src);
    const pixel = context?.getImageData(4, 4, 1, 1, {
      colorSpace: "display-p3",
    }).data;

    expect([...(pixel ?? [])].slice(0, 3)).toStrictEqual([255, 0, 0]);
  });
});

const alphaOf = async (blob: Blob): Promise<ImageData> => {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("no 2d context");
  }

  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  return context.getImageData(0, 0, canvas.width, canvas.height);
};

const painted = async (
  width: number,
  height: number,
  draw: (context: OffscreenCanvasRenderingContext2D) => void
): Promise<Blob> => {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("no 2d context");
  }

  draw(context);

  return await canvas.convertToBlob({ type: "image/png" });
};

const stripes = async (width: number, height: number): Promise<Blob> =>
  await painted(width, height, (context) => {
    context.fillStyle = "#000";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#fff";

    for (let x = 1; x < width; x += 2) {
      context.fillRect(x, 0, 1, height);
    }
  });

const centreRowDeviation = ({ data, height, width }: ImageData): number => {
  const y = Math.floor(height / 2);
  const values: number[] = [];

  for (let x = Math.floor(width * 0.2); x < width * 0.8; x += 1) {
    values.push(data[(y * width + x) * 4] ?? 0);
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;

  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  );
};

const photoJpeg = async (quality: number): Promise<Blob> => {
  const canvas = new OffscreenCanvas(1200, 900);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("no 2d context");
  }

  const gradient = context.createLinearGradient(0, 0, 1200, 900);

  gradient.addColorStop(0, "rgb(30 80 160)");
  gradient.addColorStop(1, "rgb(220 160 60)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1200, 900);
  let seed = 7;

  for (let i = 0; i < 6000; i += 1) {
    seed = (seed * 16_807) % 2_147_483_647;
    const x = seed % 1200;

    seed = (seed * 16_807) % 2_147_483_647;
    const y = seed % 900;

    context.fillStyle = `hsl(${(x + y) % 360} 60% ${30 + (seed % 40)}%)`;
    context.fillRect(x, y, 3 + (seed % 9), 3 + (seed % 7));
  }

  return await canvas.convertToBlob({ quality, type: "image/jpeg" });
};

describe("export size", () => {
  it("keeps a jpeg no larger than the file it came from, unless given a quality", async () => {
    const source = await photoJpeg(0.6);
    const image = await loadImage(source);
    const cropper = createCropper({ image });
    const result = await exportImage(cropper, image);

    expect(result.type).toBe("image/jpeg");
    expect(result.width).toBe(1200);
    expect(result.blob.size).toBeLessThanOrEqual(source.size * 1.05);
    const asked = await exportImage(cropper, image, { quality: 0.95 });

    expect(asked.blob.size).toBeGreaterThan(source.size * 1.2);
  });
});

describe("export quality", () => {
  it.each(["srgb", "display-p3"] as const)(
    "softens a round edge on the %s route",
    async (colorSpace) => {
      const image = await loadImage(
        await painted(400, 400, (context) => {
          context.fillStyle = "rgb(220 30 30)";
          context.fillRect(0, 0, 400, 400);
        })
      );
      const cropper = createCropper({ defaultValue: { aspect: 1 } });

      attachImage(cropper, image);
      const { blob } = await exportCrop(cropper, {
        colorSpace,
        shape: "circle",
        type: "image/png",
      });
      const { data } = await alphaOf(blob);
      let soft = 0;

      for (let i = 3; i < data.length; i += 4) {
        if (data[i] !== 0 && data[i] !== 255) {
          soft += 1;
        }
      }

      expect(data[3]).toBe(0);
      expect(soft).toBeGreaterThan(400);
    }
  );

  it.each([
    ["an opaque photo", "rgb(40 90 200)", 255, 12],
    ["a half transparent photo", "rgb(40 90 200 / 0.5)", 128, 127],
  ] as const)(
    "keeps the alpha of %s across the perspective mesh",
    async (_name, fill, want, limit) => {
      const image = await loadImage(
        await painted(800, 600, (context) => {
          context.fillStyle = fill;
          context.fillRect(0, 0, 800, 600);
        })
      );
      const cropper = createCropper({});

      attachImage(cropper, image);

      cropper.setValue({
        perspective: { horizontal: -10, vertical: 15 },
        rotation: 3,
      });

      const result = await exportCrop(cropper, { type: "image/png" });
      const { data, height, width } = await alphaOf(result.blob);
      let total = 0;
      let off = 0;
      let worst = 0;

      for (let y = 3; y < height - 3; y += 1) {
        for (let x = 3; x < width - 3; x += 1) {
          const delta = Math.abs((data[(y * width + x) * 4 + 3] ?? 0) - want);

          total += 1;

          if (delta > 1) {
            off += 1;
            worst = Math.max(worst, delta);
          }
        }
      }

      expect(result.crop.homography).not.toBeNull();
      expect(off / total).toBeLessThan(0.01);
      expect(worst).toBeLessThanOrEqual(limit);
    }
  );

  it.each([
    ["at 0.128", 4000, 3000, 512, false],
    ["through the mesh", 1351, 1000, 500, true],
  ] as const)(
    "flattens 1 px stripes %s",
    async (_name, width, height, edge, tilted) => {
      const image = await loadImage(await stripes(width, height));
      const cropper = createCropper({ focalLength: 40 });

      attachImage(cropper, image);

      if (tilted) {
        cropper.setValue({ perspective: { horizontal: 8, vertical: 10 } });
      }

      const { blob } = await exportCrop(cropper, {
        maxSize: { height: edge, width: edge },
        type: "image/png",
      });

      expect(centreRowDeviation(await alphaOf(blob))).toBeLessThan(30);
    }
  );

  it("keeps a wide webp whole and reports its real size", async () => {
    const canvas = new OffscreenCanvas(20_000, 100);
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("no 2d context");
    }

    context.fillStyle = "#f00";
    context.fillRect(0, 0, 16_383, 100);
    context.fillStyle = "#00f";
    context.fillRect(16_383, 0, 3617, 100);
    const image = await loadImage(canvas.transferToImageBitmap());
    const cropper = createCropper();

    attachImage(cropper, image);
    const result = await exportCrop(cropper, {
      quality: 1,
      type: "image/webp",
    });
    const { data, height, width } = await alphaOf(result.blob);
    const edge = data.slice(
      Math.floor(height / 2) * width * 4 + (width - 2) * 4
    );

    expect([result.width, result.height, result.scaled]).toStrictEqual([
      width,
      height,
      true,
    ]);

    expect(width).toBeLessThanOrEqual(16_383);
    expect(edge[2]).toBeGreaterThan(edge[0] ?? 0);
  });
});

const SVG_NS = 'xmlns="http://www.w3.org/2000/svg"';

const foreign = `<svg ${SVG_NS} width="200" height="100"><foreignObject width="200" height="100"><div xmlns="http://www.w3.org/1999/xhtml" style="width:200px;height:100px;background:#c33"></div></foreignObject></svg>`;

const solid = (attributes: string): string =>
  `<svg ${SVG_NS} ${attributes}><rect width="100%" height="100%" fill="#c33"/></svg>`;

const paint = (bitmap: ImageBitmap, x = 0.5, y = 0.5): number[] => {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("no 2d context");
  }

  context.drawImage(bitmap, 0, 0);

  return [
    ...context.getImageData(
      Math.floor(bitmap.width * x),
      Math.floor(bitmap.height * y),
      1,
      1
    ).data,
  ];
};

const codeOf = async (work: Promise<unknown>): Promise<unknown> =>
  await work.then(
    () => "resolved",
    (error: unknown) => (error instanceof ZrizError ? error.code : error)
  );

describe("reading a file before it decodes", () => {
  it.each(["image/png", "image/jpeg"])(
    "refuses a %s cut in half, from a blob or a url, and opens one with data after its end",
    async (type) => {
      const whole = await encoded(type);
      const part = whole.slice(0, Math.floor(whole.size / 2), type);
      const url = URL.createObjectURL(part);

      await expect(codeOf(loadImage(part))).resolves.toBe("decode");
      await expect(codeOf(loadImage(url))).resolves.toBe("decode");
      URL.revokeObjectURL(url);
      const image = await loadImage(
        new Blob([whole, new Uint8Array(4096).fill(7)], { type })
      );

      expect(image.width).toBe(200);
      image.preview.close();
    }
  );
});

describe("svg sources", () => {
  const SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><rect width="64" height="32" fill="red"/></svg>';

  it("fails with decode for svg text declared as raster, and exports raster bytes declared as svg", async () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      await expect(codeOf(loadImage(new Blob([SVG], { type })))).resolves.toBe(
        "decode"
      );
    }

    const jpeg = await fixture("orient-1.jpg");
    const image = await loadImage(new Blob([jpeg], { type: "image/svg+xml" }));
    const cropper = createCropper();

    attachImage(cropper, image);
    const { blob } = await exportCrop(cropper, { colorSpace: "display-p3" });

    expect(blob.size).toBeGreaterThan(0);
    attachImage(cropper, null);
  });

  it.each(["", "application/octet-stream", "image/svg+xml"])(
    "refuses svg text typed %j when svg is off, and still opens a raster photo",
    async (type) => {
      await expect(
        codeOf(loadImage(new Blob([SVG], { type }), { svg: false }))
      ).resolves.toBe("decode");

      const image = await loadImage(await fixture("orient-1.jpg"), {
        svg: false,
      });

      expect(image.mime).toBe("image/jpeg");
      image.preview.close();
    }
  );

  it("gives a lone width the default height without stretching", async () => {
    const { preview } = await loadImage(
      new Blob(
        [
          '<svg xmlns="http://www.w3.org/2000/svg" width="200"><rect width="200" height="150" fill="#cc3333"/></svg>',
        ],
        { type: "image/svg+xml" }
      )
    );

    expect([preview.width, preview.height]).toStrictEqual([200, 150]);
    expect(near(paint(preview, 0.98, 0.98), [204, 51, 51, 255])).toBeTruthy();
    preview.close();
  });

  it.each([
    ["no type", new Blob([solid('width="20" height="10"')])],
    [
      "text/plain",
      new Blob([solid('width="20" height="10"')], { type: "text/plain" }),
    ],
    [
      "application/octet-stream",
      new Blob([solid('width="20" height="10"')], {
        type: "application/octet-stream",
      }),
    ],
    [
      "an XML prolog",
      new Blob([`<?xml version="1.0"?>\n${solid('width="20" height="10"')}`], {
        type: "image/svg+xml",
      }),
    ],
    ["a jpeg name", new File([solid('width="20" height="10"')], "a.jpg")],
    [
      "a charset",
      new Blob([solid('width="20" height="10"')], {
        type: "image/svg+xml;charset=utf-8",
      }),
    ],
  ])("opens one with %s", async (_name, blob) => {
    const { preview, mime } = await loadImage(blob);

    expect(mime).toBe("image/svg+xml");
    expect([preview.width, preview.height]).toStrictEqual([20, 10]);
    expect(near(paint(preview), [204, 51, 51, 255])).toBeTruthy();
    preview.close();
  });

  it("loads and exports one with html inside", async () => {
    const image = await loadImage(
      new Blob([foreign], { type: "image/svg+xml" })
    );

    expect(near(paint(image.preview), [204, 51, 51, 255])).toBeTruthy();
    const cropper = createCropper();

    attachImage(cropper, image);
    const result = await exportCrop(cropper, { type: "image/jpeg" });

    expect(result.width).toBe(200);
    attachImage(cropper, null);
  });
});

const FIREFOX_REFUSES_WIDE_IMG = server.browser === "firefox";

describe("element sources", () => {
  it.each([
    ['viewBox="0 0 300 200"', 1.5],
    ['width="100%" height="100%" viewBox="0 0 300 200"', 1.5],
    ['width="300" height="200"', 1.5],
  ])("opens an img showing an svg with %s", async (attributes, ratio) => {
    const img = await shown(
      new Blob([solid(attributes)], { type: "image/svg+xml" })
    );
    const { preview, width, height } = await loadImage(img);

    expect(width / height).toBeCloseTo(ratio, 1);
    expect(near(paint(preview), [204, 51, 51, 255])).toBeTruthy();
    expect(near(paint(preview, 0.02, 0.02), [204, 51, 51, 255])).toBeTruthy();
    preview.close();
    img.remove();
  });

  it.each(
    ["from-image", "none"].flatMap((style) =>
      [1, 2, 3, 4, 5, 6, 7, 8].map(
        (orientation) => [orientation, style] as const
      )
    )
  )(
    "opens an img with EXIF orientation %i upright under image-orientation %s",
    async (orientation, style) => {
      const want = expected[String(orientation)];
      const img = await shown(
        await fixture(`orient-${orientation}.jpg`),
        style
      );
      const { preview, width, height } = await loadImage(img);

      expect([width, height]).toStrictEqual([want?.width, want?.height]);
      expect(near(paint(preview, 0.02, 0.02), want?.topLeft)).toBeTruthy();
      preview.close();
      img.remove();
    }
  );

  it.each([
    ["a width", "400w", "100px"],
    ["a density", "2x", ""],
    ["a density that rounds", "3x", ""],
  ])("keeps the file's pixels for a srcset with %s", async (_, rule, sizes) => {
    const canvas = new OffscreenCanvas(400, 200);
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("no 2d context");
    }

    context.fillStyle = "#c33";
    context.fillRect(0, 0, 400, 200);
    const url = URL.createObjectURL(
      await canvas.convertToBlob({ type: "image/png" })
    );
    const img = new Image();

    img.sizes = sizes;
    img.srcset = `${url} ${rule}`;
    document.body.append(img);
    await img.decode();
    const image = await loadImage(img);

    expect([image.width, image.height]).toStrictEqual([400, 200]);
    const cropper = createCropper();

    attachImage(cropper, image);
    const result = await exportCrop(cropper, { type: "image/png" });

    expect([result.width, result.height, result.scaled]).toStrictEqual([
      400,
      200,
      false,
    ]);

    attachImage(cropper, null);
    img.remove();
    URL.revokeObjectURL(url);
  });

  it.skipIf(FIREFOX_REFUSES_WIDE_IMG)(
    "opens an img wider than a canvas can be",
    async () => {
      const img = await shown(await fixture("wide.png"));
      const { preview, width, height } = await loadImage(img);

      expect([width, height]).toStrictEqual([70_000, 10]);
      preview.close();
      img.remove();
    }
  );

  it("stays off the canvas when the browser refuses an img past the area limit", async () => {
    const img = await shown(
      new Blob([solid('width="20000" height="20000"')], {
        type: "image/svg+xml",
      })
    );
    const refuse = vi
      .spyOn(globalThis, "createImageBitmap")
      .mockRejectedValue(new Error("too big"));

    try {
      await expect(codeOf(loadImage(img))).resolves.toBe("decode");
      expect(refuse).toHaveBeenCalledOnce();
    } finally {
      refuse.mockRestore();
      img.remove();
    }
  });

  it.each(["animated.gif", "animated.webp", "animated.png"])(
    "opens a playing %s on its first frame, or the one showing in webkit",
    async (name) => {
      const img = await shown(await fixture(name));
      const frames = [
        [220, 40, 40, 255],
        ...(server.browser === "webkit" ? [[230, 220, 40, 255]] : []),
      ];

      for (let round = 0; round < 8; round += 1) {
        const { preview } = await loadImage(img);
        const shownFrame = paint(preview, 0.25, 0.25);

        expect(frames.some((frame) => near(shownFrame, frame))).toBeTruthy();
        preview.close();

        await new Promise((resolve) => {
          setTimeout(resolve, 37);
        });
      }

      img.remove();
    }
  );

  it("names a bitmap made from a tainted source as cross-origin", async () => {
    const img = await shown(new Blob([foreign], { type: "image/svg+xml" }));
    const context = new OffscreenCanvas(1, 1).getContext("2d");

    context?.drawImage(img, 0, 0, 1, 1);
    const clean = await Promise.resolve(context)
      .then((reader) => reader?.getImageData(0, 0, 1, 1))
      .then(
        () => true,
        () => false
      );
    const bitmap = await createImageBitmap(img);

    img.remove();
    const want = clean ? "resolved" : "cross-origin";
    const hook = async (): Promise<ImageBitmap> =>
      await createImageBitmap(bitmap);

    await expect(
      codeOf(loadImage(await fixture("fake.heic"), { decode: hook }))
    ).resolves.toBe(want);

    await expect(codeOf(loadImage(bitmap))).resolves.toBe(want);
  });
});

const VIDEOS = [
  { file: "frames.webm", init: 481, mime: 'video/webm; codecs="vp8"' },
  { file: "frames.mp4", init: 771, mime: 'video/mp4; codecs="avc1.42C00A"' },
];

const once = async (target: EventTarget, type: string): Promise<void> => {
  await new Promise((resolve) => {
    target.addEventListener(type, resolve, { once: true });
  });
};

const appended = async (
  buffer: SourceBuffer,
  bytes: Uint8Array<ArrayBuffer>
): Promise<void> => {
  const done = once(buffer, "updateend");

  buffer.appendBuffer(bytes);
  await done;
};

const streaming = async () => {
  const fixtureOf = VIDEOS.find(({ mime }) =>
    MediaSource.isTypeSupported(mime)
  );

  if (!fixtureOf) {
    throw new Error("no video codec");
  }

  const file = await fixture(fixtureOf.file);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const media = new MediaSource();
  const video = document.createElement("video");

  video.muted = true;
  video.src = URL.createObjectURL(media);
  document.body.append(video);
  await once(media, "sourceopen");
  const buffer = media.addSourceBuffer(fixtureOf.mime);
  const metadata = once(video, "loadedmetadata");

  await appended(buffer, bytes.subarray(0, fixtureOf.init));
  await metadata;

  return { buffer, bytes, init: fixtureOf.init, media, video };
};

const playable = async (
  name: string,
  event: string
): Promise<HTMLVideoElement> => {
  const video = document.createElement("video");

  video.muted = true;
  video.src = URL.createObjectURL(await fixture(name));
  const ready = once(video, event);

  document.body.append(video);
  await ready;

  return video;
};

const BLANK_VIDEO = server.browser === "webkit" && server.platform === "linux";

describe("video sources", () => {
  it.skipIf(BLANK_VIDEO)("opens a video once it has a frame", async () => {
    const { buffer, bytes, init, video } = await streaming();
    const frame = once(video, "loadeddata");

    await appended(buffer, bytes.subarray(init));
    await frame;
    const { preview } = await loadImage(video);

    expect(near(paint(preview), [255, 0, 0, 255], 72)).toBeTruthy();
    preview.close();
    video.remove();
  });

  it("opens a plain file as its picture after loadeddata, never as a blank photo on loadedmetadata", async () => {
    const video = await playable("frames.webm", "loadeddata");
    const { preview } = await loadImage(video);

    expect(near(paint(preview), [255, 0, 0, 255], 72)).toBeTruthy();
    preview.close();
    video.remove();
    const early = await playable("frames.webm", "loadedmetadata");
    const outcome = await loadImage(early).then(
      ({ preview: shownPreview }) =>
        near(paint(shownPreview), [255, 0, 0, 255], 72) ? "picture" : "blank",
      (error: unknown) => (error instanceof ZrizError ? error.code : error)
    );

    expect(["picture", "decode"]).toContain(outcome);
    early.remove();
  });

  it.skipIf(BLANK_VIDEO)(
    "opens a video that is clear at its centre",
    async () => {
      const video = await playable("ring.webm", "loadeddata");
      const { preview, width, height } = await loadImage(video);

      expect([width, height]).toStrictEqual([64, 64]);
      expect(near(paint(preview, 0.05, 0.05), [200, 30, 30, 255])).toBeTruthy();
      expect(paint(preview)[3]).toBe(server.browser === "webkit" ? 255 : 0);
      preview.close();
      video.remove();
    }
  );

  it.each(
    [
      {
        name: "with no frame yet",
        needsFrame: false,
        ready: async () => {
          const { video } = await streaming();

          return video;
        },
      },
      {
        name: "seeking into an unbuffered range",
        needsFrame: true,
        ready: async () => {
          const { buffer, bytes, init, media, video } = await streaming();
          const frame = once(video, "loadeddata");

          await appended(buffer, bytes.subarray(init));
          await frame;
          const removed = once(buffer, "updateend");

          buffer.remove(0.5, media.duration);
          await removed;
          const seeking = once(video, "seeking");

          video.currentTime = 0.75;
          await seeking;

          return video;
        },
      },
    ].filter(({ needsFrame }) => !(needsFrame && BLANK_VIDEO))
  )("refuses a video $name", async ({ ready }) => {
    const video = await ready();

    await expect(codeOf(loadImage(video))).resolves.toBe("decode");
    video.remove();
  });
});
