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
import { TIMEOUT_MS } from "../../src/dom/turn";

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

    const container = doc.createElement("div");

    doc.body.append(container);
    const cropper = createCropper();
    const off = bindPhoto(cropper, container);

    cleanups.push(() => {
      off();
      cropper.destroy();
      frame.remove();
    });

    const layers = [...container.querySelectorAll("img, canvas")];

    expect(layers.map((layer) => layer.localName).toSorted()).toStrictEqual([
      "canvas",
      "img",
    ]);

    expect(layers.every((layer) => layer.ownerDocument === doc)).toBeTruthy();
  });

  it("places the rest canvas through a transform like the moving image", async () => {
    const { photo } = await mount(1024);
    const canvas = photo.querySelector("canvas");

    if (!canvas) {
      throw new Error("no canvas");
    }

    expect(getComputedStyle(canvas).transform).toBe("matrix(1, 0, 0, 1, 0, 0)");
  });

  it("shows a sharp canvas at rest and the moving image during a gesture, also when the image arrives with the binder", async () => {
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
    const canvas = photo.querySelector("canvas");
    const moving = photo.querySelector("img");

    expect(canvas?.style.visibility).toBe("visible");
    expect(moving?.style.visibility).toBe("hidden");
    cropper.begin("pan");

    await expect
      .poll(() => moving?.style.visibility, { timeout: 5000 })
      .toBe("visible");

    expect(Object.hasOwn(photo.dataset, "sharp")).toBeFalsy();
    cropper.end();
    await sharp(photo);
  });

  it("shows the moving image when it decodes after a gesture began, and when a swap decodes during one", async () => {
    const decode = vi.spyOn(HTMLImageElement.prototype, "decode");
    let finish: (() => void) | undefined;

    decode.mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
    });

    const { cropper, photo } = await mount(1024);

    await sharp(photo);
    const image = photo.querySelector("img");

    cropper.begin("pan");
    await expect.poll(() => decode.mock.calls.length).toBeGreaterThan(0);
    expect(image?.style.visibility).toBe("hidden");
    finish?.();

    await expect
      .poll(() => image?.style.visibility, { timeout: 5000 })
      .toBe("visible");

    cropper.end();
    decode.mockRestore();
    await sharp(photo);

    attachImage(
      cropper,
      await loadImage(await stripes(), { previewEdge: 1024 })
    );

    cropper.begin("pan");
    const swapped = await visibleImage(photo);

    expect(swapped.style.visibility).toBe("visible");
    cropper.end();
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

  it("starts at most one job for a burst of zoom writes, a resize drag or a gesture that moved nothing", async () => {
    const big = new OffscreenCanvas(6000, 4000);
    const context = big.getContext("2d");

    if (!context) {
      throw new Error("no 2d context");
    }

    context.fillStyle = "#fff";
    context.fillRect(0, 0, 6000, 4000);
    context.fillStyle = "#000";
    context.fillRect(0, 0, 3000, 2000);
    const deep = await mount(
      400,
      await big.convertToBlob({ type: "image/png" })
    );

    await sharp(deep.photo);
    const regions = flights("region");

    for (let i = 0; i < 12; i += 1) {
      deep.cropper.setZoom(3 + i * 0.1);
      await nextFrame();
    }

    await sharp(deep.photo);
    expect(regions.total()).toBeGreaterThan(0);
    expect(regions.peak()).toBe(1);
    vi.restoreAllMocks();

    const { cropper, photo, viewport } = await mount(1024);

    await sharp(photo);
    const resamples = flights("resample");

    for (let i = 0; i < 20; i += 1) {
      viewport.style.width = `${400 + i * 4}px`;
      await nextFrame();
    }

    await sharp(photo);
    const afterResize = resamples.total();

    expect(afterResize).toBeLessThanOrEqual(2);
    cropper.begin("pan");
    await nextFrame();
    cropper.end();
    await sharp(photo);
    expect(resamples.total()).toBe(afterResize);
  });

  it.each<[string, (rig: Awaited<ReturnType<typeof mount>>) => Promise<void>]>([
    [
      "setZoom",
      async ({ cropper }) => {
        const jobs = stalled("region");

        cropper.begin("pan");
        cropper.setZoom(3);
        await nextFrame();
        cropper.end();
        await expect.poll(() => jobs.total(), { timeout: 3000 }).toBe(1);
        cropper.setZoom(1);
        await nextFrame();
        await jobs.release();
      },
    ],
    [
      "setValue",
      async ({ cropper }) => {
        const before = cropper.getValue();
        const jobs = stalled("region");

        cropper.begin("pan");
        cropper.setZoom(3);
        await nextFrame();
        cropper.end();
        await expect.poll(() => jobs.total(), { timeout: 3000 }).toBe(1);
        cropper.setValue(before);
        await nextFrame();
        await jobs.release();
      },
    ],
    [
      "a resize there and back",
      async ({ cropper, photo, viewport }) => {
        const width = photo.querySelector("canvas")?.width;
        const jobs = flights("resample");

        viewport.style.width = "300px";
        await waitForLayout(cropper, 300);
        viewport.style.width = "400px";
        await waitForLayout(cropper, 400);

        await new Promise((resolve) => {
          setTimeout(resolve, 300);
        });

        expect(jobs.total()).toBe(0);
        expect(photo.querySelector("canvas")?.width).toBe(width);
      },
    ],
  ])(
    "keeps the drawn canvas when %s returns to it while a later job waits",
    async (_, back) => {
      const rig = await mount(400, await gradient());

      await sharp(rig.photo);
      await back(rig);
      await sharp(rig.photo);
      expect(paintError(rig.cropper, rig.photo)).toBeLessThan(5);
    }
  );

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

  it.each<[string, number, number, (cropper: Cropper) => Promise<void>]>([
    [
      "resample",
      1024,
      1.2,
      async (cropper) => {
        cropper.setZoom(1.3);
        await nextFrame();
      },
    ],
    [
      "region",
      400,
      6,
      async (cropper) => {
        cropper.setZoom(7);
        await nextFrame();
      },
    ],
    [
      "resample",
      1024,
      1.2,
      async (cropper) => {
        attachImage(
          cropper,
          await loadImage(await stripes(), { previewEdge: 1024 })
        );
      },
    ],
  ])(
    "starts the next job once a %s reply is overdue",
    async (op, previewEdge, first, write) => {
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
      await write(cropper);
      await nextFrame();
      await nextFrame();
      expect(jobs.total()).toBe(1);
      vi.advanceTimersByTime(TIMEOUT_MS);
      await expect.poll(() => jobs.total(), { timeout: 3000 }).toBe(2);
      await sharp(photo);
    }
  );

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
    vi.advanceTimersByTime(TIMEOUT_MS);
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

  it("revokes the file, empties both layers and hides them when the photo is cleared, also before the moving image is ready", async () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    cleanups.push(() => {
      revoke.mockRestore();
    });

    const { cropper, photo } = await mount(1024);
    const motion = photo.querySelector("img");
    const canvas = photo.querySelector("canvas");

    await expect
      .poll(() => motion?.getAttribute("src") ?? "", { timeout: 3000 })
      .toMatch(/^blob:/u);

    await sharp(photo);
    const url = motion?.getAttribute("src");

    attachImage(cropper, null);
    expect(motion?.hasAttribute("src")).toBeFalsy();
    expect([canvas?.width, canvas?.height]).toStrictEqual([0, 0]);
    await expect.poll(() => revoke.mock.calls.flat()).toContain(url);

    expect({
      canvas: canvas?.style.visibility,
      image: motion?.style.visibility,
      sharp: Object.hasOwn(photo.dataset, "sharp"),
    }).toStrictEqual({ canvas: "hidden", image: "hidden", sharp: false });

    attachImage(
      cropper,
      await loadImage(await stripes(), { previewEdge: 1024 })
    );

    const shown = canvas?.style.visibility;

    attachImage(cropper, null);

    expect([shown, canvas?.style.visibility]).toStrictEqual([
      "visible",
      "hidden",
    ]);
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

  it.each<
    [
      string,
      (
        cropper: Cropper,
        unbind: () => void,
        photo: HTMLElement
      ) => Promise<void>,
    ]
  >([
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
      async (_cropper, unbind, photo) => {
        unbind();
        expect(photo.querySelector("img")?.hasAttribute("src")).toBeFalsy();
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
      await act(cropper, unbind, photo);
      const late = await jobs.land();

      expect(Object.hasOwn(photo.dataset, "sharp")).toBeFalsy();
      expect(late).toHaveProperty("width", 0);
      expect(draws.mock.calls.flat()).not.toContain(late);
      cropper.end();
      expect(errors).toStrictEqual([]);
    }
  );

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

  it("shows a saved perspective on the moving image once it is ready, never flat on the canvas", async () => {
    const decode = vi
      .spyOn(HTMLImageElement.prototype, "decode")
      .mockRejectedValue(new Error("blocked"));

    cleanups.push(() => {
      decode.mockRestore();
    });

    const blocked = await mount(1024, undefined, TILT);

    await expect.poll(() => decode.mock.calls.length).toBe(1);
    blocked.cropper.invalidate();
    await nextFrame();
    await nextFrame();

    expect([
      blocked.photo.querySelector("canvas")?.style.visibility,
      blocked.photo.querySelector("img")?.style.visibility,
    ]).toStrictEqual(["hidden", "hidden"]);

    decode.mockRestore();

    const { photo } = await mount(1024, undefined, TILT);
    const image = await visibleImage(photo);

    expect(image.style.transform).toContain("matrix3d");
    expect(photo.querySelector("canvas")?.style.visibility).toBe("hidden");
    expect(Object.hasOwn(photo.dataset, "sharp")).toBeFalsy();
  });

  it.each<[string, () => void]>([
    [
      "cannot decode",
      () => {
        const decode = vi
          .spyOn(HTMLImageElement.prototype, "decode")
          .mockRejectedValue(new Error("blocked"));

        cleanups.push(() => {
          decode.mockRestore();
        });
      },
    ],
    [
      "is still encoding",
      () => {
        stalled("motion");
      },
    ],
  ])(
    "keeps painting a level photo on the canvas without data-sharp when the moving image %s",
    async (_, block) => {
      block();
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
    }
  );

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
    ["img{max-height:100%!important}"],
    ["img{max-width:100%!important}"],
    ["img,canvas{border:4px solid red;padding:4px}"],
    ["img,canvas{margin:10px}"],
    ["img,canvas{min-width:3000px;min-height:3000px}"],
    ["canvas{max-width:100%;max-height:100%}"],
  ])("keeps both layers at their own size and place under %s", async (css) => {
    pageRule(css);
    const { cropper, photo, viewport } = await mount(1024);

    viewport.style.width = "333.5px";
    await waitForLayout(cropper, viewport.clientWidth);
    await sharp(photo);
    const canvas = photo.querySelector("canvas");

    if (!canvas) {
      throw new Error("no canvas");
    }

    const box = canvas.getBoundingClientRect();
    const outer = photo.getBoundingClientRect();
    const { dpr } = viewOf(cropper).frame()?.layout ?? { dpr: 1 };

    expect({
      border: [canvas.clientLeft, canvas.clientTop],
      place: [box.x - outer.x, box.y - outer.y],
      size: [
        Math.abs(box.width - canvas.width / dpr) < 0.005,
        Math.abs(box.height - canvas.height / dpr) < 0.005,
      ],
    }).toStrictEqual({ border: [0, 0], place: [0, 0], size: [true, true] });

    cropper.begin("pan");
    const image = await visibleImage(photo);

    expect({
      border: [image.clientLeft, image.clientTop],
      place: [image.offsetLeft, image.offsetTop],
      size: [image.offsetWidth, image.offsetHeight],
    }).toStrictEqual({ border: [0, 0], place: [0, 0], size: [1600, 1200] });

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

  it.each<
    [
      string,
      () => Promise<{ canvas: HTMLCanvasElement; photo: HTMLElement }>,
      (photo: HTMLElement, canvas: HTMLCanvasElement) => Promise<void>,
    ]
  >([
    [
      "has no 2d context",
      async () => {
        const viewport = document.createElement("div");

        viewport.style.cssText = "position:relative;width:400px;height:300px;";
        const photo = document.createElement("div");
        const canvas = document.createElement("canvas");

        canvas.getContext("bitmaprenderer");
        photo.append(canvas);
        viewport.append(photo);
        document.body.append(viewport);
        const cropper = createCropper();
        const off = [
          bindViewport(cropper, viewport),
          bindPhoto(cropper, photo),
        ];

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

        await visibleImage(photo);
        expect(canvas.style.visibility).toBe("hidden");
        cropper.begin("pan");
        cropper.end();
        const seen = vi.spyOn(canvas, "getContext");

        cleanups.push(() => {
          seen.mockRestore();
        });

        await expect
          .poll(() => seen.mock.calls.length, { timeout: 3000 })
          .toBeGreaterThan(0);

        await nextFrame();

        return { canvas, photo };
      },
      async () => {},
    ],
    [
      "loses its context",
      async () => {
        const { photo } = await mount(1024);

        await sharp(photo);
        const canvas = photo.querySelector("canvas");

        if (!canvas) {
          throw new Error("no canvas");
        }

        canvas.dispatchEvent(new Event("contextlost"));

        return { canvas, photo };
      },
      async (photo, canvas) => {
        const context = canvas.getContext("2d");

        context?.clearRect(0, 0, canvas.width, canvas.height);
        canvas.dispatchEvent(new Event("contextrestored"));
        await sharp(photo);
        expect(canvas.style.visibility).toBe("visible");
        const data = context?.getImageData(
          canvas.width / 2,
          canvas.height / 2,
          1,
          1
        ).data;

        expect(data?.[3]).toBe(255);
      },
    ],
    [
      "reports its context lost",
      async () => {
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
        const canvas = photo.querySelector("canvas");

        if (!canvas) {
          throw new Error("no canvas");
        }

        await visibleImage(photo);

        await expect
          .poll(() => lost.mock.calls.length, { timeout: 3000 })
          .toBeGreaterThan(1);

        await nextFrame();

        return { canvas, photo };
      },
      async () => {},
    ],
  ])(
    "shows the moving image instead of an empty canvas when the canvas %s",
    async (_, arrange, recover) => {
      const { canvas, photo } = await arrange();
      const image = await visibleImage(photo);

      expect(image.style.visibility).toBe("visible");
      expect(canvas.style.visibility).toBe("hidden");
      expect(Object.hasOwn(photo.dataset, "sharp")).toBeFalsy();
      await recover(photo, canvas);
    }
  );

  it("paints the preview without data-sharp when a sharpen job fails, never reuses that frame as sharp and tries again on the next settle", async () => {
    const tilted = await mount(1024, undefined, TILT);
    const tiltedImage = await visibleImage(tilted.photo);

    tilted.cropper.begin("pan");
    const during = tiltedImage.style.willChange;

    tilted.cropper.end();

    await expect
      .poll(() => [tiltedImage.style.willChange, tiltedImage.style.visibility])
      .toStrictEqual(["", "visible"]);

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

    await expect
      .poll(() => [jobs.total(), canvas?.style.visibility], { timeout: 3000 })
      .toStrictEqual([1, "visible"]);

    expect({
      during,
      image: image.style.visibility,
      sharp: Object.hasOwn(photo.dataset, "sharp"),
      willChange: image.style.willChange,
    }).toStrictEqual({
      during: "transform",
      image: "hidden",
      sharp: false,
      willChange: "",
    });

    cropper.begin("pan");
    await nextFrame();
    cropper.end();
    await expect.poll(() => jobs.total(), { timeout: 3000 }).toBe(2);
    cropper.setZoom(1);

    await expect
      .poll(() => [jobs.total(), Object.hasOwn(photo.dataset, "sharp")], {
        timeout: 3000,
      })
      .toStrictEqual([3, false]);

    jobs.heal();
    cropper.begin("pan");
    await nextFrame();
    cropper.end();
    await sharp(photo);
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

  it("does no photo work in a hidden copy until it shows, and copies share one moving image file", async () => {
    const jobs = flights("motion");
    const made = vi.spyOn(URL, "createObjectURL");
    const revoked = vi.spyOn(URL, "revokeObjectURL");

    cleanups.push(() => {
      made.mockRestore();
      revoked.mockRestore();
    });

    const { cropper, photo, viewport } = await mount(1024);
    const hidden = document.createElement("div");
    const copy = document.createElement("div");

    hidden.style.display = "none";
    viewport.append(hidden, copy);
    const stopHidden = bindPhoto(cropper, hidden);
    const stopCopy = bindPhoto(cropper, copy);

    cleanups.unshift(stopHidden);
    await sharp(photo);
    await sharp(copy);

    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });

    expect({
      jobs: jobs.total(),
      sharp: Object.hasOwn(hidden.dataset, "sharp"),
      width: hidden.querySelector("canvas")?.width,
    }).toStrictEqual({ jobs: 1, sharp: false, width: 300 });

    const first = photo.querySelector("img");
    const second = copy.querySelector("img");

    await expect
      .poll(() => Boolean(first?.src) && second?.src === first?.src)
      .toBeTruthy();

    hidden.style.display = "block";
    await sharp(hidden);
    const src = first?.src ?? "";

    stopCopy();
    await nextFrame();

    expect({
      jobs: jobs.total(),
      revoked: revoked.mock.calls.flat().includes(src),
      sameWidth:
        hidden.querySelector("canvas")?.width ===
        photo.querySelector("canvas")?.width,
    }).toStrictEqual({ jobs: 1, revoked: false, sameWidth: true });

    cropper.begin("pan");
    await visibleImage(photo);
    cropper.end();
    attachImage(cropper, null);
    await expect.poll(() => revoked.mock.calls.flat()).toContain(src);

    vi.restoreAllMocks();
    const ops = opsSent();
    const lone = await mount(1024, undefined, undefined, "none");
    const image = lone.photo.querySelector("img");

    lone.cropper.begin("pan");
    lone.cropper.setZoom(1.2);
    await nextFrame();
    lone.cropper.end();
    await expect.poll(() => lone.cropper.getState().settling).toBeFalsy();

    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });

    const early = {
      motion: ops.includes("motion"),
      resample: ops.includes("resample"),
      src: image?.hasAttribute("src"),
    };

    lone.photo.style.display = "block";
    await sharp(lone.photo);
    lone.cropper.begin("pan");
    await visibleImage(lone.photo);
    lone.cropper.end();

    expect({ early, motion: ops.includes("motion") }).toStrictEqual({
      early: { motion: false, resample: false, src: false },
      motion: true,
    });
  });

  it.each<[string, () => Promise<HTMLElement>]>([
    [
      "a hidden copy shows",
      async () => {
        const { cropper, photo } = await mount(
          1024,
          undefined,
          undefined,
          "none"
        );

        await nextFrame();
        cropper.destroy();
        await nextFrame();
        photo.style.display = "block";

        return photo;
      },
    ],
    [
      "the context returns",
      async () => {
        stalled("motion");
        const { cropper, photo } = await mount(1024);

        await sharp(photo);
        const canvas = photo.querySelector("canvas");

        canvas?.dispatchEvent(new Event("contextlost"));
        cropper.destroy();
        canvas?.dispatchEvent(new Event("contextrestored"));

        return photo;
      },
    ],
  ])(
    "frees the photo without a window error when %s after destroy",
    async (_, run) => {
      const errors = watchErrors();
      const photo = await run();

      await expect
        .poll(() => photo.querySelector("canvas")?.width, { timeout: 3000 })
        .toBe(0);

      expect(errors).toStrictEqual([]);
    }
  );
});
