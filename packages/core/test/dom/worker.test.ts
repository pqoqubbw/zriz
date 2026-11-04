import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import { build } from "esbuild";
import type { BuildOptions } from "esbuild";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DecodeReply, Kernel } from "../../src/dom/kernel";
import { FakeWorker } from "./fake-worker";

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

const isKernelModule = (value: unknown): value is KernelModule =>
  typeof value === "object" && value !== null && "imageKernel" in value;

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

const decodeWith = async (
  options: BuildOptions,
  type = "image/png"
): Promise<DecodeReply> => {
  const kernel = await lowered(options);
  vi.resetModules();
  vi.doMock(import("../../src/dom/kernel"), () => kernel);
  FakeWorker.globals = {
    ImageBitmap: Map,
    createImageBitmap: bitmaps("worker"),
  };
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
      "zriz:undecodable:the browser could not decode the file"
    );
  });
});

const lanes = async () => {
  FakeWorker.made = [];
  FakeWorker.silent = true;
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("OffscreenCanvas", Map);
  const { lane, via } = await import("../../src/dom/worker");
  const target = lane(() => ({
    ping: async (_value: unknown) => await Promise.resolve("here"),
  }));
  return { target, via };
};

const dispatch = (type: string): void => {
  FakeWorker.made[0]?.dispatchEvent(new Event(type));
};

describe("lane failures", () => {
  afterEach(() => {
    FakeWorker.silent = false;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("leaves no call waiting when a message cannot be cloned", async () => {
    const { target } = await lanes();
    const unhandled: unknown[] = [];
    const listener = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", listener);
    await expect(target.call("ping", [() => null])).rejects.toThrow(
      "could not be cloned"
    );
    dispatch("error");
    await delay(10);
    process.off("unhandledRejection", listener);
    expect(unhandled).toStrictEqual([]);
  });

  it.each(["error", "messageerror"])(
    "falls back to the main thread on %s",
    async (type) => {
      const { target, via } = await lanes();
      const reply = via(target, "ping", [1]);
      await vi.waitFor(() => {
        expect(FakeWorker.made).toHaveLength(1);
      });
      dispatch(type);
      await expect(reply).resolves.toBe("here");
    }
  );

  it("stops a failed worker and frees its url", async () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const { target } = await lanes();
    const reply = target.call("ping", [1]);
    dispatch("error");
    await expect(reply).rejects.toThrow("zriz:worker:failed");
    expect(FakeWorker.made[0]?.terminated).toBeTruthy();
    expect(revoke).toHaveBeenCalledOnce();
  });
});
