import { setTimeout as delay } from "node:timers/promises";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCropper } from "../../src";
import type { Cropper, Size } from "../../src";
import { ZrizError } from "../../src/dom/error";
import { exportImage } from "../../src/dom/export";
import type { ExportResult } from "../../src/dom/image";
import { renderKernel } from "../../src/dom/render-kernel";
import { via } from "../../src/dom/worker";
import { loadedImage } from "../cropper-fixture";
import { fakeClock } from "../fake-clock";
import { sourceToOutputMatrix } from "../geometry/oracles";
import { deferred } from "./deferred";

vi.mock(import("../../src/dom/worker"), { spy: true });
vi.mock(import("../../src/dom/media"), { spy: true });

const isBitmap = (value: unknown): value is ImageBitmap =>
  typeof value === "object" && value !== null && "width" in value;

const bitmapOf = (width: number, height: number): ImageBitmap => {
  const image = { height, width };

  if (!isBitmap(image)) {
    throw new Error("not a bitmap");
  }

  return image;
};

const run = async (
  width: number,
  height: number,
  maxSize: Size
): Promise<ExportResult> => {
  const image = { height, width };

  if (!isBitmap(image)) {
    throw new Error("not a bitmap");
  }

  const cropper = createCropper({ clock: fakeClock().clock, image });
  const loaded = loadedImage({
    height,
    mime: "image/jpeg",
    preview: image,
    source: image,
    width,
  });

  return await exportImage(cropper, loaded, { maxSize });
};

describe("exportImage size", () => {
  beforeEach(() => {
    vi.mocked(via).mockReset();

    vi.mocked(via).mockResolvedValue({
      blob: new Blob(["x"], { type: "image/jpeg" }),
      index: 0,
    });
  });

  it.each<[string, number, number, Size, [number, number, boolean]]>([
    [
      "a box it fits into",
      900,
      600,
      { height: 100, width: 100 },
      [100, 66, true],
    ],
    [
      "the one pixel floor",
      1,
      3000,
      { height: 100, width: 100 },
      [1, 3000, false],
    ],
    [
      "a box with no number",
      900,
      600,
      { height: 100, width: Number.NaN },
      [900, 600, false],
    ],
    [
      "a box of zero width",
      900,
      600,
      { height: 100, width: 0 },
      [900, 600, false],
    ],
    [
      "a box of negative height",
      900,
      600,
      { height: -1, width: 100 },
      [900, 600, false],
    ],
  ])(
    "sizes the output for %s and reports scaled from the real size",
    async (_name, width, height, maxSize, expected) => {
      const out = await run(width, height, maxSize);

      expect([out.width, out.height, out.scaled]).toStrictEqual(expected);
    }
  );
});

type Limits = {
  blank?: number;
  noContext?: number;
  drawThrows?: number;
  encodeThrows?: number;
  encodeError?: string;
  loseAfterDraws?: number;
};

type Area = {
  width: number;
  height: number;
};

type Draw = {
  from: unknown;
  args: number[];
  transform: number[];
  points: [number, number][];
  operation: string;
};

const noop = (): void => undefined;

const fakeCanvas = (limits: Limits = {}): { draws: Draw[]; made: Area[] } => {
  const made: Area[] = [];
  const draws: Draw[] = [];
  let lost: Area | undefined;

  const gone = (canvas: Area): boolean => {
    if (draws.length >= (limits.loseAfterDraws ?? Number.POSITIVE_INFINITY)) {
      lost ??= canvas;
    }

    return lost === canvas;
  };

  const over = (canvas: Area, limit?: number): boolean =>
    limit !== undefined && canvas.width * canvas.height > limit;

  vi.stubGlobal(
    "OffscreenCanvas",
    class {
      height: number;
      width: number;
      constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        made.push(this);
      }
      getContext(): object | null {
        if (over(this, limits.noContext)) {
          return null;
        }

        let transform = [1, 0, 0, 1, 0, 0];
        let points: [number, number][] = [];

        const add = (x: number, y: number): void => {
          points.push([x, y]);
        };

        const context = {
          beginPath: () => {
            points = [];
          },
          canvas: this,
          clearRect: noop,
          clip: noop,
          closePath: noop,
          drawImage: (from: unknown, ...args: number[]) => {
            if (over(this, limits.drawThrows)) {
              throw new Error("draw failed");
            }

            draws.push({
              args,
              from,
              operation: context.globalCompositeOperation,
              points,
              transform,
            });
          },
          ellipse: noop,
          fill: noop,
          fillRect: noop,
          getImageData: () => ({
            data: [1, 2, 3, over(this, limits.blank) || gone(this) ? 0 : 255],
          }),
          globalCompositeOperation: "source-over",
          lineTo: add,
          moveTo: add,
          putImageData: noop,
          restore: noop,
          save: noop,
          setTransform: (...next: number[]) => {
            transform = next;
          },
        };

        return context;
      }
      async convertToBlob({ type }: { type: string }): Promise<Blob> {
        await Promise.resolve();

        if (over(this, limits.encodeThrows)) {
          throw new DOMException(
            "encoding failed",
            limits.encodeError ?? "EncodingError"
          );
        }

        return new Blob(["x"], { type });
      }
    }
  );

  vi.stubGlobal("ImageBitmap", Object);

  return { draws, made };
};

