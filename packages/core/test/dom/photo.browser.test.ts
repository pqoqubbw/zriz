import { afterEach, describe, expect, it, vi } from "vitest";

import { createCropper } from "../../src";
import type { CropValue, Cropper } from "../../src";
import {
  attachImage,
  bindPhoto,
  bindViewport,
  loadImage,
  viewOf,
} from "../../src/dom";
import { TIMEOUT } from "../../src/dom/turn";

const cleanups: (() => void)[] = [];

const stripes = async (): Promise<Blob> => {
  const canvas = new OffscreenCanvas(1600, 1200);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("no 2d context");
  }
  context.fillStyle = "#fff";
  context.fillRect(0, 0, 1600, 1200);
  context.fillStyle = "#000";
  for (let x = 0; x < 1600; x += 2) {
    context.fillRect(x, 0, 1, 1200);
  }
  return await canvas.convertToBlob({ type: "image/png" });
};

const mount = async (previewEdge: number, blob?: Blob) => {
  const viewport = document.createElement("div");
  viewport.style.cssText = "position:relative;width:400px;height:300px;";
  const photo = document.createElement("div");
  viewport.append(photo);
  document.body.append(viewport);
  const cropper = createCropper();
  const off = [bindViewport(cropper, viewport), bindPhoto(cropper, photo)];
  attachImage(
    cropper,
    await loadImage(blob ?? (await stripes()), { previewEdge })
  );
  cleanups.push(() => {
    for (const stop of off) {
      stop();
    }
    attachImage(cropper, null);
    viewOf(cropper).destroy();
    cropper.destroy();
    viewport.remove();
  });
  return { cropper, photo, viewport };
};

const nextFrame = async (): Promise<void> => {
  await new Promise((resolve) => {
    requestAnimationFrame(resolve);
  });
};

const isJob = (value: unknown): value is { id: number; op: string } =>
  typeof value === "object" && value !== null && "op" in value;

const flights = (op: string) => {
  const open = new Set<number>();
  const hooked = new WeakSet<Worker>();
  let total = 0;
  let peak = 0;
  const post: unknown = Reflect.get(Worker.prototype, "postMessage");
  if (typeof post !== "function") {
    throw new TypeError("no postMessage");
  }
  const spy = vi.spyOn(Worker.prototype, "postMessage");
  spy.mockImplementation(function record(
    this: Worker,
    ...args: Parameters<Worker["postMessage"]>
  ): void {
    const message: unknown = args[0];
    if (isJob(message) && message.op === op) {
      total += 1;
      open.add(message.id);
      setTimeout(() => {
        peak = Math.max(peak, open.size);
      }, 0);
    }
    if (!hooked.has(this)) {
      hooked.add(this);
      this.addEventListener(
        "message",
        (event: MessageEvent<{ id: number }>) => {
          open.delete(event.data.id);
        }
      );
    }
    Reflect.apply(post, this, args);
  });
  cleanups.push(() => {
    spy.mockRestore();
  });
  return { peak: () => peak, total: () => total };
};

const sharp = async (photo: HTMLElement): Promise<void> => {
  await expect
    .poll(() => Object.hasOwn(photo.dataset, "sharp"), { timeout: 3000 })
    .toBeTruthy();
};

const contrast = (canvas: HTMLCanvasElement): number => {
  const context = canvas.getContext("2d");
  if (!context) {
    return 0;
  }
  const y = Math.floor(canvas.height / 2);
  const x = Math.floor(canvas.width / 2) - 20;
  const { data } = context.getImageData(x, y, 40, 1);
  let low = 255;
  let high = 0;
  for (let i = 0; i < data.length; i += 4) {
    low = Math.min(low, data[i] ?? 0);
    high = Math.max(high, data[i] ?? 0);
  }
  return high - low;
};

const gradient = async (): Promise<Blob> => {
  const canvas = new OffscreenCanvas(1600, 1200);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("no 2d context");
  }
  const fill = context.createLinearGradient(0, 0, 1600, 0);
  fill.addColorStop(0, "#000");
  fill.addColorStop(1, "#f00");
  context.fillStyle = fill;
  context.fillRect(0, 0, 1600, 1200);
  return await canvas.convertToBlob({ type: "image/png" });
};

