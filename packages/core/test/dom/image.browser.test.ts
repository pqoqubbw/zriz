import { describe, expect, it, vi } from "vitest";
import { server } from "vitest/browser";

import { createCropper } from "../../src";
import {
  ZrizError,
  attachImage,
  exportCrop,
  exportImage,
  imageOf,
  loadImage,
  setCropShape,
  sniff,
} from "../../src/dom";
import { fromSvg } from "../../src/dom/svg";
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
  a: number[] | undefined,
  b: number[] | undefined,
  tolerance = 48
): boolean =>
  a !== undefined &&
  b !== undefined &&
  b.every((value, i) => Math.abs((a[i] ?? 0) - value) <= tolerance);

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

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

  it("gives a round PNG for a round crop", async () => {
    const image = await loadImage(await fixture("orient-1.jpg"));
    const cropper = createCropper({ defaultValue: { aspect: 1 }, image });
    const result = await exportImage(cropper, image, { shape: "circle" });
    expect(result.type).toBe("image/png");
    const [corner, centre] = await pixels(result.blob, [
      [0, 0],
      [Math.floor(result.width / 2), Math.floor(result.height / 2)],
    ]);
    expect(corner?.[3]).toBe(0);
    expect(centre?.[3]).toBe(255);
  });

  it("exports a round PNG when the crop was drawn as a circle", async () => {
    const image = await loadImage(await fixture("orient-1.jpg"));
    const cropper = createCropper({ defaultValue: { aspect: 1 } });
    attachImage(cropper, image);
    setCropShape(cropper, "circle");
    const result = await exportCrop(cropper);
    expect(result.type).toBe("image/png");
    const [corner] = await pixels(result.blob, [[0, 0]]);
    expect(corner?.[3]).toBe(0);
  });

  it("reports the type the browser actually produced", async () => {
    const image = await loadImage(await fixture("orient-1.jpg"));
    const cropper = createCropper({ image });
    const result = await exportImage(cropper, image, { type: "image/webp" });
    expect(result.type).toBe(result.blob.type);
    expect(["image/webp", "image/png"]).toContain(result.type);
  });

  it("fits a tall svg to the edge from its own size, without an extra rounding", async () => {
    const svg = new Blob(
      [
        '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="5468" viewBox="0 0 8 5468"/>',
      ],
      { type: "image/svg+xml" }
    );
    const bitmap = await fromSvg(svg, 1024);
    expect([bitmap.width, bitmap.height]).toStrictEqual([1, 1024]);
    bitmap.close();
  });

  it("sizes an SVG with only a viewBox from the viewBox", async () => {
    const image = await loadImage(await fixture("viewbox.svg"));
    expect(image.width / image.height).toBeCloseTo(1.5, 2);
  });

  it("loads a typed SVG blob behind an XML prolog", async () => {
    const svg = await fixture("viewbox.svg");
    const text = await svg.text();
    const image = await loadImage(
      new Blob([`<?xml version="1.0"?>\n${text}`], { type: "image/svg+xml" })
    );
    expect(image.mime).toBe("image/svg+xml");
    expect(image.width / image.height).toBeCloseTo(1.5, 2);
  });

  it("sniffs SVG text and leaves other text unknown", () => {
    expect(sniff(encode("<!-- x -->\n<svg viewBox='0 0 1 1'/>")).mime).toBe(
      "image/svg+xml"
    );
    expect(sniff(encode("<html><svg></svg></html>")).mime).toBeNull();
    expect(sniff(new Uint8Array([0xff, 0xd8, 0xff, 0])).mime).toBe(
      "image/jpeg"
    );
  });

  it("loads a canvas element source", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 40;
    canvas.height = 20;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("no 2d context");
    }
    context.fillStyle = "#f00";
    context.fillRect(0, 0, 40, 20);
    const image = await loadImage(canvas);
    expect([image.width, image.height]).toStrictEqual([40, 20]);
    const result = await exportImage(createCropper({ image }), image, {
      type: "image/png",
    });
    const [pixel] = await pixels(result.blob, [[1, 1]]);
    expect(near(pixel, [255, 0, 0, 255])).toBeTruthy();
  });

  it("throws a typed error for a format the browser cannot decode", async () => {
    const error: unknown = await loadImage(await fixture("fake.heic")).catch(
      (error_: unknown) => error_
    );
    expect(error).toBeInstanceOf(ZrizError);
    expect(["unsupported-format", "decode"]).toContain(
      error instanceof ZrizError ? error.code : ""
    );
  });

  it("throws a typed decode error for an element it cannot read", async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 0;
    const attempt = loadImage(canvas);
    await expect(attempt).rejects.toBeInstanceOf(ZrizError);
    await expect(attempt).rejects.toMatchObject({ code: "decode" });
  });

  it("throws a typed cross-origin error at load, not at export", async () => {
    const attempt = loadImage("https://zriz.invalid/photo.jpg", {
      timeout: 5000,
    });
    await expect(attempt).rejects.toMatchObject({ code: "cross-origin" });
  });

  it("decodes and exports off the main thread", async () => {
    const posted = vi.spyOn(Worker.prototype, "postMessage");
    const image = await loadImage(await fixture("orient-1.jpg"));
    await exportImage(createCropper({ image }), image);
    expect(posted.mock.calls.length).toBeGreaterThan(1);
    posted.mockRestore();
  });

  it("keeps the preview under its edge", async () => {
    const image = await loadImage(await fixture("orient-1.jpg"), {
      previewEdge: 12,
    });
    expect(Math.max(image.preview.width, image.preview.height)).toBe(12);
    expect(image.width).toBe(30);
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

  it.runIf(
    server.browser === "chromium" ||
      (server.browser === "webkit" && server.platform === "darwin")
  )("keeps a P3 source in P3", async () => {
    const source = new OffscreenCanvas(16, 16);
    const paint = source.getContext("2d", { colorSpace: "display-p3" });
    if (!paint) {
      throw new Error("no P3 canvas");
    }
    paint.fillStyle = "color(display-p3 1 0 0)";
    paint.fillRect(0, 0, 16, 16);
    const image = await loadImage(
      await source.convertToBlob({ type: "image/png" })
    );
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

const shown = async (blob: Blob): Promise<HTMLImageElement> => {
  const img = new Image();
  img.src = URL.createObjectURL(blob);
  document.body.append(img);
  await img.decode();
  return img;
};

const codeOf = async (work: Promise<unknown>): Promise<unknown> =>
  await work.then(
    () => "resolved",
    (error: unknown) => (error instanceof ZrizError ? error.code : error)
  );

describe("svg sources", () => {
  it.each([
    ["no type", new Blob([solid('width="20" height="10"')])],
    [
      "text/plain",
      new Blob([solid('width="20" height="10"')], { type: "text/plain" }),
    ],
    [
      "a jpeg name",
      new File([solid('width="20" height="10"')], "a.jpg", {
        type: "image/jpeg",
      }),
    ],
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

  it("opens a typed one behind a prolog past the sniffed head", async () => {
    const padded = `<!-- ${"x".repeat(5000)} -->${solid('width="20" height="10"')}`;
    const { preview } = await loadImage(
      new Blob([padded], { type: "image/svg+xml; charset=utf-8" })
    );
    expect(preview.width).toBe(20);
    preview.close();
  });

  it("opens one in utf-16", async () => {
    const bytes = new Uint8Array([
      0xff,
      0xfe,
      ...[...encode(solid('width="20" height="10"'))].flatMap((code) => [
        code,
        0,
      ]),
    ]);
    const { preview } = await loadImage(new Blob([bytes]));
    expect(preview.width).toBe(20);
    preview.close();
  });

  it("keeps a square in physical units square", async () => {
    const { preview } = await loadImage(
      new Blob([solid('width="10cm" height="10cm"')], {
        type: "image/svg+xml",
      })
    );
    expect(preview.width).toBe(378);
    expect(preview.height).toBe(378);
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

  it("reports a broken one with a typed error", async () => {
    const attempt = loadImage(
      new Blob(["<svg><rect></svg>"], { type: "image/svg+xml" })
    );
    await expect(attempt).rejects.toBeInstanceOf(ZrizError);
  });
});

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

  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    "opens an img with EXIF orientation %i upright",
    async (orientation) => {
      const want = expected[String(orientation)];
      const img = await shown(await fixture(`orient-${orientation}.jpg`));
      const { preview, width, height } = await loadImage(img);
      expect([width, height]).toStrictEqual([want?.width, want?.height]);
      expect(near(paint(preview, 0.02, 0.02), want?.topLeft)).toBeTruthy();
      preview.close();
      img.remove();
    }
  );

  it.each(["animated.gif", "animated.webp", "animated.png"])(
    "opens a playing %s on its first frame",
    async (name) => {
      const img = await shown(await fixture(name));
      const first = [220, 40, 40, 255];
      for (let round = 0; round < 8; round += 1) {
        const { preview } = await loadImage(img);
        expect(near(paint(preview, 0.25, 0.25), first)).toBeTruthy();
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

describe("video sources", () => {
  it("opens a video once it has a frame", async () => {
    const { buffer, bytes, init, video } = await streaming();
    const frame = once(video, "loadeddata");
    await appended(buffer, bytes.subarray(init));
    await frame;
    const { preview } = await loadImage(video);
    expect(near(paint(preview), [255, 0, 0, 255], 72)).toBeTruthy();
    preview.close();
    video.remove();
  });

  it("refuses a video with no frame yet", async () => {
    const { video } = await streaming();
    await expect(codeOf(loadImage(video))).resolves.toBe("decode");
    video.remove();
  });

  it("refuses a video seeking into an unbuffered range", async () => {
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
    await expect(codeOf(loadImage(video))).resolves.toBe("decode");
    video.remove();
  });
});

describe("sharing and freeing a photo", () => {
  it("frees a photo when its last cropper is destroyed", async () => {
    const image = await loadImage(await fixture("orient-1.jpg"));
    const cropper = createCropper();
    attachImage(cropper, image);
    cropper.destroy();
    expect(image.preview.width).toBe(0);
    expect(imageOf(cropper)).toBeNull();
    attachImage(cropper, null);
    const other = createCropper();
    expect(() => {
      attachImage(other, image);
    }).toThrow(ZrizError);
  });

  it("keeps a photo open when one of two croppers is destroyed", async () => {
    const image = await loadImage(await fixture("orient-1.jpg"));
    const one = createCropper();
    const two = createCropper();
    attachImage(one, image);
    attachImage(two, image);
    one.destroy();
    expect(image.preview.width).toBeGreaterThan(0);
    await exportCrop(two, { type: "image/png" });
    attachImage(two, null);
    expect(image.preview.width).toBe(0);
  });

  it("counts a destroyed cropper's detached photo once", async () => {
    const first = await loadImage(await fixture("orient-1.jpg"));
    const second = await loadImage(await fixture("orient-2.jpg"));
    const one = createCropper();
    const two = createCropper();
    attachImage(one, first);
    attachImage(one, second);
    attachImage(two, second);
    attachImage(one, null);
    one.destroy();
    expect(second.preview.width).toBeGreaterThan(0);
    attachImage(two, null);
    expect(second.preview.width).toBe(0);
  });

  it("refuses a freed photo and leaves the current one in place", async () => {
    const first = await loadImage(await fixture("orient-1.jpg"));
    const second = await loadImage(await fixture("orient-2.jpg"));
    const cropper = createCropper();
    attachImage(cropper, first);
    attachImage(cropper, second);
    expect(first.preview.width).toBe(0);
    expect(() => {
      attachImage(cropper, first);
    }).toThrow(ZrizError);
    expect(imageOf(cropper)).toBe(second);
    expect(second.preview.width).toBeGreaterThan(0);
    attachImage(cropper, null);
  });

  it("keeps a photo open while another cropper still shows it", async () => {
    const image = await loadImage(await fixture("orient-1.jpg"));
    const one = createCropper();
    const two = createCropper();
    attachImage(one, image);
    attachImage(two, image);
    attachImage(one, image);
    attachImage(one, null);
    expect(image.preview.width).toBeGreaterThan(0);
    await exportCrop(two, { type: "image/png" });
    attachImage(two, null);
    expect(image.preview.width).toBe(0);
  });
});