const painted = async (
  width: number,
  height: number,
  options: { maxSize?: Size; type?: "image/jpeg" | "image/webp" } = {},
  perspective?: { horizontal: number; vertical: number },
  file?: Blob
): Promise<{ cropper: Cropper; result: ExportResult }> => {
  vi.mocked(via).mockReset();

  vi.mocked(via).mockImplementation(async (_target, _op, args) => {
    const kernel = renderKernel();
    const reply: unknown = await Reflect.apply(kernel.render, kernel, [
      ...args,
    ]);

    return reply;
  });

  const image = { height, width };

  if (!isBitmap(image)) {
    throw new Error("not a bitmap");
  }

  const cropper = createCropper({ clock: fakeClock().clock, image });

  if (perspective) {
    cropper.setValue({ perspective });
  }

  const loaded = loadedImage({
    height,
    mime: "image/jpeg",
    preview: image,
    source: file ?? image,
    width,
  });
  const result = await exportImage(cropper, loaded, {
    type: "image/jpeg",
    ...options,
  });

  return { cropper, result };
};

const invert3 = (m: readonly number[]): number[] => {
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, h = 0, i = 1] = m;
  const A = e * i - f * h;
  const B = f * g - d * i;
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;

  return [
    A / det,
    (c * h - b * i) / det,
    (b * f - c * e) / det,
    B / det,
    (a * i - c * g) / det,
    (c * d - a * f) / det,
    C / det,
    (b * g - a * h) / det,
    (a * e - b * d) / det,
  ];
};

const apply = (m: number[], x: number, y: number): [number, number] => {
  const w = (m[6] ?? 0) * x + (m[7] ?? 0) * y + (m[8] ?? 1);

  return [
    ((m[0] ?? 0) * x + (m[1] ?? 0) * y + (m[2] ?? 0)) / w,
    ((m[3] ?? 0) * x + (m[4] ?? 0) * y + (m[5] ?? 0)) / w,
  ];
};

const meshOf = (draws: Draw[]): Draw[] =>
  draws.filter((draw) => draw.operation === "lighter");

const worstError = async (
  width: number,
  height: number,
  vertical: number,
  horizontal = 0
): Promise<number> => {
  const { draws } = fakeCanvas();
  const { cropper, result } = await painted(
    width,
    height,
    {},
    { horizontal, vertical }
  );
  const state = cropper.getCropState();

  if (!state) {
    throw new Error("no state");
  }

  const truth = invert3(
    sourceToOutputMatrix(state, {
      crop: state.crop,
      height: result.height,
      scale: 1,
      width: result.width,
    })
  );
  const triangles = meshOf(draws);
  let worst = 0;

  for (const { points, transform } of triangles) {
    const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = transform;
    const back = invert3([a, c, e, b, d, f, 0, 0, 1]);
    const [p = [0, 0], q = [0, 0], r = [0, 0]] = points;

    for (let u = 0; u <= 6; u += 1) {
      for (let v = 0; v <= 6 - u; v += 1) {
        const s = 1 - (u + v) / 6;
        const x = s * p[0] + (u / 6) * q[0] + (v / 6) * r[0];
        const y = s * p[1] + (u / 6) * q[1] + (v / 6) * r[1];
        const [dx, dy] = apply(back, x, y);
        const [tx, ty] = apply(truth, x, y);

        worst = Math.max(worst, Math.hypot(dx - tx, dy - ty));
      }
    }
  }

  return worst;
};

