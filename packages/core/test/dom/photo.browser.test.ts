import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";

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

const LAYOUT_IDLE = 120;

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

const mount = async (
  previewEdge: number,
  blob?: Blob,
  defaultValue?: Partial<CropValue>,
  display = ""
) => {
  const viewport = document.createElement("div");

  viewport.style.cssText = "position:relative;width:400px;height:300px;";
  const photo = document.createElement("div");

  photo.style.display = display;
  viewport.append(photo);
  document.body.append(viewport);
  const cropper = createCropper({ defaultValue });
  const offViewport = bindViewport(cropper, viewport);
  const unbind = bindPhoto(cropper, photo);

  attachImage(
    cropper,
    await loadImage(blob ?? (await stripes()), { previewEdge })
  );

  cleanups.push(() => {
    offViewport();
    unbind();
    attachImage(cropper, null);
    viewOf(cropper).destroy();
    cropper.destroy();
    viewport.remove();
  });

  return { cropper, photo, unbind, viewport };
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

const stalledSharpen = () => {
  const parked: (() => void)[] = [];
  let total = 0;
  let landed: unknown;
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

    if (
      isJob(message) &&
      (message.op === "resample" || (message.op === "release" && total > 0))
    ) {
      if (message.op === "resample") {
        total += 1;
      }

      if (total === 1 && message.op === "resample") {
        const onReply = (
          event: MessageEvent<{ id: number; result?: unknown }>
        ): void => {
          if (event.data.id === message.id) {
            landed = event.data.result ?? null;
            this.removeEventListener("message", onReply);
          }
        };

        this.addEventListener("message", onReply);
      }

      parked.push(() => {
        Reflect.apply(post, this, args);
      });

      return;
    }

    Reflect.apply(post, this, args);
  });

  const send = (): void => {
    for (const run of parked.splice(0)) {
      run();
    }
  };

  cleanups.push(() => {
    spy.mockRestore();
    send();
  });

  return {
    land: async (): Promise<unknown> => {
      send();

      await expect
        .poll(() => landed !== undefined, { timeout: 3000 })
        .toBeTruthy();

      await nextFrame();

      return landed;
    },
    total: () => total,
  };
};

const failing = (op: string) => {
  const post: unknown = Reflect.get(Worker.prototype, "postMessage");

  if (typeof post !== "function") {
    throw new TypeError("no postMessage");
  }

  let total = 0;
  const spy = vi.spyOn(Worker.prototype, "postMessage");

  spy.mockImplementation(function record(
    this: Worker,
    ...args: Parameters<Worker["postMessage"]>
  ): void {
    const message: unknown = args[0];

    if (isJob(message) && message.op === op) {
      total += 1;
      const { id } = message;

      setTimeout(() => {
        this.dispatchEvent(
          new MessageEvent("message", { data: { error: "failed", id } })
        );
      }, 0);

      return;
    }

    Reflect.apply(post, this, args);
  });

  cleanups.push(() => {
    spy.mockRestore();
  });

  return {
    heal: () => {
      spy.mockRestore();
    },
    total: () => total,
  };
};

const opsSent = (): string[] => {
  const ops: string[] = [];
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

    if (isJob(message)) {
      ops.push(message.op);
    }

    Reflect.apply(post, this, args);
  });

  cleanups.push(() => {
    spy.mockRestore();
  });

  return ops;
};

const watchErrors = (): string[] => {
  const errors: string[] = [];

  const onError = (event: ErrorEvent): void => {
    errors.push(event.message);
  };

  window.addEventListener("error", onError);

  cleanups.push(() => {
    window.removeEventListener("error", onError);
  });

  return errors;
};

const lines = async (width: number): Promise<Blob> => {
  const canvas = new OffscreenCanvas(width, 100);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("no 2d context");
  }

  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, 100);
  context.fillStyle = "#000";

  for (let x = 0; x < width; x += 2) {
    context.fillRect(x, 0, 1, 100);
  }

  return await canvas.convertToBlob({ type: "image/png" });
};

const shotContrast = async (element: HTMLElement): Promise<number> => {
  const shot = await page.screenshot({ element, save: false });
  const bytes = Uint8Array.from(atob(shot), (c) => c.codePointAt(0) ?? 0);
  const bitmap = await createImageBitmap(new Blob([bytes]));
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("no 2d context");
  }

  context.drawImage(bitmap, 0, 0);
  const y = Math.floor(bitmap.height / 2);
  const left = Math.floor(bitmap.width * 0.2);
  const { data } = context.getImageData(left, y, 40, 1);
  let low = 255;
  let high = 0;

  for (let i = 0; i < data.length; i += 4) {
    low = Math.min(low, data[i] ?? 0);
    high = Math.max(high, data[i] ?? 0);
  }

  return high - low;
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

