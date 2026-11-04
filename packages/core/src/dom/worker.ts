import { imageKernel } from "./kernel";
import type { DecodeReply, Kernel, Region } from "./kernel";
import { MAX_DELAY, aborted, withTimeout } from "./turn";

interface Waiting {
  resolve: (value: never) => void;
  reject: (error: Error) => void;
}

interface Reply {
  id: number;
  result: never;
  error?: string;
}

export interface Lane<K> {
  call: <T>(op: string, args: readonly unknown[]) => Promise<T>;
  here: () => K;
}

const program = (kernel: string): string =>
  `const kernel=(${kernel})();onmessage=async(e)=>{const{id,op,args}=e.data;try{const result=await kernel[op](...args);postMessage({id,result},result instanceof ImageBitmap?[result]:result&&result.preview?[result.preview]:[])}catch(error){postMessage({id,error:error instanceof ReferenceError?"zriz:worker:failed":String(error&&error.message||error)})}finally{for(const arg of args){const held=arg&&arg.source||arg;if(held instanceof ImageBitmap)held.close()}}}`;

const isReply = (value: unknown): value is Reply =>
  typeof value === "object" && value !== null && "id" in value;

export const lane = <K>(kernel: () => K): Lane<K> => {
  let worker: Worker | null | undefined;
  let local: K | null = null;
  let next = 0;
  const waiting = new Map<number, Waiting>();

  const spawn = (): Worker | null => {
    if (worker !== undefined) {
      return worker;
    }
    worker = null;
    if (
      typeof Worker !== "function" ||
      typeof OffscreenCanvas !== "function" ||
      typeof Blob !== "function"
    ) {
      return worker;
    }
    try {
      const url = URL.createObjectURL(
        new Blob([program(kernel.toString())], { type: "text/javascript" })
      );
      const created = new Worker(url);
      created.addEventListener("message", (event: MessageEvent<unknown>) => {
        URL.revokeObjectURL(url);
        const reply = event.data;
        if (!isReply(reply)) {
          return;
        }
        const entry = waiting.get(reply.id);
        waiting.delete(reply.id);
        if (reply.error === undefined) {
          entry?.resolve(reply.result);
        } else {
          entry?.reject(new Error(reply.error));
        }
      });
      const failed = (): void => {
        URL.revokeObjectURL(url);
        created.terminate();
        worker = null;
        for (const entry of waiting.values()) {
          entry.reject(new Error("zriz:worker:failed"));
        }
        waiting.clear();
      };
      created.addEventListener("error", failed);
      created.addEventListener("messageerror", failed);
      worker = created;
    } catch {
      worker = null;
    }
    return worker;
  };

  return {
    call: async <T>(op: string, args: readonly unknown[]): Promise<T> => {
      const target = spawn();
      if (!target) {
        throw new Error("zriz:worker:none");
      }
      next += 1;
      const id = next;
      return await new Promise<T>((resolve, reject) => {
        target.postMessage({ args, id, op }, []);
        waiting.set(id, { reject, resolve });
      });
    },
    here: () => {
      local ??= kernel();
      return local;
    },
  };
};

const fallback = (error: unknown): boolean =>
  error instanceof Error && error.message.startsWith("zriz:worker:");

export const via = async <
  K extends Record<O, (...args: A) => Promise<T>>,
  O extends keyof K & string,
  const A extends readonly unknown[],
  T,
>(
  target: Lane<K>,
  op: O,
  args: A
): Promise<T> => {
  try {
    return await target.call<T>(op, args);
  } catch (error) {
    if (!fallback(error)) {
      throw error;
    }
  }
  return await target.here()[op](...args);
};

const noop = (): void => undefined;

export type Turn = <T>(
  start: () => Promise<T>,
  ms: number,
  signal: AbortSignal | undefined
) => Promise<T>;

export const gate = (size: number): Turn => {
  let free = size;
  const turns: (() => void)[] = [];
  const leave = (): void => {
    const first = turns.shift();
    if (first) {
      first();
    } else {
      free += 1;
    }
  };
  return async (start, ms, signal) => {
    let enter = noop;
    const turn = new Promise<void>((resolve) => {
      enter = resolve;
    });
    if (free > 0) {
      free -= 1;
      enter();
    } else {
      turns.push(enter);
    }
    try {
      await withTimeout(turn, MAX_DELAY, signal);
      if (signal?.aborted === true) {
        throw aborted();
      }
    } catch (error) {
      const at = turns.indexOf(enter);
      if (at === -1) {
        leave();
      } else {
        turns.splice(at, 1);
      }
      throw error;
    }
    const job = start();
    withTimeout(job, ms, undefined).finally(leave).catch(noop);
    return await job;
  };
};

export const decodeTurn: Turn = gate(3);

let decoder: Lane<Kernel> | undefined;

const decoding = (): Lane<Kernel> => {
  decoder ??= lane(imageKernel);
  return decoder;
};

export const decodeOff = async (
  blob: Blob,
  edge: number,
  keep?: number
): Promise<DecodeReply> => await via(decoding(), "decode", [blob, edge, keep]);

export const keepOff = async (
  id: number,
  bitmap: ImageBitmap
): Promise<void> => {
  await via(decoding(), "keep", [id, bitmap]);
};

export const motionOff = async (id: number, type: string): Promise<Blob> =>
  await via(decoding(), "motion", [id, type]);

export const resampleOff = async (
  id: number,
  rect: Region,
  width: number,
  height: number
): Promise<ImageBitmap> =>
  await via(decoding(), "resample", [id, rect, width, height]);

export const regionOff = async (
  source: Blob | ImageBitmap,
  rect: Region,
  width: number,
  height: number
): Promise<ImageBitmap> =>
  await via(decoding(), "region", [source, rect, width, height]);

export const releaseOff = async (id: number): Promise<void> => {
  await via(decoding(), "release", [id]);
};