const allFreed = (made: Area[]): boolean =>
  made.every((canvas) => canvas.width === 0);

describe("export retry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each<[string, Limits, object]>([
    ["the first size", {}, { scaled: false, width: 8000 }],
    ["a blank canvas", { blank: 20_000_000 }, { scaled: true, width: 4000 }],
    ["no 2d context", { noContext: 20_000_000 }, { scaled: true, width: 4000 }],
    [
      "an encoder failure",
      { encodeThrows: 20_000_000 },
      { scaled: true, width: 4000 },
    ],
    [
      "a throwing draw",
      { drawThrows: 20_000_000 },
      { scaled: true, width: 4000 },
    ],
    [
      "a blank limit under a quarter",
      { blank: 5_000_000 },
      { scaled: true, width: 2000 },
    ],
    ["a blank canvas at every size", { blank: 0 }, { code: "blank" }],
    ["no 2d context at every size", { noContext: 0 }, { code: "decode" }],
    [
      "a draw that always throws",
      { drawThrows: 0 },
      { message: "zriz: draw failed" },
    ],
  ])(
    "steps down after %s, frees every canvas and closes the decoded bitmap once",
    async (_name, limits, expected) => {
      const { made } = fakeCanvas(limits);
      const close = vi.fn<() => void>();

      vi.stubGlobal(
        "createImageBitmap",
        async () => await Promise.resolve({ close, height: 6000, width: 8000 })
      );

      const outcome: unknown = await painted(
        8000,
        6000,
        {},
        undefined,
        new Blob(["x"], { type: "image/jpeg" })
      ).then(
        ({ result }) => result,
        (error: unknown) => error
      );

      expect(outcome).toMatchObject(expected);
      expect(made.length).toBeGreaterThan(0);
      expect(allFreed(made)).toBeTruthy();
      expect(close).toHaveBeenCalledOnce();
    }
  );

  it("tries one size when the canvas is tainted", async () => {
    const { made } = fakeCanvas({
      encodeError: "SecurityError",
      encodeThrows: 0,
    });
    const error: unknown = await painted(8000, 6000).catch(
      (error_: unknown) => error_
    );

    expect(error).toBeInstanceOf(ZrizError);
    expect(error).toHaveProperty("code", "decode");
    expect(made).toHaveLength(1);
  });
});

describe("export step down", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stops halving at a canvas the browser cannot draw on", async () => {
    fakeCanvas({ blank: 1_000_000 });
    const { result } = await painted(4000, 3000, {
      maxSize: { height: 512, width: 512 },
    });

    expect(result.width).toBe(512);
  });
});

describe("export edge limits", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each<[string, number, number, "image/jpeg" | "image/webp", object]>([
    [
      "a wide webp",
      20_000,
      100,
      "image/webp",
      { height: 81, scaled: true, width: 16_383 },
    ],
    [
      "a tall webp",
      100,
      20_000,
      "image/webp",
      { height: 16_383, scaled: true, width: 81 },
    ],
    [
      "a webp at the limit",
      16_383,
      100,
      "image/webp",
      { scaled: false, width: 16_383 },
    ],
    ["a jpeg", 70_000, 10, "image/jpeg", { scaled: true, width: 65_500 }],
  ])("caps %s at its long edge", async (_name, w, h, type, expected) => {
    fakeCanvas();
    const { result } = await painted(w, h, { type });

    expect(result).toMatchObject(expected);
  });
});

describe("export mesh", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    [8064, 6048, 30, 0, 1],
    [8064, 6048, 30, 30, 0.5],
    [8064, 6048, -30, 30, 0.5],
    [800, 600, 30, 0, 0.5],
  ])(
    "stays within a source pixel on a %i by %i photo at vertical %i, horizontal %i",
    async (width, height, vertical, horizontal, limit) => {
      await expect(
        worstError(width, height, vertical, horizontal)
      ).resolves.toBeLessThan(limit);
    }
  );

  it("shares exact triangle edges and adds their coverage", async () => {
    const { draws } = fakeCanvas();

    await painted(800, 600, {}, { horizontal: 0, vertical: 15 });
    const edges = new Map<string, number>();

    for (const { points } of meshOf(draws)) {
      for (const [i, point] of points.entries()) {
        const next = points[(i + 1) % points.length];
        const edge = [String(point), String(next)].toSorted().join(" ");

        edges.set(edge, (edges.get(edge) ?? 0) + 1);
      }
    }

    expect(Math.max(...edges.values())).toBe(2);

    expect(
      [...edges.values()].filter((count) => count === 2).length
    ).toBeGreaterThan(1000);
  });
});