const TILT = { perspective: { horizontal: 0, vertical: 20 } };

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

  it("revokes the first file when a second photo arrives, and holds one url", async () => {
    const create = vi.spyOn(URL, "createObjectURL");
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    cleanups.push(() => {
      create.mockRestore();
      revoke.mockRestore();
    });

    const { cropper, photo } = await mount(1024);
    const motion = photo.querySelector("img");

    await expect
      .poll(() => motion?.getAttribute("src") ?? "", { timeout: 3000 })
      .toMatch(/^blob:/u);

    const first = motion?.getAttribute("src") ?? "";

    attachImage(
      cropper,
      await loadImage(await stripes(), { previewEdge: 1024 })
    );

    await expect.poll(() => revoke.mock.calls.flat()).toContain(first);

    await expect
      .poll(() => motion?.getAttribute("src") ?? first, { timeout: 3000 })
      .not.toBe(first);

    const live = create.mock.results
      .map(({ value }: { value: unknown }) => value)
      .filter((url) => !revoke.mock.calls.some(([gone]) => gone === url));

    expect(live).toStrictEqual([motion?.getAttribute("src")]);
  });

  it("revokes the file and hides both layers when the photo is cleared", async () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    cleanups.push(() => {
      revoke.mockRestore();
    });

    const { cropper, photo } = await mount(1024);
    const motion = photo.querySelector("img");

    await sharp(photo);
    const url = motion?.getAttribute("src");

    attachImage(cropper, null);
    await expect.poll(() => revoke.mock.calls.flat()).toContain(url);

    expect({
      canvas: photo.querySelector("canvas")?.style.visibility,
      image: motion?.style.visibility,
      sharp: Object.hasOwn(photo.dataset, "sharp"),
    }).toStrictEqual({ canvas: "hidden", image: "hidden", sharp: false });
  });

  it("shows the moving image when its decode lands during a gesture", async () => {
    const { cropper, photo } = await mount(1024);

    await sharp(photo);

    attachImage(
      cropper,
      await loadImage(await stripes(), { previewEdge: 1024 })
    );

    cropper.begin("pan");
    const image = await visibleImage(photo);

    expect(image.style.visibility).toBe("visible");
    cropper.end();
  });

  it.each<[string, (cropper: Cropper, unbind: () => void) => Promise<void>]>([
    [
      "a gesture",
      async (cropper) => {
        cropper.begin("pan");
        await nextFrame();
      },
    ],
    [
      "a swap",
      async (cropper) => {
        attachImage(
          cropper,
          await loadImage(await stripes(), { previewEdge: 1024 })
        );
      },
    ],
    [
      "a clear",
      async (cropper) => {
        attachImage(cropper, null);
        await nextFrame();
      },
    ],
    [
      "an unbind",
      async (_cropper, unbind) => {
        unbind();
        await nextFrame();
      },
    ],
  ])(
    "keeps data-sharp off and closes the late bitmap unpainted when %s lands during a sharpen",
    async (_, act) => {
      const errors = watchErrors();
      const { cropper, photo, unbind } = await mount(1024);

      await sharp(photo);
      const draws = vi.spyOn(CanvasRenderingContext2D.prototype, "drawImage");

      cleanups.push(() => {
        draws.mockRestore();
      });

      const jobs = stalledSharpen();

      cropper.setZoom(1.2);
      await expect.poll(() => jobs.total(), { timeout: 3000 }).toBe(1);
      expect(Object.hasOwn(photo.dataset, "sharp")).toBeFalsy();
      await act(cropper, unbind);
      const late = await jobs.land();

      expect(Object.hasOwn(photo.dataset, "sharp")).toBeFalsy();
      expect(late).toHaveProperty("width", 0);
      expect(draws.mock.calls.flat()).not.toContain(late);
      cropper.end();
      expect(errors).toStrictEqual([]);
    }
  );

  it("starts no sharpen after unbind with the timer pending", async () => {
    const { photo, unbind, viewport } = await mount(1024);

    await sharp(photo);
    const ops = opsSent();
    const realTimeout = setTimeout.bind(globalThis);
    let idle: ReturnType<typeof setTimeout> | undefined;
    const arm = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation((run, ms) => {
        if (ms !== LAYOUT_IDLE) {
          return realTimeout(run, ms);
        }

        idle = realTimeout(run, 60_000);

        return idle;
      });
    const clear = vi.spyOn(globalThis, "clearTimeout");

    cleanups.push(() => {
      arm.mockRestore();
      clear.mockRestore();
    });

    viewport.style.width = "500px";
    await expect.poll(() => idle, { timeout: 3000 }).toBeDefined();
    unbind();
    expect(clear).toHaveBeenCalledWith(idle);
    expect(ops).not.toContain("resample");
  });

  it("swallows a failed encode and paints the preview on the canvas", async () => {
    const errors = watchErrors();
    const jobs = failing("motion");
    const { photo } = await mount(1024);

    await expect.poll(() => jobs.total(), { timeout: 3000 }).toBe(1);

    await expect
      .poll(() => photo.querySelector("canvas")?.style.visibility, {
        timeout: 3000,
      })
      .toBe("visible");

    expect(errors).toStrictEqual([]);
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

  it("shows a saved perspective on the moving image once it is ready, not flat on the canvas", async () => {
    const { photo } = await mount(1024, undefined, TILT);
    const image = await visibleImage(photo);

    expect(image.style.transform).toContain("matrix3d");
    expect(photo.querySelector("canvas")?.style.visibility).toBe("hidden");
    expect(Object.hasOwn(photo.dataset, "sharp")).toBeFalsy();
  });

  it("never paints perspective on the canvas while the moving image is missing", async () => {
    const decode = vi
      .spyOn(HTMLImageElement.prototype, "decode")
      .mockRejectedValue(new Error("blocked"));

    cleanups.push(() => {
      decode.mockRestore();
    });

    const { cropper, photo } = await mount(1024, undefined, TILT);

    await expect.poll(() => decode.mock.calls.length).toBe(1);
    cropper.invalidate();
    await nextFrame();
    await nextFrame();
    expect(photo.querySelector("canvas")?.style.visibility).toBe("hidden");
    expect(photo.querySelector("img")?.style.visibility).toBe("hidden");
  });

  it("keeps painting a level photo on the canvas when the moving image cannot decode", async () => {
    const decode = vi
      .spyOn(HTMLImageElement.prototype, "decode")
      .mockRejectedValue(new Error("blocked"));

    cleanups.push(() => {
      decode.mockRestore();
    });

    const { cropper, photo } = await mount(1024);

    await sharp(photo);
    cropper.begin("pan");
    cropper.setZoom(2);
    await nextFrame();
    await nextFrame();
    expect(photo.querySelector("canvas")?.style.visibility).toBe("visible");
    cropper.end();
    await sharp(photo);
  });

  it("takes data-sharp off while the canvas falls back to the preview", async () => {
    stalled("motion");
    const { cropper, photo } = await mount(1024);

    await sharp(photo);
    cropper.begin("pan");
    cropper.setZoom(2);
    await nextFrame();
    await nextFrame();
    expect(Object.hasOwn(photo.dataset, "sharp")).toBeFalsy();
    expect(photo.querySelector("canvas")?.style.visibility).toBe("visible");
    cropper.end();
    await sharp(photo);
  });

  it("keeps the canvas one to one with device pixels on a fractional viewport", async () => {
    const wrap = document.createElement("div");

    wrap.style.cssText =
      "position:absolute;left:0;top:0;width:400px;height:300px;";

    const viewport = document.createElement("div");

    viewport.style.cssText =
      "position:absolute;left:0.5px;top:0;box-sizing:border-box;padding:16px;width:333.5px;height:300px;";

    const photo = document.createElement("div");

    viewport.append(photo);
    wrap.append(viewport);
    document.body.append(wrap);
    const cropper = createCropper();
    const off = [bindViewport(cropper, viewport), bindPhoto(cropper, photo)];
    const width = Math.round((viewport.clientWidth - 32) * devicePixelRatio);

    attachImage(
      cropper,
      await loadImage(await lines(width), { previewEdge: 4096 })
    );

    cleanups.push(() => {
      for (const stop of off) {
        stop();
      }

      attachImage(cropper, null);
      viewOf(cropper).destroy();
      cropper.destroy();
      wrap.remove();
    });

    await sharp(photo);
    const canvas = photo.querySelector("canvas");

    if (!canvas) {
      throw new Error("no canvas");
    }

    await expect(shotContrast(wrap)).resolves.toBeGreaterThan(200);
    expect(canvas.style.width).toBe(`${canvas.width / devicePixelRatio}px`);
    expect(canvas.style.height).toBe(`${canvas.height / devicePixelRatio}px`);
  });

  it.each([
    ["img{max-height:100%}"],
    ["*{max-height:100%}"],
    ["img{border:4px solid red;padding:4px}"],
    ["img{min-width:3000px;min-height:3000px}"],
    ["img{margin:10px}"],
  ])("keeps the moving image at photo size under %s", async (css) => {
    pageRule(css);
    const { cropper, photo } = await mount(1024);

    await sharp(photo);
    cropper.begin("pan");
    const image = await visibleImage(photo);

    expect([image.offsetWidth, image.offsetHeight]).toStrictEqual([1600, 1200]);
    expect([image.clientLeft, image.clientTop]).toStrictEqual([0, 0]);
    expect([image.offsetLeft, image.offsetTop]).toStrictEqual([0, 0]);
    cropper.end();
  });

  it.each([
    ["canvas{min-width:3000px;min-height:3000px}"],
    ["canvas{border:4px solid red;padding:4px}"],
    ["canvas{margin:10px}"],
  ])("keeps the canvas at its own size and place under %s", async (css) => {
    pageRule(css);
    const { photo } = await mount(1024);

    await sharp(photo);
    const canvas = photo.querySelector("canvas");

    if (!canvas) {
      throw new Error("no canvas");
    }

    const box = canvas.getBoundingClientRect();
    const outer = photo.getBoundingClientRect();

    expect([box.width, box.height]).toStrictEqual([400, 300]);
    expect([box.x - outer.x, box.y - outer.y]).toStrictEqual([0, 0]);
    expect([canvas.clientLeft, canvas.clientTop]).toStrictEqual([0, 0]);
  });

  it("keeps the canvas at its own size under a page max size", async () => {
    pageRule("canvas{max-width:100%;max-height:100%}");
    const { cropper, photo, viewport } = await mount(1024);

    viewport.style.width = "333.5px";
    await waitForLayout(cropper, viewport.clientWidth);
    await sharp(photo);
    const canvas = photo.querySelector("canvas");
    const { dpr } = viewOf(cropper).frame()?.layout ?? { dpr: 1 };

    expect(canvas?.getBoundingClientRect().width).toBeCloseTo(
      (canvas?.width ?? 0) / dpr,
      2
    );
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

  it("shows the moving image, not an empty canvas, when the canvas has no 2d context", async () => {
    const viewport = document.createElement("div");

    viewport.style.cssText = "position:relative;width:400px;height:300px;";
    const photo = document.createElement("div");
    const own = document.createElement("canvas");

    own.getContext("bitmaprenderer");
    photo.append(own);
    viewport.append(photo);
    document.body.append(viewport);
    const cropper = createCropper();
    const off = [bindViewport(cropper, viewport), bindPhoto(cropper, photo)];

    attachImage(
      cropper,
      await loadImage(await stripes(), { previewEdge: 1024 })
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

    const image = await visibleImage(photo);

    expect(own.style.visibility).toBe("hidden");
    cropper.begin("pan");
    cropper.end();
    const seen = vi.spyOn(own, "getContext");

    cleanups.push(() => {
      seen.mockRestore();
    });

    await expect
      .poll(() => seen.mock.calls.length, { timeout: 3000 })
      .toBeGreaterThan(0);

    await nextFrame();
    expect(image.style.visibility).toBe("visible");
    expect(Object.hasOwn(photo.dataset, "sharp")).toBeFalsy();
  });

  it("falls back to the moving image when the canvas context is lost and redraws when it returns", async () => {
    const { photo } = await mount(1024);

    await sharp(photo);
    const canvas = photo.querySelector("canvas");
    const context = canvas?.getContext("2d");

    if (!(canvas && context)) {
      throw new Error("no canvas");
    }

    canvas.dispatchEvent(new Event("contextlost"));
    await visibleImage(photo);
    expect(canvas.style.visibility).toBe("hidden");
    expect(Object.hasOwn(photo.dataset, "sharp")).toBeFalsy();
    context.clearRect(0, 0, canvas.width, canvas.height);
    canvas.dispatchEvent(new Event("contextrestored"));
    await sharp(photo);
    expect(canvas.style.visibility).toBe("visible");
    const { data } = context.getImageData(
      canvas.width / 2,
      canvas.height / 2,
      1,
      1
    );

    expect(data[3]).toBe(255);
  });

  it("shows the moving image when the context reports itself lost", async () => {
    const lost = vi.fn<() => boolean>(() => true);
    const proto = CanvasRenderingContext2D.prototype;
    const native = Object.getOwnPropertyDescriptor(proto, "isContextLost");

    Object.defineProperty(proto, "isContextLost", {
      configurable: true,
      value: lost,
    });

    cleanups.push(() => {
      if (native) {
        Object.defineProperty(proto, "isContextLost", native);
      } else {
        Reflect.deleteProperty(proto, "isContextLost");
      }
    });

    const { photo } = await mount(1024);
    const image = await visibleImage(photo);

    await expect
      .poll(() => lost.mock.calls.length, { timeout: 3000 })
      .toBeGreaterThan(1);

    await nextFrame();
    expect(image.style.visibility).toBe("visible");
    expect(photo.querySelector("canvas")?.style.visibility).toBe("hidden");
    expect(Object.hasOwn(photo.dataset, "sharp")).toBeFalsy();
  });

  it("clears will-change after a settle on a perspective frame", async () => {
    const { cropper, photo } = await mount(1024, undefined, TILT);
    const image = await visibleImage(photo);

    cropper.begin("pan");
    expect(image.style.willChange).toBe("transform");
    cropper.end();
    await expect.poll(() => image.style.willChange).toBe("");
    expect(image.style.visibility).toBe("visible");
  });

  it("paints the preview without data-sharp when a sharpen job fails, and tries again on the next settle", async () => {
    const { cropper, photo } = await mount(1024);

    await sharp(photo);
    cropper.begin("pan");
    const image = await visibleImage(photo);

    cropper.end();
    await sharp(photo);
    const canvas = photo.querySelector("canvas");
    const jobs = failing("resample");

    cropper.begin("pan");
    cropper.setZoom(1.2);
    await nextFrame();
    cropper.end();
    await expect.poll(() => jobs.total(), { timeout: 3000 }).toBe(1);

    await expect
      .poll(() => canvas?.style.visibility, { timeout: 3000 })
      .toBe("visible");

    expect(Object.hasOwn(photo.dataset, "sharp")).toBeFalsy();
    expect(image.style.visibility).toBe("hidden");
    expect(image.style.willChange).toBe("");
    cropper.begin("pan");
    await nextFrame();
    cropper.end();
    await expect.poll(() => jobs.total(), { timeout: 3000 }).toBe(2);
    jobs.heal();
    cropper.begin("pan");
    await nextFrame();
    cropper.end();
    await sharp(photo);
  });

  it("does not take a frame the failed job painted over for the sharp one", async () => {
    const { cropper, photo } = await mount(1024);

    await sharp(photo);
    const jobs = failing("resample");

    cropper.setZoom(1.2);
    await expect.poll(() => jobs.total(), { timeout: 3000 }).toBe(1);

    await expect
      .poll(() => Object.hasOwn(photo.dataset, "sharp"), { timeout: 3000 })
      .toBeFalsy();

    await expect
      .poll(() => photo.querySelector("canvas")?.style.visibility, {
        timeout: 3000,
      })
      .toBe("visible");

    cropper.setZoom(1);
    await expect.poll(() => jobs.total(), { timeout: 3000 }).toBe(2);
    expect(Object.hasOwn(photo.dataset, "sharp")).toBeFalsy();
  });

  it("keeps will-change when a job ends during the next gesture", async () => {
    const { cropper, photo } = await mount(1024);

    await sharp(photo);
    cropper.begin("pan");
    const image = await visibleImage(photo);

    cropper.end();
    await sharp(photo);
    const jobs = stalled("resample");

    cropper.setZoom(1.2);
    await expect.poll(() => jobs.total(), { timeout: 3000 }).toBe(1);
    cropper.begin("pan");
    await jobs.release();
    expect(image.style.willChange).toBe("transform");
    cropper.end();
  });

  it.each<[string, (cropper: Cropper) => void]>([
    [
      "a turn",
      (cropper) => {
        cropper.rotate90();
      },
    ],
    [
      "a gesture",
      (cropper) => {
        cropper.begin("pan");
      },
    ],
  ])("turns sharp when it is bound during %s", async (_, start) => {
    const viewport = document.createElement("div");

    viewport.style.cssText = "position:relative;width:400px;height:300px;";
    const photo = document.createElement("div");

    viewport.append(photo);
    document.body.append(viewport);
    const cropper = createCropper();
    const off = [bindViewport(cropper, viewport)];

    attachImage(
      cropper,
      await loadImage(await stripes(), { previewEdge: 1024 })
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

    await waitForLayout(cropper, 400);
    cropper.invalidate();
    await nextFrame();
    await nextFrame();
    start(cropper);

    await expect
      .poll(() => {
        const { interacting, settling } = cropper.getState();

        return interacting !== null || settling;
      })
      .toBeTruthy();

    off.push(bindPhoto(cropper, photo));

    if (cropper.getState().interacting !== null) {
      cropper.end();
    }

    await sharp(photo);
    expect(photo.querySelector("img")?.style.willChange).toBe("");
  });

  it("does no photo work in a copy without a box until it shows", async () => {
    const jobs = flights("motion");
    const { cropper, photo, viewport } = await mount(1024);
    const hidden = document.createElement("div");

    hidden.style.display = "none";
    viewport.append(hidden);
    const stop = bindPhoto(cropper, hidden);

    cleanups.unshift(stop);
    await sharp(photo);

    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });

    expect(jobs.total()).toBe(1);
    expect(hidden.querySelector("canvas")?.width).toBe(300);
    expect(Object.hasOwn(hidden.dataset, "sharp")).toBeFalsy();
    hidden.style.display = "block";
    await sharp(hidden);

    expect(hidden.querySelector("canvas")?.width).toBe(
      photo.querySelector("canvas")?.width
    );

    expect(jobs.total()).toBe(1);
  });

  it("frees a hidden copy without a window error when it shows after destroy", async () => {
    const errors = watchErrors();
    const { cropper, photo } = await mount(1024, undefined, undefined, "none");

    await nextFrame();
    cropper.destroy();
    await nextFrame();
    photo.style.display = "block";

    await expect
      .poll(() => photo.querySelector("canvas")?.width, { timeout: 3000 })
      .toBe(0);

    expect(errors).toStrictEqual([]);
  });

  it("frees the photo without a window error when the context returns after destroy", async () => {
    const errors = watchErrors();

    stalled("motion");
    const { cropper, photo } = await mount(1024);

    await sharp(photo);
    const canvas = photo.querySelector("canvas");

    canvas?.dispatchEvent(new Event("contextlost"));
    cropper.destroy();
    canvas?.dispatchEvent(new Event("contextrestored"));
    expect(canvas?.width).toBe(0);
    expect(errors).toStrictEqual([]);
  });

  it("takes no moving image and runs no sharpen in a lone hidden copy until it shows", async () => {
    const jobs = opsSent();
    const { cropper, photo } = await mount(1024, undefined, undefined, "none");
    const image = photo.querySelector("img");

    cropper.begin("pan");
    cropper.setZoom(1.2);
    await nextFrame();
    cropper.end();
    await expect.poll(() => cropper.getState().settling).toBeFalsy();

    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });

    expect(jobs).not.toContain("motion");
    expect(jobs).not.toContain("resample");
    expect(image?.hasAttribute("src")).toBeFalsy();
    photo.style.display = "block";
    await sharp(photo);
    cropper.begin("pan");
    await visibleImage(photo);
    cropper.end();
    expect(jobs).toContain("motion");
  });

  it("shares one moving image file between copies of a photo", async () => {
    const jobs = flights("motion");
    const made = vi.spyOn(URL, "createObjectURL");
    const revoked = vi.spyOn(URL, "revokeObjectURL");

    cleanups.push(() => {
      made.mockRestore();
      revoked.mockRestore();
    });

    const { cropper, photo, viewport } = await mount(1024);
    const copy = document.createElement("div");

    viewport.append(copy);
    const stop = bindPhoto(cropper, copy);

    await sharp(photo);
    await sharp(copy);
    const first = photo.querySelector("img");
    const second = copy.querySelector("img");

    await expect.poll(() => first?.src).toBeTruthy();
    await expect.poll(() => second?.src).toBeTruthy();
    expect(second?.src).toBe(first?.src);
    expect(jobs.total()).toBe(1);
    const src = first?.src ?? "";

    stop();
    await nextFrame();
    expect(revoked).not.toHaveBeenCalledWith(src);
    cropper.begin("pan");
    await visibleImage(photo);
    cropper.end();
    attachImage(cropper, null);
    await expect.poll(() => revoked.mock.calls.flat()).toContain(src);
  });
});
