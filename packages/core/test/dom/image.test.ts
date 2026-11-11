import { getEventListeners } from "node:events";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCropper } from "../../src";
import type { Cropper } from "../../src";
import {
  ZrizError,
  attachImage,
  discardImage,
  imageOf,
  loadImage,
} from "../../src/dom";
import { freeImage } from "../../src/dom/free";
import { raster, toZriz } from "../../src/dom/image";
import type { LoadOptions, LoadedImage } from "../../src/dom/image";
import { exportImage } from "../../src/dom/render";
import { withTimeout } from "../../src/dom/turn";
import { noop } from "../cropper-fixture";
import { deferred } from "./deferred";
import { FakeWorker } from "./fake-worker";

vi.mock(import("../../src/dom/source"), () => ({
  assertReadable: () => true,
  fromElement: async (source) => {
    if (source instanceof ImageBitmap) {
      return await Promise.resolve(source);
    }

    throw new TypeError("not a bitmap");
  },
}));

type Realm = "main" | "worker";

const FULL = { height: 3000, width: 4000 };

let made = 0;

type Live = {
  realm: Realm;
};

const open = new Set<Live>();

class FakeBitmap implements Live {
  width: number;
  height: number;
  realm: Realm;

  constructor(width: number, height: number, realm: Realm) {
    this.width = width;
    this.height = height;
    this.realm = realm;
    made += 1;
    open.add(this);
  }

  close(): void {
    open.delete(this);
  }
}

let gate: Promise<void> = Promise.resolve();
let decodes = 0;
let copyFails = false;
let decodeFails = false;

const hold = (): (() => void) => {
  const { promise, resolve } = deferred<undefined>();

  gate = promise;

  return () => {
    resolve(undefined);
  };
};

const live = (realm: Realm): number =>
  [...open].filter((bitmap) => bitmap.realm === realm).length;

type Resize = {
  resizeWidth?: number;
  resizeHeight?: number;
};

const bitmapsIn =
  (realm: Realm) =>
  async (source: unknown, options: Resize = {}): Promise<FakeBitmap> => {
    if (source instanceof Blob) {
      decodes += 1;
      await gate;

      if (decodeFails) {
        throw new Error("cannot decode");
      }

      return new FakeBitmap(FULL.width, FULL.height, realm);
    }

    await Promise.resolve();

    if (copyFails && realm === "worker" && options.resizeWidth === undefined) {
      throw new Error("no memory");
    }

    return new FakeBitmap(
      options.resizeWidth ?? FULL.width,
      options.resizeHeight ?? FULL.height,
      realm
    );
  };

const moved = (transfer: readonly unknown[]): void => {
  for (const bitmap of transfer) {
    if (bitmap instanceof FakeBitmap) {
      bitmap.realm = "main";
    }
  }
};

const stub = (worker: boolean): void => {
  FakeWorker.globals = {
    ImageBitmap: FakeBitmap,
    createImageBitmap: bitmapsIn("worker"),
  };

  FakeWorker.moved = moved;
  vi.stubGlobal("ImageBitmap", FakeBitmap);
  vi.stubGlobal("OffscreenCanvas", Map);
  vi.stubGlobal("Worker", worker ? FakeWorker : undefined);
  vi.stubGlobal("createImageBitmap", bitmapsIn("main"));
};

const reset = (worker: boolean): void => {
  open.clear();
  decodes = 0;
  made = 0;
  decodeFails = false;
  copyFails = false;
  gate = Promise.resolve();
  stub(worker);
};

const JPEG = readFileSync(new URL("../fixtures/orient-1.jpg", import.meta.url));
const PNG = readFileSync(new URL("../fixtures/wide.png", import.meta.url));

const jpeg = (): Blob => new Blob([JPEG], { type: "image/jpeg" });

const pngOf = (width: number, height: number): Blob => {
  const file = Buffer.from(PNG);

  file.writeUInt32BE(width, 16);
  file.writeUInt32BE(height, 20);

  return new Blob([file], { type: "image/png" });
};

const decoding = async (count = 1): Promise<void> => {
  await vi.waitFor(() => {
    expect(decodes).toBe(count);
  });
};