describe("a mesh source", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("draws the triangles from a canvas copy of a bitmap", async () => {
    const { draws, made } = fakeCanvas();

    await painted(800, 600, {}, { horizontal: 0, vertical: 15 });
    const [copy] = draws;

    expect(copy?.from).toMatchObject({ height: 600, width: 800 });
    expect(copy?.operation).not.toBe("lighter");
    const sources = new Set(meshOf(draws).map((draw) => draw.from));

    expect(sources.size).toBe(1);
    expect(made).toContain([...sources][0]);
    expect(allFreed(made)).toBeTruthy();
  });

  it("steps down when the canvas is lost during the mesh", async () => {
    const { made } = fakeCanvas({ loseAfterDraws: 100 });
    const { result } = await painted(
      8000,
      6000,
      {},
      { horizontal: 0, vertical: 15 }
    );

    expect(result.scaled).toBeTruthy();
    expect(allFreed(made)).toBeTruthy();
  });
});

const deferredReply = () => {
  const replies: ((value?: unknown) => void)[] = [];

  const answer = async (): Promise<unknown> => {
    const { promise, resolve } = deferred<unknown>();

    replies.push(resolve);

    return await promise;
  };

  return { answer, replies };
};

const reply = { blob: new Blob(["x"], { type: "image/jpeg" }), index: 0 };

const inTurn = async () => {
  vi.resetModules();
  const worker = await import("../../src/dom/worker");
  const media = await import("../../src/dom/media");
  const { exportImage: start } = await import("../../src/dom/export");

  await import("../../src/dom/render");
  const { answer, replies } = deferredReply();

  vi.mocked(worker.via).mockReset();
  vi.mocked(worker.via).mockImplementation(answer);

  const { setTools } = await import("../../src/dom/free");
  const { outputLimit, toZriz } = await import("../../src/dom/image");

  setTools({ ...worker, outputLimit, toZriz });

  const image = bitmapOf(400, 300);
  const cropper = createCropper({ clock: fakeClock().clock, image });
  const loaded = loadedImage({
    height: 300,
    mime: "image/jpeg",
    preview: image,
    source: new Blob(["x"], { type: "image/svg+xml" }),
    width: 400,
  });
  const go = async (
    options: { signal?: AbortSignal; colorSpace?: "display-p3" } = {},
    photo = loaded
  ): Promise<ExportResult> => await start(cropper, photo, options);

  return { go, loaded, media, replies, via: worker.via };
};

const flushed = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0);
};

const codeOf = async (work: Promise<unknown>): Promise<unknown> =>
  await work.then(
    () => "resolved",
    (error: unknown) =>
      error instanceof Error && "code" in error ? error.code : error
  );