const paintError = (cropper: Cropper, photo: HTMLElement): number => {
  const canvas = photo.querySelector("canvas");
  const frame = viewOf(cropper).frame();
  const context = canvas?.getContext("2d");
  if (!frame || !context) {
    throw new Error("nothing painted");
  }
  const [a, , e] = frame.matrix;
  const { dpr } = frame.layout;
  const y = Math.floor(frame.layout.height * dpr * 0.5);
  return Math.max(
    ...[0.15, 0.5, 0.85].map((share) => {
      const x = Math.floor(frame.layout.width * dpr * share);
      const red = context.getImageData(x, y, 1, 1).data[0] ?? 0;
      return Math.abs(red - (((x + 0.5) / dpr - e) / a / 1600) * 255);
    })
  );
};

const stalled = (op: string) => {
  const parked: (() => void)[] = [];
  let total = 0;
  let replies = 0;
  const post: unknown = Reflect.get(Worker.prototype, "postMessage");
  if (typeof post !== "function") {
    throw new TypeError("no postMessage");
  }
  const spy = vi.spyOn(Worker.prototype, "postMessage");
  spy.mockImplementation(function record(
    this: Worker,
    ...args: Parameters<Worker["postMessage"]>
  ): void {
    const message: unknown = args[0];
    if (isJob(message) && message.op === op) {
      total += 1;
      if (total === 1) {
        const onReply = (event: MessageEvent<{ id: number }>): void => {
          if (event.data.id === message.id) {
            replies += 1;
            this.removeEventListener("message", onReply);
          }
        };
        this.addEventListener("message", onReply);
        parked.push(() => {
          Reflect.apply(post, this, args);
        });
        return;
      }
    }
    Reflect.apply(post, this, args);
  });
  cleanups.push(() => {
    spy.mockRestore();
  });
  return {
    release: async () => {
      for (const send of parked.splice(0)) {
        send();
      }
      await expect.poll(() => replies, { timeout: 3000 }).toBe(1);
      await nextFrame();
    },
    total: () => total,
  };
};

const pageRule = (css: string): void => {
  const sheet = document.createElement("style");
  sheet.textContent = css;
  document.head.append(sheet);
  cleanups.push(() => {
    sheet.remove();
  });
};

const visibleImage = async (photo: HTMLElement): Promise<HTMLImageElement> => {
  const image = photo.querySelector("img");
  if (!image) {
    throw new Error("no moving image");
  }
  await expect
    .poll(() => image.style.visibility, { timeout: 3000 })
    .toBe("visible");
  return image;
};

const waitForLayout = async (
  cropper: Cropper,
  width: number
): Promise<void> => {
  await expect
    .poll(() => viewOf(cropper).frame()?.layout.width, { timeout: 2000 })
    .toBe(width);
};

