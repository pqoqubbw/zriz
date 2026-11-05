import { getEventListeners } from "node:events";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCropper } from "../../src";
import { ZrizError, attachImage, discardImage, loadImage } from "../../src/dom";
import { freeImage, raster, toZriz } from "../../src/dom/image";
import type { LoadOptions, LoadedImage } from "../../src/dom/image";
import { exportImage } from "../../src/dom/render";
import { withTimeout } from "../../src/dom/turn";
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

const noop = (): void => undefined;

const deferred = <T>() => {
  let yes: (value: T) => void = noop;
  let no: (reason: unknown) => void = noop;
  const promise = new Promise<T>((resolve, reject) => {
    yes = resolve;
    no = reject;
  });

  return {
    promise,
    reject: (reason: unknown) => {
      no(reason);
    },
    resolve: (value: T) => {
      yes(value);
    },
  };
};

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

describe("a load that never reaches attachImage", () => {
  beforeEach(() => {
    open.clear();
    decodes = 0;
    made = 0;
    decodeFails = false;
    copyFails = false;
    gate = Promise.resolve();
    stub(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("discards a photo that never reached a cropper, worker copy included", async () => {
    const image = await loadImage(jpeg());

    expect(live("worker")).toBe(1);
    discardImage(image);
    await noneLive();
  });

  it("discards a photo only once", async () => {
    const image = await loadImage(jpeg());
    const close = vi.spyOn(image.preview, "close");

    discardImage(image);
    discardImage(image);
    expect(close).toHaveBeenCalledOnce();
    await noneLive();
  });

  it("refuses to attach a discarded photo", async () => {
    const image = await loadImage(jpeg());

    discardImage(image);

    expect(() => {
      attachImage(createCropper(), image);
    }).toThrow(ZrizError);

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

  it("does not free a photo twice after it left its last cropper", async () => {
    const image = await loadImage(jpeg());
    const close = vi.spyOn(image.preview, "close");
    const cropper = createCropper();

    attachImage(cropper, image);
    attachImage(cropper, null);
    discardImage(image);
    expect(close).toHaveBeenCalledOnce();
    await noneLive();
  });

  it("frees the worker copy when aborted while decoding", async () => {
    const release = hold();
    const controller = new AbortController();
    const load = loadImage(jpeg(), { signal: controller.signal });

    await decoding();
    controller.abort();
    expect(codeOf(await failure(load))).toBe("aborted");
    release();
    await noneLive();
  });

  it("frees the worker copy when the time limit passes during the decode", async () => {
    const release = hold();
    const load = loadImage(jpeg(), { timeout: 5 });

    expect(codeOf(await failure(load))).toBe("timeout");
    release();
    await noneLive();
  });

  it("frees the worker copy of a bitmap source aborted on its way there", async () => {
    const source = await createImageBitmap(jpeg());
    const controller = new AbortController();
    const load = loadImage(source, { signal: controller.signal });

    controller.abort();
    expect(codeOf(await failure(load))).toBe("aborted");
    source.close();
    await noneLive();
  });

  it("frees the main thread copy when no worker exists", async () => {
    vi.stubGlobal("Worker", undefined);
    vi.resetModules();
    const fresh = await import("../../src/dom");
    const release = hold();
    const controller = new AbortController();
    const load = fresh.loadImage(jpeg(), { signal: controller.signal });

    await decoding();
    controller.abort();
    await expect(load).rejects.toMatchObject({ code: "aborted" });
    release();
    await noneLive();
  });

  it("leaves nothing behind after many cancelled loads", async () => {
    const release = hold();
    const loads = Array.from({ length: 5 }, () => {
      const controller = new AbortController();
      const load = loadImage(jpeg(), { signal: controller.signal });

      return { controller, load };
    });

    await decoding(3);

    for (const { controller } of loads) {
      controller.abort();
    }

    const errors = await Promise.all(
      loads.map(async ({ load }) => await failure(load))
    );

    expect(errors.map(codeOf)).toContain("aborted");
    release();
    await noneLive();
  });

  it("keeps a photo that reached the cropper until it leaves", async () => {
    const cropper = createCropper();

    attachImage(cropper, await loadImage(jpeg()));
    expect(live("main")).toBe(1);
    expect(live("worker")).toBe(1);
    attachImage(cropper, null);
    await noneLive();
  });

  it("starts no decode on a signal that already fired", async () => {
    const load = loadImage(jpeg(), { signal: AbortSignal.abort() });

    expect(codeOf(await failure(load))).toBe("aborted");
    await delay(10);
    expect(decodes).toBe(0);
  });

  it("starts no decode for a load cancelled in the same tick", async () => {
    const controller = new AbortController();
    const load = loadImage(jpeg(), { signal: controller.signal });

    controller.abort();
    await failure(load);
    await delay(10);
    expect(decodes).toBe(0);
  });

  it("closes what it made when the worker copy fails, and leaves the caller's bitmap open", async () => {
    const source = await createImageBitmap(jpeg());

    copyFails = true;
    const error = await failure(loadImage(source, { previewEdge: 10 }));

    expect(error).toBeInstanceOf(ZrizError);
    expect([...open]).toStrictEqual([source]);
  });

  it("closes the preview in the worker when its copy fails", async () => {
    copyFails = true;
    const error = await failure(loadImage(jpeg(), { previewEdge: 10 }));

    expect(codeOf(error)).toBe("decode");
    await noneLive();
  });
});

describe("decoding in turn", () => {
  beforeEach(() => {
    open.clear();
    decodes = 0;
    made = 0;
    decodeFails = false;
    copyFails = false;
    gate = Promise.resolve();
    stub(true);
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

  it("starts nothing for a load aborted in the line", async () => {
    const release = hold();
    const running = Array.from(
      { length: 3 },
      async () => await loadImage(jpeg())
    );

    await decoding(3);
    const controller = new AbortController();
    const waiting = loadImage(jpeg(), { signal: controller.signal });

    await delay(5);
    controller.abort();
    expect(codeOf(await failure(waiting))).toBe("aborted");
    release();
    const images = await Promise.all(running);

    expect(decodes).toBe(3);

    for (const image of images) {
      freeImage(image);
    }

    await noneLive();
  });

  it("holds the slot of an aborted decode until that decode ends", async () => {
    const release = hold();
    const controllers = [0, 1, 2].map(() => new AbortController());
    const running = controllers.map(
      async ({ signal }) => await failure(loadImage(jpeg(), { signal }))
    );

    await decoding(3);
    const waiting = loadImage(jpeg());

    for (const controller of controllers) {
      controller.abort();
    }

    await Promise.all(running);
    await delay(10);
    expect(decodes).toBe(3);
    release();
    freeImage(await waiting);
    await noneLive();
  });

  it("gives up the slot of a decode that never ends at the time limit", async () => {
    const release = hold();
    const stuck = Array.from(
      { length: 3 },
      async () => await failure(loadImage(jpeg(), { timeout: 10 }))
    );

    await decoding(3);
    const waiting = loadImage(jpeg());

    await Promise.all(stuck);
    await decoding(4);
    expect(decodes).toBe(4);
    release();
    freeImage(await waiting);
    await noneLive();
  });
});

describe("the decode function", () => {
  beforeEach(() => {
    open.clear();
    decodes = 0;
    made = 0;
    copyFails = false;
    decodeFails = false;
    gate = Promise.resolve();
    stub(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is not called once the load was cancelled", async () => {
    const bitmap = await createImageBitmap(jpeg());

    decodes = 0;
    decodeFails = true;
    const release = hold();
    const decode = vi.fn<() => Promise<ImageBitmap>>(
      async () => await Promise.resolve(bitmap)
    );
    const controller = new AbortController();
    const load = loadImage(jpeg(), { decode, signal: controller.signal });

    await decoding();
    controller.abort();
    await failure(load);
    release();

    await vi.waitFor(() => {
      expect(decodes).toBe(1);
    });

    await delay(10);
    expect(decode).not.toHaveBeenCalled();
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

  it("closes its bitmap when the load fails afterwards", async () => {
    const bitmap = await createImageBitmap(jpeg());

    decodeFails = true;
    copyFails = true;
    const error = await failure(
      loadImage(jpeg(), {
        decode: async () => await Promise.resolve(bitmap),
      })
    );

    expect(error).toBeInstanceOf(ZrizError);
    expect(open.size).toBe(0);
  });
});

describe("failures come back typed", () => {
  beforeEach(() => {
    open.clear();
    decodes = 0;
    made = 0;
    decodeFails = false;
    copyFails = false;
    gate = Promise.resolve();
    stub(true);
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

    expect(toZriz(new Error("out of memory"), heic)).toMatchObject({
      code: "decode",
      message: "zriz: out of memory",
    });

    expect(toZriz(new Error("zriz:decode:no 2D canvas"), heic).code).toBe(
      "decode"
    );

    expect(toZriz(new Error("zriz:undecodable:no"), "image/png").code).toBe(
      "decode"
    );

    expect(toZriz(new Error("zriz:undecodable:no"), heic).message).toContain(
      "damaged"
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
    open.clear();
    decodes = 0;
    made = 0;
    decodeFails = false;
    copyFails = false;
    gate = Promise.resolve();
    stub(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stops the download at the time limit and reports the timeout", async () => {
    const fetched = vi.fn<
      (url: string, init: RequestInit) => Promise<Response>
    >(async (_url, init) => {
      const { promise, reject } = deferred<Response>();

      init.signal?.addEventListener("abort", () => {
        reject(new DOMException("stopped", "AbortError"));
      });

      return await promise;
    });

    vi.stubGlobal("fetch", fetched);
    const error = await failure(loadImage("/slow.jpg", { timeout: 5 }));

    expect(codeOf(error)).toBe("timeout");
    expect(wasAborted(fetchSignal(fetched))).toBeTruthy();
  });

  it("starts no decode for a file that arrives after the limit", async () => {
    const { promise, resolve } = deferred<Response>();

    vi.stubGlobal("fetch", async () => await promise);
    const error = await failure(loadImage("/late.jpg", { timeout: 5 }));

    expect(codeOf(error)).toBe("timeout");
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

  it.each(["data:image/png;base64,AAAA", "blob:http://x/1"])(
    "does not blame the server for %s",
    async (url) => {
      vi.stubGlobal(
        "fetch",
        async () => await Promise.reject(new TypeError("blocked"))
      );

      const error = await failure(loadImage(url));

      expect(codeOf(error)).toBe("cross-origin");
      expect(messageOf(error)).toContain("connect-src");
      expect(messageOf(error)).not.toContain("CORS");
    }
  );

  it("names the policy beside the server for a remote url", async () => {
    vi.stubGlobal(
      "fetch",
      async () => await Promise.reject(new TypeError("blocked"))
    );

    const error = await failure(loadImage("https://cdn.example.com/p.jpg"));

    expect(codeOf(error)).toBe("cross-origin");
    expect(messageOf(error)).toContain("connect-src");
    expect(messageOf(error)).toContain("CORS");
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
    open.clear();
    decodes = 0;
    made = 0;
    decodeFails = false;
    copyFails = false;
    gate = Promise.resolve();
    stub(false);
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

  it("times out when a url never answers with a byte", async () => {
    downloads();
    const { loadImage: load } = await freshDom();
    const run = failure(load("/hung.jpg"));

    await vi.advanceTimersByTimeAsync(15_000);
    await expect(run).resolves.toHaveProperty("code", "timeout");
  });

  it("keeps the type the server declared", async () => {
    const started = downloads();
    const { loadImage: load } = await freshDom();
    const run = load("/photo.jpg");

    await vi.advanceTimersByTimeAsync(0);
    finish(started[0]);
    await vi.advanceTimersByTimeAsync(0);
    const { source } = await run;

    expect(source).toBeInstanceOf(Blob);
    expect(source).toHaveProperty("type", "image/jpeg");
  });

  it("runs six downloads at a time and starts the next as one ends", async () => {
    const started = downloads();
    const { loadImage: load } = await freshDom();
    const runs = Array.from(
      { length: 8 },
      async (_, i) => await load(`/${i}.jpg`)
    );

    await vi.advanceTimersByTimeAsync(0);
    expect(started).toHaveLength(6);
    finish(started[0]);
    await vi.advanceTimersByTimeAsync(0);
    expect(started).toHaveLength(7);
    await runs[0];

    for (const download of started.slice(1)) {
      finish(download);
    }

    await vi.advanceTimersByTimeAsync(0);
    finish(started[7]);
    await vi.advanceTimersByTimeAsync(0);
    await Promise.all(runs);
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

  it("gives the slot of a hung url to the next load at the limit", async () => {
    const started = downloads();
    const { loadImage: load } = await freshDom();
    const hung = Array.from(
      { length: 6 },
      async (_, i) => await failure(load(`/hung-${i}.jpg`))
    );
    const healthy = load("/healthy.jpg");

    await vi.advanceTimersByTimeAsync(14_999);
    expect(started).toHaveLength(6);
    await vi.advanceTimersByTimeAsync(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(started.at(-1)?.url).toBe("/healthy.jpg");
    finish(started.at(-1));
    await vi.advanceTimersByTimeAsync(0);
    await expect(healthy).resolves.toHaveProperty("width", FULL.width);
    await Promise.all(hung);
  });

  it("drops a load from the queue when its signal fires", async () => {
    const started = downloads();
    const { loadImage: load } = await freshDom();
    const controller = new AbortController();
    const first = Array.from(
      { length: 6 },
      async (_, i) => await failure(load(`/${i}.jpg`))
    );
    const dropped = failure(load("/gone.jpg", { signal: controller.signal }));
    const next = failure(load("/next.jpg"));

    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await expect(dropped).resolves.toHaveProperty("code", "aborted");
    await vi.advanceTimersByTimeAsync(15_000);
    await Promise.all(first);
    await vi.advanceTimersByTimeAsync(0);
    expect(started.map(({ url }) => url)).not.toContain("/gone.jpg");
    expect(started.map(({ url }) => url)).toContain("/next.jpg");
    await vi.advanceTimersByTimeAsync(15_000);
    await next;
  });
});

describe("the pixel limit", () => {
  beforeEach(() => {
    open.clear();
    decodes = 0;
    made = 0;
    decodeFails = false;
    copyFails = false;
    gate = Promise.resolve();
    stub(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens a photo of exactly 268402689 pixels by default", async () => {
    const image = await loadImage(pngOf(16_383, 16_383));

    expect(decodes).toBe(1);
    image.preview.close();
  });

  it("refuses a photo over the default limit before it decodes", async () => {
    const error = await failure(loadImage(pngOf(16_384, 16_383)));

    expect(codeOf(error)).toBe("too-large");
    expect(decodes).toBe(0);
  });

  it("honours a limit the caller passes, higher or lower", async () => {
    expect(
      codeOf(await failure(loadImage(pngOf(100, 100), { maxPixels: 9999 })))
    ).toBe("too-large");

    const image = await loadImage(pngOf(30_000, 30_000), {
      maxPixels: Number.POSITIVE_INFINITY,
    });

    expect(decodes).toBe(1);
    image.preview.close();
  });

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

  it("names no step in its message", async () => {
    const error = await failure(withTimeout(never, 1, undefined));

    expect(messageOf(error)).toBe("zriz: timed out after 1 ms");
  });

  it("starts again when the page was suspended past the limit", async () => {
    let now = 0;
    let fire = noop;
    const delays: number[] = [];

    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("clearTimeout", () => null);

    vi.stubGlobal("setTimeout", (run: () => void, ms: number) => {
      fire = run;
      delays.push(ms);

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
    expect(delays).toStrictEqual([1000, 1000]);
    now = 19_000;
    fire();

    await vi.waitFor(() => {
      expect(seen).toStrictEqual(["timeout"]);
    });
  });
});

describe("the preview edge", () => {
  beforeEach(() => {
    open.clear();
    decodes = 0;
    made = 0;
    decodeFails = false;
    copyFails = false;
    gate = Promise.resolve();
    stub(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([0, -5, Number.NaN])(
    "uses the default for %d",
    async (previewEdge) => {
      const { preview } = await loadImage(jpeg(), { previewEdge });

      expect(preview.width).toBe(2560);
    }
  );

  it("treats infinity as no cap", async () => {
    const { preview } = await loadImage(jpeg(), {
      previewEdge: Number.POSITIVE_INFINITY,
    });

    expect(preview.width).toBe(FULL.width);
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
  it("finds an animation chunk past a large color profile", () => {
    const bytes = png(
      pngChunk("IHDR", 13),
      pngChunk("iCCP", 400),
      pngChunk("acTL", 8)
    );

    expect(raster(bytes).animated).toBeTruthy();
  });

  it("does not read a png's text as an animation", () => {
    const text = [...uint32(4), ...ascii("tEXtacTL"), 0, 0, 0, 0];

    expect(raster(png(pngChunk("IHDR", 13), text)).animated).toBeFalsy();
  });

  it("stops at the image data of a png", () => {
    const bytes = png(pngChunk("IDAT", 13), pngChunk("acTL", 8));

    expect(raster(bytes).animated).toBeFalsy();
  });

  it("reads a webp's animation from its flags", () => {
    expect(raster(webp(0x22)).animated).toBeTruthy();

    expect(raster(webp(0x20))).toStrictEqual({
      animated: false,
      mime: "image/webp",
    });
  });

  it("prefers avif anywhere in the brand list", () => {
    const bytes = ftyp("mif1", "mif1", "miaf", "MA1A", "MA1B", "avif");

    expect(raster(bytes).mime).toBe("image/avif");

    expect(raster(ftyp("avis", "avif"))).toStrictEqual({
      animated: true,
      mime: "image/avif",
    });
  });

  it.each(["heic", "heix", "heim", "heis", "hevm", "hevs", "hevx", "mif1"])(
    "reads the %s brand as heic",
    (brand) => {
      expect(raster(ftyp(brand)).mime).toBe("image/heic");
    }
  );

  it.each(["hevc", "hevx", "hevm", "hevs", "msf1"])(
    "reads the %s brand as a sequence",
    (brand) => {
      expect(raster(ftyp(brand)).animated).toBeTruthy();
    }
  );

  it("ignores a brand spelled across the bytes of two others", () => {
    expect(raster(ftyp("xxav", "ifxx")).mime).toBeNull();
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
    open.clear();
    decodes = 0;
    made = 0;
    decodeFails = false;
    copyFails = false;
    gate = Promise.resolve();
    stub(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("rejects a load past its timeout", async () => {
    gate = new Promise(noop);
    const error = await failure(loadImage(jpeg(), { timeout: 0 }));

    expect(codeOf(error)).toBe("timeout");
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

  it("clears its timer and listener when the work wins", async () => {
    vi.useFakeTimers();
    const { signal } = new AbortController();

    await expect(withTimeout(Promise.resolve(1), 1000, signal)).resolves.toBe(
      1
    );

    expect(vi.getTimerCount()).toBe(0);
    expect(listeners(signal)).toBe(0);
  });

  it("clears its timer and listener when the work fails", async () => {
    vi.useFakeTimers();
    const { signal } = new AbortController();
    const error = await failure(
      withTimeout(Promise.reject(new Error("no")), 1000, signal)
    );

    expect(messageOf(error)).toBe("no");
    expect(vi.getTimerCount()).toBe(0);
    expect(listeners(signal)).toBe(0);
  });

  it("clears its timer and listener when an aborted signal wins", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const work = failure(withTimeout(never, 1000, controller.signal));

    controller.abort();
    expect(codeOf(await work)).toBe("aborted");
    expect(vi.getTimerCount()).toBe(0);
    expect(listeners(controller.signal)).toBe(0);
  });

  it.each(["timeout", "aborted"] as const)(
    "keeps the %s code through toZriz, whatever the file",
    (code) => {
      const error = new ZrizError(code, "zriz: stop");

      expect(toZriz(error)).toBe(error);
      expect(toZriz(error, "image/heic")).toBe(error);
    }
  );

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
    open.clear();
    decodes = 0;
    made = 0;
    decodeFails = true;
    copyFails = false;
    gate = Promise.resolve();
    stub(false);

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

  it("closes the source and the preview when the photo is removed", async () => {
    const full = bitmap();
    const image = await hooked(full);

    expect(image.source).toBe(full);
    expect(image.preview).not.toBe(full);
    const cropper = createCropper();

    attachImage(cropper, image);
    attachImage(cropper, null);
    expect(open.has(full)).toBeFalsy();
    await noneLive();
  });

  it("closes the old photo and keeps the new one on a swap", async () => {
    const first = bitmap();
    const second = bitmap(800, 600);
    const old = await hooked(first);
    const next = await hooked(second);
    const cropper = createCropper();

    attachImage(cropper, old);
    attachImage(cropper, next);
    expect(open.has(first)).toBeFalsy();
    expect(open.has(second)).toBeTruthy();
    expect(next.preview.width).toBe(100);
    attachImage(cropper, null);
    expect(open.has(second)).toBeFalsy();
  });

  it("keeps a photo that is attached again", async () => {
    const full = bitmap();
    const image = await hooked(full);
    const cropper = createCropper();

    attachImage(cropper, image);
    attachImage(cropper, image);
    expect(open.has(full)).toBeTruthy();
    attachImage(cropper, null);
    expect(open.has(full)).toBeFalsy();
  });

  it("frees its own preview and leaves a large bitmap the caller passed open", async () => {
    const full = bitmap();
    const image = await loadImage(full, { previewEdge: 100 });
    const cropper = createCropper();

    const close = vi.spyOn(image.preview, "close");

    expect(image.preview).not.toBe(full);
    attachImage(cropper, image);
    attachImage(cropper, null);
    expect(close).toHaveBeenCalledOnce();
    expect(open.has(full)).toBeTruthy();
    full.close();
    await noneLive();
  });

  it("leaves a bitmap the caller passed open when the load aborts", async () => {
    const full = bitmap();
    const controller = new AbortController();

    controller.abort();
    const error = await failure(loadImage(full, { signal: controller.signal }));

    expect(codeOf(error)).toBe("aborted");
    expect(open.has(full)).toBeTruthy();
    full.close();
  });

  it("leaves a bitmap the caller passed open when the load is discarded", async () => {
    const full = bitmap();
    const image = await loadImage(full, { previewEdge: 100 });

    discardImage(image);
    expect(open.has(full)).toBeTruthy();
    full.close();
    await noneLive();
  });

  it("closes what a decode hook returns after the load was aborted", async () => {
    const full = bitmap();
    const controller = new AbortController();
    const error = await failure(
      hooked(full, {
        decode: async () => {
          controller.abort();

          return await Promise.resolve(full);
        },
        signal: controller.signal,
      })
    );

    expect(codeOf(error)).toBe("aborted");
    await noneLive();
  });
});