describe("exports in turn", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("runs one export at a time, in order", async () => {
    vi.useRealTimers();
    const { go, replies } = await inTurn();
    const all = [go(), go(), go()];

    await vi.waitFor(() => {
      expect(replies).toHaveLength(1);
    });

    replies[0]?.(reply);

    await vi.waitFor(() => {
      expect(replies).toHaveLength(2);
    });

    replies[1]?.(reply);

    await vi.waitFor(() => {
      expect(replies).toHaveLength(3);
    });

    replies[2]?.(reply);
    await expect(Promise.all(all)).resolves.toHaveLength(3);
  });

  it("drops an aborted export from the line at once", async () => {
    vi.useRealTimers();
    const { go, replies, via: posted } = await inTurn();
    const first = go();

    await vi.waitFor(() => {
      expect(replies).toHaveLength(1);
    });

    const controller = new AbortController();
    const second = go({ signal: controller.signal });
    const third = go();

    controller.abort();
    await expect(codeOf(second)).resolves.toBe("aborted");
    replies[0]?.(reply);
    await first;

    await vi.waitFor(() => {
      expect(replies).toHaveLength(2);
    });

    replies[1]?.(reply);
    await third;
    expect(posted).toHaveBeenCalledTimes(2);
  });

  it("holds the next export back until an aborted one has ended", async () => {
    vi.useRealTimers();
    const { go, replies } = await inTurn();
    const controller = new AbortController();
    const first = go({ signal: controller.signal });

    await vi.waitFor(() => {
      expect(replies).toHaveLength(1);
    });

    const second = go();

    controller.abort();
    await expect(codeOf(first)).resolves.toBe("aborted");
    await delay(20);
    expect(replies).toHaveLength(1);
    replies[0]?.(reply);

    await vi.waitFor(() => {
      expect(replies).toHaveLength(2);
    });

    replies[1]?.(reply);
    await second;
  });

  it("lets the next export run once a hung one times out", async () => {
    const { go, replies } = await inTurn();
    const first = codeOf(go());
    const second = go();

    await flushed();
    await vi.advanceTimersByTimeAsync(30_001);
    await expect(first).resolves.toBe("timeout");
    expect(replies).toHaveLength(2);
    replies[1]?.(reply);
    await second;
  });

  it("does not count the wait in line against the time limit", async () => {
    const { go, replies } = await inTurn();
    const first = go();
    const second = codeOf(go());

    await flushed();
    await vi.advanceTimersByTimeAsync(25_000);
    replies[0]?.(reply);
    await first;
    await vi.advanceTimersByTimeAsync(25_000);
    replies[1]?.(reply);
    await expect(second).resolves.toBe("resolved");
  });

  it("exports a larger copy of the attached photo at the plan's size", async () => {
    vi.useRealTimers();
    const { go, loaded, replies, via: posted } = await inTurn();
    const original = { ...loaded, height: 3000, width: 4000 };
    const job = go({}, original);

    await vi.waitFor(() => {
      expect(replies).toHaveLength(1);
    });

    replies[0]?.(reply);
    await expect(job).resolves.toMatchObject({ height: 300, width: 400 });
    expect(posted).toHaveBeenCalledOnce();
  });

  it("rejects as aborted when a bitmap source closed while it waited", async () => {
    vi.useRealTimers();
    const { go, loaded, via: posted } = await inTurn();
    const source = bitmapOf(0, 0);

    await expect(codeOf(go({}, { ...loaded, source }))).resolves.toBe(
      "aborted"
    );

    expect(posted).not.toHaveBeenCalled();
  });
});

const element = {
  naturalHeight: 300,
  naturalWidth: 400,
  removeAttribute: noop,
};

const isElement = (value: unknown): value is HTMLImageElement =>
  value === element;

const shownBlobs = (): Blob[] => {
  const blobs: Blob[] = [];

  fakeCanvas();

  vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
    if (blob instanceof Blob) {
      blobs.push(blob);
    }

    return "blob:x";
  });

  vi.spyOn(URL, "revokeObjectURL").mockImplementation(noop);

  return blobs;
};

const opened = (): HTMLImageElement => {
  if (!isElement(element)) {
    throw new Error("not an element");
  }

  return element;
};

describe("a display-p3 export", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("rejects on abort during the decode and paints nothing after", async () => {
    shownBlobs();
    const { go, media } = await inTurn();
    const { promise, resolve } = deferred<HTMLImageElement>();

    vi.mocked(media.loadElement).mockReturnValue(promise);
    const controller = new AbortController();
    const job = go({ colorSpace: "display-p3", signal: controller.signal });

    await vi.waitFor(() => {
      expect(media.loadElement).toHaveBeenCalledOnce();
    });

    const { draws } = fakeCanvas();

    controller.abort();
    await expect(codeOf(job)).resolves.toBe("aborted");
    resolve(opened());
    await delay(10);
    expect(draws).toHaveLength(0);
  });

  it("times out when the decode never ends", async () => {
    shownBlobs();
    const { go, media } = await inTurn();

    vi.mocked(media.loadElement).mockReturnValue(
      deferred<HTMLImageElement>().promise
    );

    vi.useFakeTimers();
    const job = codeOf(go({ colorSpace: "display-p3" }));

    await vi.advanceTimersByTimeAsync(30_001);
    await expect(job).resolves.toBe("timeout");
  });
});
