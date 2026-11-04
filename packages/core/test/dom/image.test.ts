import { setTimeout as delay } from "node:timers/promises";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createCropper } from "../../src";
import { ZrizError, attachImage, loadImage } from "../../src/dom";
import { raster, toZriz, withTimeout } from "../../src/dom/image";
import { FakeWorker } from "./fake-worker";

vi.mock(import("../../src/dom/source"), () => ({
  assertReadable: () => 255,
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

interface Live {
  realm: Realm;
}

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

interface Resize {
  resizeWidth?: number;
  resizeHeight?: number;
}

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

const jpeg = (): Blob =>
  new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])], {
    type: "image/jpeg",
  });

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
    await decoding(5);
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