const noneLive = async (): Promise<void> => {
  await vi.waitFor(() => {
    expect(made).toBeGreaterThan(0);
    expect(open.size).toBe(0);
  });
};

const failure = async (work: Promise<unknown>): Promise<unknown> =>
  await work.then(
    () => null,
    (error: unknown) => error
  );

const codeOf = (error: unknown): unknown =>
  error instanceof ZrizError ? error.code : error;

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const outcomeOf = (error: unknown): unknown => {
  if (error === null || error instanceof ZrizError) {
    return codeOf(error);
  }

  return messageOf(error);
};

describe("a load that never reaches attachImage", () => {
  beforeEach(() => {
    reset(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("discardImage frees an unattached photo everywhere, and attachImage then throws no-image", async () => {
    const image = await loadImage(jpeg());

    expect(live("worker")).toBe(1);
    discardImage(image);

    expect(() => {
      attachImage(createCropper(), image);
    }).toThrow(expect.objectContaining({ code: "no-image" }));

    await noneLive();
  });

  it.each([
    [
      "discarded twice",
      (image: LoadedImage) => {
        discardImage(image);
        discardImage(image);
      },
    ],
    [
      "discarded after it left its last cropper",
      (image: LoadedImage) => {
        const cropper = createCropper();

        attachImage(cropper, image);
        attachImage(cropper, null);
        discardImage(image);
      },
    ],
  ])("frees a photo exactly once when %s", async (_name, free) => {
    const image = await loadImage(jpeg());
    const close = vi.spyOn(image.preview, "close");

    free(image);
    expect(close).toHaveBeenCalledOnce();
    await noneLive();
  });

  it("leaves a photo on a cropper alone when asked to discard it", async () => {
    const image = await loadImage(jpeg());
    const cropper = createCropper();

    attachImage(cropper, image);
    discardImage(image);
    expect(live("main")).toBe(1);
    expect(live("worker")).toBe(1);
    attachImage(cropper, null);
    await noneLive();
  });

  it.each([
    [
      "aborted while decoding",
      "aborted",
      async () => {
        const release = hold();
        const controller = new AbortController();
        const load = loadImage(jpeg(), { signal: controller.signal });

        await decoding();
        controller.abort();
        const error = await failure(load);

        release();

        return error;
      },
    ],
    [
      "past the time limit during the decode",
      "timeout",
      async () => {
        const release = hold();
        const error = await failure(loadImage(jpeg(), { timeout: 5 }));

        release();

        return error;
      },
    ],
    [
      "a bitmap source aborted on its way to the worker",
      "aborted",
      async () => {
        const source = await createImageBitmap(jpeg());
        const controller = new AbortController();
        const load = loadImage(source, { signal: controller.signal });

        controller.abort();
        const error = await failure(load);

        source.close();

        return error;
      },
    ],
    [
      "aborted while decoding with no worker",
      "aborted",
      async () => {
        vi.stubGlobal("Worker", undefined);
        vi.resetModules();
        const fresh = await import("../../src/dom");
        const release = hold();
        const controller = new AbortController();
        const load = fresh.loadImage(jpeg(), { signal: controller.signal });

        await decoding();
        controller.abort();
        const error = await failure(load);

        release();

        return error;
      },
    ],
  ])("leaves nothing open for a load %s", async (_name, code, run) => {
    const error = await run();

    expect(error).toMatchObject({ code });
    await noneLive();
  });

  it.each([
    ["with a signal that already fired", false, 0],
    ["cancelled in the same tick", false, 0],
    ["cancelled during the decode", true, 1],
  ])("starts no work for a load %s", async (name, midDecode, started) => {
    const bitmap = await createImageBitmap(jpeg());

    decodes = 0;
    decodeFails = true;
    const release = hold();
    const decode = vi.fn<() => Promise<ImageBitmap>>(
      async () => await Promise.resolve(bitmap)
    );
    const controller = new AbortController();

    if (name === "with a signal that already fired") {
      controller.abort();
    }

    const load = loadImage(jpeg(), { decode, signal: controller.signal });

    if (midDecode) {
      await decoding();
    }

    controller.abort();
    expect(codeOf(await failure(load))).toBe("aborted");
    release();
    await delay(10);
    expect(decodes).toBe(started);
    expect(decode).not.toHaveBeenCalled();
  });

  it("rejects with decode and leaves nothing open when the preview copy fails", async () => {
    copyFails = true;
    const error = await failure(loadImage(jpeg(), { previewEdge: 10 }));

    expect(codeOf(error)).toBe("decode");
    await noneLive();
  });

  it("closes what it made when the worker copy of a caller's bitmap fails, and leaves that bitmap open", async () => {
    const source = await createImageBitmap(jpeg());

    copyFails = true;
    const error = await failure(loadImage(source, { previewEdge: 10 }));

    expect(error).toBeInstanceOf(ZrizError);
    expect([...open]).toStrictEqual([source]);
  });
});

describe("decoding in turn", () => {
  beforeEach(() => {
    reset(true);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await delay(0);
  });

  it("runs three decodes at a time and starts the rest as they end", async () => {
    const release = hold();
    const loads = Array.from(
      { length: 5 },
      async () => await loadImage(jpeg())
    );

    await decoding(3);
    await delay(10);
    expect(decodes).toBe(3);
    release();
    const images = await Promise.all(loads);

    expect(decodes).toBe(5);

    for (const image of images) {
      freeImage(image);
    }

    await noneLive();
  });

  it("keeps a photo waiting for its turn off the clock", async () => {
    const release = hold();
    const running = Array.from(
      { length: 3 },
      async () => await loadImage(jpeg())
    );

    await decoding(3);
    const waiting = loadImage(jpeg(), { timeout: 20 });

    await delay(60);
    release();
    const images = await Promise.all([...running, waiting]);

    expect(images).toHaveLength(4);

    for (const image of images) {
      freeImage(image);
    }

    await noneLive();
  });

  it("an aborted decode keeps its slot until it ends, and a stuck one gives it up at the time limit", async () => {
    let release = hold();
    const controllers = [0, 1, 2].map(() => new AbortController());
    const aborted = controllers.map(
      async ({ signal }) => await failure(loadImage(jpeg(), { signal }))
    );

    await decoding(3);
    const first = loadImage(jpeg());

    for (const controller of controllers) {
      controller.abort();
    }

    await Promise.all(aborted);
    await delay(10);
    expect(decodes).toBe(3);
    release();
    freeImage(await first);
    expect(decodes).toBe(4);

    release = hold();
    const stuck = Array.from(
      { length: 3 },
      async () => await failure(loadImage(jpeg(), { timeout: 10 }))
    );

    await decoding(7);
    const second = loadImage(jpeg());

    await Promise.all(stuck);
    await decoding(8);
    release();
    freeImage(await second);
    await noneLive();
  });
});

describe("the decode function", () => {
  beforeEach(() => {
    reset(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("passes its own error through as it is", async () => {
    decodeFails = true;
    const own = new TypeError("my decoder failed");
    const error = await failure(
      loadImage(jpeg(), {
        decode: async () => await Promise.reject(own),
      })
    );

    expect(error).toBe(own);
  });

  it.each([
    [
      "when the preview copy fails",
      (bitmap: ImageBitmap): LoadOptions => {
        copyFails = true;

        return { decode: async () => await Promise.resolve(bitmap) };
      },
    ],
    [
      "when the load is aborted inside it",
      (bitmap: ImageBitmap): LoadOptions => {
        const controller = new AbortController();

        return {
          decode: async () => {
            controller.abort();

            return await Promise.resolve(bitmap);
          },
          signal: controller.signal,
        };
      },
    ],
  ])("closes its bitmap %s", async (_name, options) => {
    const bitmap = await createImageBitmap(jpeg());

    decodeFails = true;
    const error = await failure(loadImage(jpeg(), options(bitmap)));

    expect(error).toBeInstanceOf(ZrizError);
    await noneLive();
  });
});

describe("failures come back typed", () => {
  beforeEach(() => {
    reset(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports a file the browser cannot read as a decode error", async () => {
    const unreadable = jpeg();

    vi.spyOn(unreadable, "slice").mockImplementation(() => {
      const part = new Blob();

      vi.spyOn(part, "arrayBuffer").mockRejectedValue(
        new DOMException("gone", "NotReadableError")
      );

      return part;
    });

    const error = await failure(loadImage(unreadable));

    expect(error).toBeInstanceOf(ZrizError);
    expect(codeOf(error)).toBe("decode");
  });

  it("only blames the format when the browser refused the file", () => {
    const heic = "image/heic";

    expect(toZriz(new Error("zriz:undecodable:no"), heic).code).toBe(
      "unsupported-format"
    );

    expect(toZriz(new Error("out of memory"), heic).code).toBe("decode");

    expect(toZriz(new Error("zriz:decode:no 2D canvas"), heic).code).toBe(
      "decode"
    );

    expect(toZriz(new Error("zriz:undecodable:no"), "image/png").code).toBe(
      "decode"
    );
  });
});

const fetchSignal = (spy: { mock: { calls: unknown[][] } }): unknown => {
  const init = spy.mock.calls[0]?.[1];

  return typeof init === "object" && init !== null && "signal" in init
    ? init.signal
    : null;
};

const wasAborted = (signal: unknown): boolean =>
  signal instanceof AbortSignal && signal.aborted;

describe("fetching a url", () => {
  beforeEach(() => {
    reset(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stops the download at the time limit, and a file that arrives later starts no decode", async () => {
    const { promise, resolve } = deferred<Response>();
    const fetched = vi.fn<
      (url: string, init: RequestInit) => Promise<Response>
    >(async () => await promise);

    vi.stubGlobal("fetch", fetched);
    const error = await failure(loadImage("/late.jpg", { timeout: 5 }));

    expect(codeOf(error)).toBe("timeout");
    expect(wasAborted(fetchSignal(fetched))).toBeTruthy();
    resolve(new Response(jpeg()));
    await delay(20);
    expect(decodes).toBe(0);
  });

  it("stops the body of an error response", async () => {
    const fetched = vi.fn<() => Promise<Response>>(
      async () => await Promise.resolve(new Response("nope", { status: 500 }))
    );

    vi.stubGlobal("fetch", fetched);
    expect(codeOf(await failure(loadImage("/gone.jpg")))).toBe("decode");
    expect(wasAborted(fetchSignal(fetched))).toBeTruthy();
  });

  it("leaves the query and hash out of the message", async () => {
    vi.stubGlobal(
      "fetch",
      async () => await Promise.resolve(new Response("", { status: 403 }))
    );

    const error = await failure(
      loadImage("https://cdn.example.com/p.jpg?key=hidden#part")
    );

    expect(messageOf(error)).toBe(
      "zriz: 403 for https://cdn.example.com/p.jpg"
    );
  });

  it("reports a blocked remote url as cross-origin", async () => {
    vi.stubGlobal(
      "fetch",
      async () => await Promise.reject(new TypeError("blocked"))
    );

    const error = await failure(loadImage("https://cdn.example.com/p.jpg"));

    expect(codeOf(error)).toBe("cross-origin");
  });
});

const { promise: never } = deferred<never>();

const freshDom = async () => {
  vi.resetModules();

  return await import("../../src/dom");
};

const streamed = (
  signal: AbortSignal | null | undefined,
  type = "image/jpeg"
) => {
  let sink: ReadableStreamDefaultController<Uint8Array> | null = null;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      sink = controller;
    },
  });

  signal?.addEventListener("abort", () => {
    sink?.error(new DOMException("stopped", "AbortError"));
  });

  return {
    close: () => {
      sink?.close();
    },
    response: new Response(body, { headers: { "content-type": type } }),
    send: (bytes: Uint8Array) => {
      sink?.enqueue(bytes);
    },
  };
};

type Download = ReturnType<typeof streamed> & { url: string };

const downloads = () => {
  const started: Download[] = [];

  vi.stubGlobal(
    "fetch",
    async (url: string, init: RequestInit): Promise<Response> => {
      const download = { ...streamed(init.signal), url };

      started.push(download);

      return await Promise.resolve(download.response);
    }
  );

  return started;
};

const finish = (download: Download | undefined): void => {
  download?.send(JPEG);
  download?.close();
};

describe("the download clock", () => {
  beforeEach(() => {
    reset(false);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("lets a slow download run past the limit while bytes keep arriving", async () => {
    const started = downloads();
    const { loadImage: load } = await freshDom();
    const run = load("/slow.jpg");

    await vi.advanceTimersByTimeAsync(0);

    for (let second = 0; second < 60; second += 10) {
      started[0]?.send(JPEG.subarray(0, 0 + 1));
      await vi.advanceTimersByTimeAsync(10_000);
    }

    started[0]?.send(JPEG.subarray(1));
    started[0]?.close();
    await vi.advanceTimersByTimeAsync(0);
    await expect(run).resolves.toHaveProperty("width", FULL.width);
  });

  it("times out once no byte arrives for the limit", async () => {
    const started = downloads();
    const { loadImage: load } = await freshDom();
    const settled = vi.fn<(error: unknown) => void>();
    const run = failure(load("/stuck.jpg"));

    void run.then(settled);
    await vi.advanceTimersByTimeAsync(10_000);
    started[0]?.send(JPEG.subarray(0, 10));
    await vi.advanceTimersByTimeAsync(14_999);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(run).resolves.toHaveProperty("code", "timeout");
  });

  it("runs six downloads at a time, and the next starts when one ends or one hangs to the limit", async () => {
    const started = downloads();
    const { loadImage: load } = await freshDom();
    const first = Array.from(
      { length: 7 },
      async (_, i) => await failure(load(`/${i}.jpg`))
    );

    await vi.advanceTimersByTimeAsync(0);
    const counts = [started.length];

    finish(started[0]);
    await vi.advanceTimersByTimeAsync(0);
    counts.push(started.length);
    await expect(first[0]).resolves.toBeNull();
    const healthy = load("/healthy.jpg");

    await vi.advanceTimersByTimeAsync(14_999);
    counts.push(started.length);
    expect(counts).toStrictEqual([6, 7, 7]);
    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(started.at(-1)?.url).toBe("/healthy.jpg");
    finish(started.at(-1));
    await vi.advanceTimersByTimeAsync(0);
    await expect(healthy).resolves.toHaveProperty("width", FULL.width);
    await Promise.all(first);
  });

  it("does not count the wait for a download slot against the limit", async () => {
    const started = downloads();
    const { loadImage: load } = await freshDom();
    const settled = vi.fn<(error: unknown) => void>();
    const first = Array.from(
      { length: 6 },
      async (_, i) => await failure(load(`/${i}.jpg`))
    );
    const waiting = failure(load("/last.jpg"));

    void waiting.then(settled);

    for (let second = 0; second < 60; second += 10) {
      for (const download of started) {
        download.send(JPEG.subarray(0, 1));
      }

      await vi.advanceTimersByTimeAsync(10_000);
    }

    expect(started).toHaveLength(6);
    expect(settled).not.toHaveBeenCalled();
    finish(started[0]);
    await vi.advanceTimersByTimeAsync(0);
    expect(started).toHaveLength(7);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(waiting).resolves.toHaveProperty("code", "timeout");
    await Promise.all(first);
  });
});

describe("the pixel limit", () => {
  beforeEach(() => {
    reset(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    [16_383, 16_383, undefined, null],
    [16_384, 16_383, undefined, "too-large"],
    [100, 100, 9999, "too-large"],
    [30_000, 30_000, Number.POSITIVE_INFINITY, null],
  ])(
    "for a %dx%d photo with maxPixels %s gives %s",
    async (width, height, maxPixels, code) => {
      const error = await failure(
        loadImage(pngOf(width, height), { maxPixels }).then((image) => {
          image.preview.close();

          return null;
        })
      );

      expect([error === null ? null : codeOf(error), decodes]).toStrictEqual([
        code,
        code === null ? 1 : 0,
      ]);
    }
  );

  it("does not offer a file over the limit to the decode function", async () => {
    const decode = vi.fn<(blob: Blob) => Promise<ImageBitmap>>();
    const error = await failure(loadImage(pngOf(30_000, 30_000), { decode }));

    expect(codeOf(error)).toBe("too-large");
    expect(decode).not.toHaveBeenCalled();
  });

  it("refuses what a decode function returns over the limit and closes it", async () => {
    decodeFails = true;
    const bitmap = new FakeBitmap(100, 100, "main");
    const close = vi.spyOn(bitmap, "close");
    const error = await failure(
      loadImage(new Blob([Uint8Array.of(0)]), {
        decode: async () => await Promise.resolve(bitmap),
        maxPixels: 9999,
      })
    );

    expect(codeOf(error)).toBe("too-large");
    expect(close).toHaveBeenCalledOnce();
  });
});

describe("the time limit", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([Number.POSITIVE_INFINITY, 2 ** 31, 1e12])(
    "does not fire at once for %d",
    async (timeout) => {
      const result = await Promise.race([
        withTimeout(never, timeout, undefined).catch(() => "fired"),
        delay(20, "waiting"),
      ]);

      expect(result).toBe("waiting");
    }
  );

  it("starts again when the page was suspended past the limit", async () => {
    let now = 0;
    let fire = noop;

    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("clearTimeout", () => null);

    vi.stubGlobal("setTimeout", (run: () => void) => {
      fire = run;

      return 0;
    });

    const seen: unknown[] = [];

    const watch = async (): Promise<void> => {
      seen.push(codeOf(await failure(withTimeout(never, 1000, undefined))));
    };

    void watch();
    now = 18_000;
    fire();
    await Promise.resolve();
    expect(seen).toStrictEqual([]);
    now = 19_000;
    fire();

    await vi.waitFor(() => {
      expect(seen).toStrictEqual(["timeout"]);
    });
  });
});

describe("the preview edge", () => {
  beforeEach(() => {
    reset(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    [0, 2560],
    [-5, 2560],
    [Number.NaN, 2560],
    [Number.POSITIVE_INFINITY, FULL.width],
  ])("for %d gives a preview %d wide", async (previewEdge, width) => {
    const { preview } = await loadImage(jpeg(), { previewEdge });

    expect(preview.width).toBe(width);
  });
});

const ascii = (text: string): number[] =>
  Array.from(text, (char) => char.codePointAt(0) ?? 0);

const uint32 = (value: number): number[] => [
  0,
  0,
  Math.floor(value / 256),
  value % 256,
];

const pngChunk = (type: string, length: number): number[] => [
  ...uint32(length),
  ...ascii(type),
  ...Array.from({ length: length + 4 }, () => 0),
];

const png = (...chunks: number[][]): Uint8Array =>
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, ...chunks.flat()]);

const webp = (flags: number): Uint8Array =>
  new Uint8Array([
    ...ascii("RIFF"),
    0,
    0,
    0,
    0,
    ...ascii("WEBPVP8X"),
    10,
    0,
    0,
    0,
    flags,
    0,
    0,
    0,
  ]);

const ftyp = (major: string, ...compatible: string[]): Uint8Array =>
  new Uint8Array([
    ...uint32(16 + compatible.length * 4),
    ...ascii("ftyp"),
    ...ascii(major),
    0,
    0,
    0,
    0,
    ...compatible.flatMap(ascii),
  ]);

describe("reading the format", () => {
  it.each([
    [
      "an animation chunk past a large color profile",
      png(pngChunk("IHDR", 13), pngChunk("iCCP", 400), pngChunk("acTL", 8)),
      { animated: true },
    ],
    [
      "a png's text that spells acTL",
      png(pngChunk("IHDR", 13), [
        ...uint32(4),
        ...ascii("tEXtacTL"),
        0,
        0,
        0,
        0,
      ]),
      { animated: false },
    ],
    [
      "an animation chunk after the image data",
      png(pngChunk("IDAT", 13), pngChunk("acTL", 8)),
      { animated: false },
    ],
    ["an animated webp", webp(0x22), { animated: true, mime: "image/webp" }],
    ["a still webp", webp(0x20), { animated: false, mime: "image/webp" }],
  ])("reads %s", (_name, bytes, expected) => {
    expect(raster(bytes)).toMatchObject(expected);
  });

  it.each<[string[], Partial<ReturnType<typeof raster>>]>([
    [["mif1", "mif1", "miaf", "MA1A", "MA1B", "avif"], { mime: "image/avif" }],
    [["avis", "avif"], { animated: true, mime: "image/avif" }],
    ...["heic", "heix", "heim", "heis", "hevm", "hevs", "hevx", "mif1"].map(
      (brand): [string[], Partial<ReturnType<typeof raster>>] => [
        [brand],
        { mime: "image/heic" },
      ]
    ),
    ...["hevc", "hevx", "hevm", "hevs", "msf1"].map(
      (brand): [string[], Partial<ReturnType<typeof raster>>] => [
        [brand],
        { animated: true },
      ]
    ),
    [["xxav", "ifxx"], { mime: null }],
  ])("reads the brands %j as %j", (brands, expected) => {
    const [major = "", ...compatible] = brands;

    expect(raster(ftyp(major, ...compatible))).toMatchObject(expected);
  });
});

const heic = (): LoadedImage => ({
  animated: false,
  height: 40,
  id: 1,
  mime: "image/heic",
  preview: new FakeBitmap(40, 40, "main"),
  source: jpeg(),
  width: 40,
});

const listeners = (signal: AbortSignal): number =>
  getEventListeners(signal, "abort").length;

describe("limits a caller branches on", () => {
  beforeEach(() => {
    reset(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("rejects a load past 15 s by default", async () => {
    gate = new Promise(noop);
    vi.useFakeTimers();
    const settled = vi.fn<(error: unknown) => void>();
    const load = failure(loadImage(jpeg()));

    void load.then(settled);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(codeOf(await load)).toBe("timeout");
  });

  it.each([
    [
      "the work wins",
      () => ({
        signal: new AbortController().signal,
        work: Promise.resolve(1),
      }),
      null,
    ],
    [
      "the work fails",
      () => ({
        signal: new AbortController().signal,
        work: Promise.reject(new Error("no")),
      }),
      "no",
    ],
    [
      "an aborted signal wins",
      () => {
        const controller = new AbortController();

        queueMicrotask(() => {
          controller.abort();
        });

        return { signal: controller.signal, work: never };
      },
      "aborted",
    ],
  ])("clears its timer and listener when %s", async (_name, race, outcome) => {
    vi.useFakeTimers();
    const { signal, work } = race();
    const error = await failure(withTimeout(work, 1000, signal));

    expect(outcomeOf(error)).toBe(outcome);
    expect(vi.getTimerCount()).toBe(0);
    expect(listeners(signal)).toBe(0);
  });

  it("reports a heic export aborted mid render as aborted", async () => {
    gate = new Promise(noop);
    const controller = new AbortController();
    const image = heic();
    const run = failure(
      exportImage(createCropper({ image }), image, {
        signal: controller.signal,
      })
    );

    controller.abort();
    expect(codeOf(await run)).toBe("aborted");
  });

  it("reports a heic export past 30 s as timeout", async () => {
    gate = new Promise(noop);
    vi.useFakeTimers();
    const image = heic();
    const settled = vi.fn<(error: unknown) => void>();
    const run = failure(exportImage(createCropper({ image }), image));

    void run.then(settled);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(codeOf(await run)).toBe("timeout");
  });
});

const hooked = async (full: FakeBitmap, options: LoadOptions = {}) =>
  await loadImage(jpeg(), {
    decode: async () => await Promise.resolve(full),
    previewEdge: 100,
    ...options,
  });

const bitmap = (width = 400, height = 300): FakeBitmap =>
  new FakeBitmap(width, height, "main");

describe("releasing a separate source bitmap", () => {
  beforeEach(() => {
    reset(false);
    decodeFails = true;

    vi.stubGlobal("OffscreenCanvas", () => ({
      getContext: () => ({
        drawImage: noop,
        getImageData: () => ({ data: [1] }),
      }),
    }));
  });

  afterEach(() => {
    decodeFails = false;
    vi.unstubAllGlobals();
  });

  it("keeps a photo while a cropper holds it and closes source and preview once it leaves", async () => {
    const first = bitmap();
    const second = bitmap(800, 600);
    const old = await hooked(first);
    const next = await hooked(second);
    const cropper = createCropper();

    expect(old.source).toBe(first);
    expect(old.preview).not.toBe(first);
    attachImage(cropper, old);
    attachImage(cropper, old);
    const kept = open.has(first);

    attachImage(cropper, next);

    expect([kept, open.has(first), open.has(second)]).toStrictEqual([
      true,
      false,
      true,
    ]);

    attachImage(cropper, null);
    expect(open.has(second)).toBeFalsy();
    await noneLive();
  });

  it.each([
    [
      "the photo leaves its cropper",
      async (full: FakeBitmap) => {
        const image = await loadImage(full, { previewEdge: 100 });
        const close = vi.spyOn(image.preview, "close");
        const cropper = createCropper();

        expect(image.preview).not.toBe(full);
        attachImage(cropper, image);
        attachImage(cropper, null);
        expect(close).toHaveBeenCalledOnce();
      },
    ],
    [
      "the load aborts",
      async (full: FakeBitmap) => {
        const error = await failure(
          loadImage(full, { signal: AbortSignal.abort() })
        );

        expect(codeOf(error)).toBe("aborted");
      },
    ],
    [
      "the load is discarded",
      async (full: FakeBitmap) => {
        discardImage(await loadImage(full, { previewEdge: 100 }));
      },
    ],
  ])("leaves a bitmap the caller passed open when %s", async (_name, run) => {
    const full = bitmap();

    await run(full);
    expect(open.has(full)).toBeTruthy();
    full.close();
    await noneLive();
  });
});

const photo = async () => {
  const image = await loadImage(jpeg());

  return { close: vi.spyOn(image.preview, "close"), image };
};

describe("a photo shared by croppers", () => {
  beforeEach(() => {
    reset(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("frees a photo when its last cropper is destroyed", async () => {
    const { close, image } = await photo();
    const cropper = createCropper();

    attachImage(cropper, image);
    cropper.destroy();
    expect(close).toHaveBeenCalledOnce();
    expect(imageOf(cropper)).toBeNull();
    attachImage(cropper, null);

    expect(() => {
      attachImage(createCropper(), image);
    }).toThrow(ZrizError);

    await noneLive();
  });

  it("frees a photo attached to a destroyed cropper", async () => {
    const empty = createCropper();
    const early = await photo();

    empty.destroy();
    attachImage(empty, early.image);
    expect(imageOf(empty)).toBeNull();
    expect(early.close).toHaveBeenCalledOnce();
    const held = createCropper();
    const late = await photo();
    const first = await photo();

    attachImage(held, first.image);
    held.destroy();
    attachImage(held, late.image);
    expect(imageOf(held)).toBeNull();
    expect(late.close).toHaveBeenCalledOnce();
    await noneLive();
  });

  it.each([
    [
      "one of two croppers is destroyed",
      (image: LoadedImage, one: Cropper, two: Cropper) => {
        attachImage(one, image);
        attachImage(two, image);
        one.destroy();
      },
    ],
    [
      "a destroyed cropper detached it first",
      (image: LoadedImage, one: Cropper, two: Cropper) => {
        attachImage(one, image);
        attachImage(two, image);
        attachImage(one, null);
        one.destroy();
      },
    ],
    [
      "the other cropper attaches it again and leaves",
      (image: LoadedImage, one: Cropper, two: Cropper) => {
        attachImage(one, image);
        attachImage(two, image);
        attachImage(one, image);
        attachImage(one, null);
      },
    ],
  ])(
    "keeps a photo open while another cropper shows it when %s",
    async (_name, share) => {
      const { close, image } = await photo();
      const one = createCropper();
      const two = createCropper();

      share(image, one, two);
      expect(close).not.toHaveBeenCalled();
      expect(imageOf(two)).toBe(image);
      attachImage(two, null);
      expect(close).toHaveBeenCalledOnce();
      await noneLive();
    }
  );

  it("refuses a freed photo and leaves the current one in place", async () => {
    const first = await photo();
    const second = await photo();
    const cropper = createCropper();

    attachImage(cropper, first.image);
    attachImage(cropper, second.image);
    expect(first.close).toHaveBeenCalledOnce();

    expect(() => {
      attachImage(cropper, first.image);
    }).toThrow(ZrizError);

    expect(imageOf(cropper)).toBe(second.image);
    expect(second.close).not.toHaveBeenCalled();
    attachImage(cropper, null);
    await noneLive();
  });
});