describe("photo layer", () => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  });

  it("makes its layers from the document it sits in", async () => {
    const frame = document.createElement("iframe");
    frame.srcdoc = "<!doctype html><body></body>";
    await new Promise((resolve) => {
      frame.addEventListener("load", resolve, { once: true });
      document.body.append(frame);
    });
    const doc = frame.contentDocument;
    if (!doc) {
      throw new Error("no document");
    }
    const created = vi.spyOn(doc, "createElement");
    const container = doc.createElement("div");
    doc.body.append(container);
    const cropper = createCropper();
    const off = bindPhoto(cropper, container);
    cleanups.push(() => {
      off();
      cropper.destroy();
      frame.remove();
    });
    expect(created.mock.calls.map(([tag]) => tag)).toStrictEqual([
      "div",
      "img",
      "canvas",
    ]);
  });

  it("turns sharp after the first settle when the image arrives with the binder", async () => {
    const image = await loadImage(await stripes(), { previewEdge: 1024 });
    const viewport = document.createElement("div");
    viewport.style.cssText = "position:relative;width:400px;height:300px;";
    const photo = document.createElement("div");
    viewport.append(photo);
    document.body.append(viewport);
    const cropper = createCropper();
    const off = [bindViewport(cropper, viewport), bindPhoto(cropper, photo)];
    attachImage(cropper, image);
    cleanups.push(() => {
      for (const stop of off) {
        stop();
      }
      attachImage(cropper, null);
      viewOf(cropper).destroy();
      cropper.destroy();
      viewport.remove();
    });
    await sharp(photo);
    expect(photo.querySelector("canvas")?.style.visibility).toBe("visible");
  });

  it("shows a sharp canvas at rest and the moving image during a gesture", async () => {
    const { cropper, photo } = await mount(1024);
    await sharp(photo);
    const canvas = photo.querySelector("canvas");
    const image = photo.querySelector("img");
    expect(canvas?.style.visibility).toBe("visible");
    expect(image?.style.visibility).toBe("hidden");
    cropper.begin("pan");
    await expect
      .poll(() => image?.style.visibility, { timeout: 2000 })
      .toBe("visible");
    expect(Object.hasOwn(photo.dataset, "sharp")).toBeFalsy();
    cropper.end();
    await sharp(photo);
  });

  it("refreshes the region from the original past the preview's detail", async () => {
    const { cropper, photo } = await mount(400);
    cropper.setZoom(6);
    const canvas = photo.querySelector("canvas");
    await expect
      .poll(() => (canvas ? contrast(canvas) : 0), { timeout: 5000 })
      .toBeGreaterThan(150);
    await sharp(photo);
  });

  it("runs one region job at a time through a burst of zoom writes", async () => {
    const big = new OffscreenCanvas(6000, 4000);
    const context = big.getContext("2d");
    if (!context) {
      throw new Error("no 2d context");
    }
    context.fillStyle = "#fff";
    context.fillRect(0, 0, 6000, 4000);
    context.fillStyle = "#000";
    context.fillRect(0, 0, 3000, 2000);
    const { cropper, photo } = await mount(
      400,
      await big.convertToBlob({ type: "image/png" })
    );
    await sharp(photo);
    const jobs = flights("region");
    for (let i = 0; i < 12; i += 1) {
      cropper.setZoom(3 + i * 0.1);
      await nextFrame();
    }
    await sharp(photo);
    expect(jobs.total()).toBeGreaterThan(0);
    expect(jobs.peak()).toBe(1);
  });

  it("starts one job after a resize drag, not one per frame", async () => {
    const { photo, viewport } = await mount(1024);
    await sharp(photo);
    const jobs = flights("resample");
    for (let i = 0; i < 20; i += 1) {
      viewport.style.width = `${400 + i * 4}px`;
      await nextFrame();
    }
    await sharp(photo);
    expect(jobs.total()).toBeLessThanOrEqual(2);
  });

  it("keeps the drawn canvas when a gesture moved nothing", async () => {
    const { cropper, photo } = await mount(1024);
    await sharp(photo);
    const jobs = flights("resample");
    cropper.begin("pan");
    await nextFrame();
    cropper.end();
    await sharp(photo);
    expect(jobs.total()).toBe(0);
  });

  it.each<[string, (cropper: Cropper, before: CropValue) => void]>([
    [
      "setZoom",
      (cropper) => {
        cropper.setZoom(1);
      },
    ],
    [
      "setValue",
      (cropper, before) => {
        cropper.setValue(before);
      },
    ],
  ])(
    "keeps the drawn canvas when %s returns to it while a later job runs",
    async (_, back) => {
      const { cropper, photo } = await mount(400, await gradient());
      await sharp(photo);
      const before = cropper.getValue();
      const jobs = stalled("region");
      cropper.begin("pan");
      cropper.setZoom(3);
      await nextFrame();
      cropper.end();
      await expect.poll(() => jobs.total(), { timeout: 3000 }).toBe(1);
      back(cropper, before);
      await nextFrame();
      await jobs.release();
      await sharp(photo);
      expect(paintError(cropper, photo)).toBeLessThan(5);
    }
  );

  it("drops the waiting job of a resize there and back", async () => {
    const { cropper, photo, viewport } = await mount(1024, await gradient());
    await sharp(photo);
    const canvas = photo.querySelector("canvas");
    const width = canvas?.width;
    const jobs = flights("resample");
    viewport.style.width = "300px";
    await waitForLayout(cropper, 300);
    viewport.style.width = "400px";
    await waitForLayout(cropper, 400);
    await new Promise((resolve) => {
      setTimeout(resolve, 300);
    });
    expect(jobs.total()).toBe(0);
    expect(canvas?.width).toBe(width);
    expect(paintError(cropper, photo)).toBeLessThan(5);
    await sharp(photo);
  });

  it("redraws at the new pixel ratio when only the ratio changed", async () => {
    const { cropper, photo } = await mount(1024);
    await sharp(photo);
    const layout = viewOf(cropper).frame()?.layout;
    const canvas = photo.querySelector("canvas");
    if (!layout || !canvas) {
      throw new Error("no layout");
    }
    const dpr = layout.dpr * 2;
    viewOf(cropper).setLayout({ ...layout, dpr });
    await expect
      .poll(() => canvas.width, { timeout: 3000 })
      .toBe(layout.width * dpr);
    await sharp(photo);
  });

  it.each<[string, number, number, number]>([
    ["resample", 1024, 1.2, 1.3],
    ["region", 400, 6, 7],
  ])(
    "starts the next job once a %s reply is overdue",
    async (op, previewEdge, first, second) => {
      const { cropper, photo } = await mount(previewEdge);
      await sharp(photo);
      const jobs = stalled(op);
      vi.useFakeTimers({
        shouldAdvanceTime: true,
        toFake: ["setTimeout", "clearTimeout"],
      });
      cleanups.push(() => {
        vi.useRealTimers();
      });
      cropper.setZoom(first);
      await expect.poll(() => jobs.total(), { timeout: 3000 }).toBe(1);
      cropper.setZoom(second);
      await nextFrame();
      await nextFrame();
      expect(jobs.total()).toBe(1);
      vi.advanceTimersByTime(TIMEOUT);
      await expect.poll(() => jobs.total(), { timeout: 3000 }).toBe(2);
      await sharp(photo);
    }
  );

  it("sharpens a new photo after a reply never came for the last one", async () => {
    const { cropper, photo } = await mount(1024);
    await sharp(photo);
    const jobs = stalled("resample");
    vi.useFakeTimers({
      shouldAdvanceTime: true,
      toFake: ["setTimeout", "clearTimeout"],
    });
    cleanups.push(() => {
      vi.useRealTimers();
    });
    cropper.setZoom(1.2);
    await expect.poll(() => jobs.total(), { timeout: 3000 }).toBe(1);
    attachImage(
      cropper,
      await loadImage(await stripes(), { previewEdge: 1024 })
    );
    vi.advanceTimersByTime(TIMEOUT);
    await sharp(photo);
  });

  it("draws the frame of the current ticket when a late reply lands after the limit", async () => {
    const { cropper, photo } = await mount(400, await gradient());
    await sharp(photo);
    const jobs = stalled("region");
    vi.useFakeTimers({
      shouldAdvanceTime: true,
      toFake: ["setTimeout", "clearTimeout"],
    });
    cleanups.push(() => {
      vi.useRealTimers();
    });
    cropper.setZoom(3);
    await expect.poll(() => jobs.total(), { timeout: 3000 }).toBe(1);
    vi.advanceTimersByTime(TIMEOUT);
    cropper.setZoom(4);
    await expect.poll(() => jobs.total(), { timeout: 3000 }).toBe(2);
    await sharp(photo);
    await jobs.release();
    await sharp(photo);
    expect(paintError(cropper, photo)).toBeLessThan(5);
  });

  it("draws a cropped resample where the whole preview would land", async () => {
    const canvas = new OffscreenCanvas(1600, 1200);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("no 2d context");
    }
    const across = context.createLinearGradient(0, 0, 1600, 0);
    across.addColorStop(0, "#000");
    across.addColorStop(1, "#f00");
    context.fillStyle = across;
    context.fillRect(0, 0, 1600, 1200);
    context.globalCompositeOperation = "lighter";
    const down = context.createLinearGradient(0, 0, 0, 1200);
    down.addColorStop(0, "#000");
    down.addColorStop(1, "#00f");
    context.fillStyle = down;
    context.fillRect(0, 0, 1600, 1200);
    const { cropper, photo } = await mount(
      1600,
      await canvas.convertToBlob({ type: "image/png" })
    );
    cropper.setZoom(2);
    const rest = photo.querySelector("canvas");
    await sharp(photo);
    await expect
      .poll(() => viewOf(cropper).frame()?.matrix[0], { timeout: 3000 })
      .toBeGreaterThan(0.4);
    await sharp(photo);
    const frame = viewOf(cropper).frame();
    const drawn = rest?.getContext("2d");
    if (!frame || !drawn || !rest) {
      throw new Error("no frame");
    }
    const [a, , e, , d, f] = frame.matrix;
    const { dpr } = frame.layout;
    for (const [x, y] of [
      [100, 80],
      [200, 150],
      [300, 220],
    ] as const) {
      const pixel = drawn.getImageData(x * dpr, y * dpr, 1, 1).data;
      expect(pixel[0]).toBeCloseTo(((x - e) / a / 1600) * 255, -1);
      expect(pixel[2]).toBeCloseTo(((y - f) / d / 1200) * 255, -1);
    }
  });

  it("takes the photo off the moving image and the canvas when it goes", async () => {
    const { cropper, photo } = await mount(1024);
    const motion = photo.querySelector("img");
    const canvas = photo.querySelector("canvas");
    await expect
      .poll(() => motion?.getAttribute("src") ?? "", { timeout: 3000 })
      .toMatch(/^blob:/u);
    await sharp(photo);
    attachImage(cropper, null);
    expect(motion?.hasAttribute("src")).toBeFalsy();
    expect([canvas?.width, canvas?.height]).toStrictEqual([0, 0]);
  });

  it("hides the canvas when a photo leaves before its moving image is ready", async () => {
    const { cropper, photo } = await mount(1024);
    const next = await loadImage(await stripes(), { previewEdge: 1024 });
    attachImage(cropper, null);
    attachImage(cropper, next);
    const canvas = photo.querySelector("canvas");
    expect(canvas?.style.visibility).toBe("visible");
    attachImage(cropper, null);
    expect(canvas?.style.visibility).toBe("hidden");
  });

  it("sets no moving image for a photo that left while it encoded", async () => {
    const { cropper, photo } = await mount(1024);
    const motion = photo.querySelector("img");
    const next = await loadImage(await stripes(), { previewEdge: 1024 });
    attachImage(cropper, next);
    attachImage(cropper, null);
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });
    expect(motion?.hasAttribute("src")).toBeFalsy();
  });

  it("clears the moving image when unbound", async () => {
    const viewport = document.createElement("div");
    viewport.style.cssText = "position:relative;width:400px;height:300px;";
    const photo = document.createElement("div");
    viewport.append(photo);
    document.body.append(viewport);
    const cropper = createCropper();
    const offViewport = bindViewport(cropper, viewport);
    const offPhoto = bindPhoto(cropper, photo);
    attachImage(
      cropper,
      await loadImage(await stripes(), { previewEdge: 1024 })
    );
    const motion = photo.querySelector("img");
    await expect
      .poll(() => motion?.getAttribute("src") ?? "", { timeout: 3000 })
      .toMatch(/^blob:/u);
    offPhoto();
    expect(motion?.hasAttribute("src")).toBeFalsy();
    offViewport();
    attachImage(cropper, null);
    cropper.destroy();
    viewport.remove();
  });

  it("leaves the layers alone on the moving frames of a gesture", async () => {
    const { cropper, photo } = await mount(512);
    await sharp(photo);
    cropper.begin("dial");
    cropper.setRotation(1);
    await expect
      .poll(() => Object.hasOwn(photo.dataset, "sharp"), { timeout: 3000 })
      .toBeFalsy();
    const toggle = vi.spyOn(photo, "toggleAttribute");
    for (let step = 2; step < 12; step += 1) {
      cropper.setRotation(step, { reason: "dial" });
      await new Promise((resolve) => {
        requestAnimationFrame(resolve);
      });
    }
    cropper.end();
    expect(toggle).not.toHaveBeenCalled();
  });

  it.each([
    ["img{max-height:100%}"],
    ["*{max-height:100%}"],
    ["img{border:4px solid red;padding:4px}"],
    ["img{min-width:3000px;min-height:3000px}"],
  ])("keeps the moving image at photo size under %s", async (css) => {
    pageRule(css);
    const { cropper, photo } = await mount(1024);
    await sharp(photo);
    cropper.begin("pan");
    const image = await visibleImage(photo);
    expect([image.offsetWidth, image.offsetHeight]).toStrictEqual([1600, 1200]);
    expect([image.clientLeft, image.clientTop]).toStrictEqual([0, 0]);
    cropper.end();
  });

  it("moves with the pointer under a global transition on the page", async () => {
    pageRule("*,*::before,*::after{transition:all .2s}");
    const { cropper, photo } = await mount(1024);
    await sharp(photo);
    cropper.setZoom(2);
    await sharp(photo);
    const canvas = photo.querySelector("canvas");
    if (!canvas) {
      throw new Error("no canvas");
    }
    cropper.begin("pan");
    const image = await visibleImage(photo);
    expect(getComputedStyle(canvas).visibility).toBe("hidden");
    for (let step = 0; step < 6; step += 1) {
      cropper.panBy(0.02, 0);
      await nextFrame();
      const wanted = new DOMMatrix(image.style.transform);
      const drawn = new DOMMatrix(getComputedStyle(image).transform);
      expect(Math.abs(wanted.e - drawn.e)).toBeLessThan(0.5);
    }
    cropper.end();
  });
});
