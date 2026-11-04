import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

import { build } from "esbuild";
import type { BuildOptions } from "esbuild";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DecodeReply, Kernel } from "../../src/dom/kernel";
import { deferred } from "./deferred";
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

describe("bitmaps sent to the worker", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  class Sent {
    closed = false;
    fails = false;
    close(): void {
      this.closed = true;
    }
  }

  const sending = async () => {
    vi.resetModules();
    FakeWorker.globals = { ImageBitmap: Sent };
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("OffscreenCanvas", Map);
    return await import("../../src/dom/worker");
  };

  const fromWorker = async (arg: unknown): Promise<unknown> => {
    const { lane } = await sending();
    const target = lane(() => ({
      job: async (sent: { fails?: boolean }): Promise<number> => {
        await Promise.resolve();
        if (sent.fails === true) {
          throw new Error("no");
        }
        return 1;
      },
    }));
    return await target.call("job", [arg]).catch(() => "failed");
  };

  it("closes a bitmap argument once the job ends", async () => {
    const sent = new Sent();
    await expect(fromWorker(sent)).resolves.toBe(1);
    expect(sent.closed).toBeTruthy();
  });

  it("closes the bitmap source of a job", async () => {
    const source = new Sent();
    await expect(fromWorker({ source })).resolves.toBe(1);
    expect(source.closed).toBeTruthy();
  });

  it("closes a bitmap argument when the job fails", async () => {
    const sent = new Sent();
    sent.fails = true;
    await expect(fromWorker(sent)).resolves.toBe("failed");
    expect(sent.closed).toBeTruthy();
  });

  it("leaves the arguments of the main thread fallback open", async () => {
    vi.resetModules();
    vi.stubGlobal("Worker", undefined);
    const { lane, via } = await import("../../src/dom/worker");
    const sent = new Sent();
    const target = lane(() => ({
      job: async (): Promise<number> => await Promise.resolve(1),
    }));
    await expect(via(target, "job", [sent])).resolves.toBe(1);
    expect(sent.closed).toBeFalsy();
  });
});

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

const job = () => {
  const held = deferred<string>();
  const start = vi.fn<() => Promise<string>>(async () => await held.promise);
  return { held, start };
};

describe("gate", () => {
  it("keeps the slot of a running job when a queued job aborts", async () => {
    const { gate } = await import("../../src/dom/worker");
    const turn = gate(1);
    const first = job();
    const second = job();
    const third = job();
    const fourth = job();
    const controller = new AbortController();
    const running = turn(first.start, 60_000, undefined);
    const waiting = turn(second.start, 60_000, undefined);
    const dropped = turn(third.start, 60_000, controller.signal);
    const last = turn(fourth.start, 60_000, undefined);
    controller.abort();
    await expect(dropped).rejects.toHaveProperty("code", "aborted");
    await delay(5);
    expect(second.start).not.toHaveBeenCalled();
    first.held.resolve("first");
    await running;
    await vi.waitFor(() => {
      expect(second.start).toHaveBeenCalledOnce();
    });
    expect(fourth.start).not.toHaveBeenCalled();
    second.held.resolve("second");
    await waiting;
    await vi.waitFor(() => {
      expect(fourth.start).toHaveBeenCalledOnce();
    });
    expect(third.start).not.toHaveBeenCalled();
    fourth.held.resolve("fourth");
    await last;
  });

  it("starts nothing and frees the slot on an abort in the tick the turn is granted", async () => {
    const { gate } = await import("../../src/dom/worker");
    const turn = gate(1);
    const first = job();
    const next = job();
    const controller = new AbortController();
    const granted = turn(first.start, 60_000, controller.signal);
    controller.abort();
    await expect(granted).rejects.toHaveProperty("code", "aborted");
    expect(first.start).not.toHaveBeenCalled();
    const after = turn(next.start, 60_000, undefined);
    await vi.waitFor(() => {
      expect(next.start).toHaveBeenCalledOnce();
    });
    next.held.resolve("next");
    await expect(after).resolves.toBe("next");
  });
});
