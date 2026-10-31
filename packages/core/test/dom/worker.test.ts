import { resolveObjectURL } from "node:buffer";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import { build } from "esbuild";
import type { BuildOptions } from "esbuild";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DecodeReply, Kernel } from "../../src/dom/kernel";

type Origin = "main" | "worker";

interface Bitmap {
  width: number;
  height: number;
  origin: Origin;
  close: () => void;
}

interface KernelModule {
  imageKernel: () => Kernel;
}

type Handler = (event: { data: unknown }) => void;

const isKernelModule = (value: unknown): value is KernelModule =>
  typeof value === "object" && value !== null && "imageKernel" in value;

const isHandler = (value: unknown): value is Handler =>
  typeof value === "function";

const kernelPath = fileURLToPath(
  new URL("../../src/dom/kernel.ts", import.meta.url)
);

const lowered = async (options: BuildOptions): Promise<KernelModule> => {
  const result = await build({
    bundle: true,
    entryPoints: [kernelPath],
    format: "iife",
    globalName: "zrizKernel",
    logLevel: "silent",
    minify: true,
    write: false,
    ...options,
  });
  const [file] = result.outputFiles ?? [];
  if (!file) {
    throw new Error("no output");
  }
  const module: unknown = vm.runInThisContext(`${file.text};zrizKernel`);
  if (!isKernelModule(module)) {
    throw new Error("no kernel");
  }
  return module;
};

const bitmaps =
  (origin: Origin) =>
  async (source: unknown): Promise<Bitmap> => {
    await Promise.resolve();
    if (source instanceof Blob && source.type === "image/broken") {
      throw new Error("cannot decode");
    }
    const bitmap: Bitmap = {
      close: () => {
        bitmap.width = 0;
      },
      height: 8,
      origin,
      width: 8,
    };
    return bitmap;
  };

class FakeWorker extends EventTarget {
  private readonly ready: Promise<((data: unknown) => void) | null>;

  constructor(url: string) {
    super();
    const blob = resolveObjectURL(url);
    const context = vm.createContext({
      Blob,
      ImageBitmap: Map,
      createImageBitmap: bitmaps("worker"),
      postMessage: (data: unknown) => {
        this.dispatchEvent(new MessageEvent("message", { data }));
      },
    });
    this.ready = (async () => {
      const source = (await blob?.text()) ?? "";
      try {
        vm.runInContext(source, context);
      } catch {
        this.dispatchEvent(new Event("error"));
        return null;
      }
      const handler: unknown = context.onmessage;
      return isHandler(handler) ? handler : null;
    })().then(
      (handler) =>
        handler &&
        ((data: unknown) => {
          handler({ data });
        })
    );
  }

  postMessage(data: unknown): void {
    void this.ready.then((send) => send?.(data));
  }
}

const decodeWith = async (
  options: BuildOptions,
  type = "image/png"
): Promise<DecodeReply> => {
  const kernel = await lowered(options);
  vi.resetModules();
  vi.doMock(import("../../src/dom/kernel"), () => kernel);
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("OffscreenCanvas", Map);
  vi.stubGlobal("createImageBitmap", bitmaps("main"));
  const { decodeOff } = await import("../../src/dom/worker");
  return await decodeOff(new Blob(["x"], { type }), 100);
};

const originOf = (reply: DecodeReply): unknown => {
  const preview: unknown = reply.preview;
  return typeof preview === "object" && preview !== null && "origin" in preview
    ? preview.origin
    : null;
};

describe("worker fallback", () => {
  afterEach(() => {
    vi.doUnmock("../../src/dom/kernel");
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("decodes in the worker when the kernel is self-contained", async () => {
    const reply = await decodeWith({});
    expect(originOf(reply)).toBe("worker");
    expect(reply.width).toBe(8);
  });

  it("falls back to the main thread when lowering leaves helpers outside the kernel", async () => {
    const reply = await decodeWith({ target: "es2016" });
    expect(originOf(reply)).toBe("main");
    expect(reply.width).toBe(8);
  });

  it("falls back to the main thread when keepNames breaks the kernel", async () => {
    const reply = await decodeWith({ keepNames: true });
    expect(originOf(reply)).toBe("main");
  });

  it("passes decode errors from the worker through", async () => {
    await expect(decodeWith({}, "image/broken")).rejects.toThrow(
      "zriz:decode:this browser cannot decode the file"
    );
  });
});
