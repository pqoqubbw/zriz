import { imageKernel } from "./kernel";
import type {
  DecodeReply,
  Kernel,
  Region,
  RenderJob,
  RenderReply,
} from "./kernel";

interface Waiting {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

interface Reply {
  id: number;
  result?: unknown;
  error?: string;
}

let worker: Worker | null | undefined;
let local: Kernel | null = null;
let next = 0;
const waiting = new Map<number, Waiting>();

const program = (kernel: string): string =>
  `const kernel=(${kernel})();onmessage=async(e)=>{const{id,op,args}=e.data;try{const result=await kernel[op](...args);postMessage({id,result},result instanceof ImageBitmap?[result]:result&&result.preview?[result.preview]:[])}catch(error){postMessage({id,error:String(error&&error.message||error)})}}`;

const isReply = (value: unknown): value is Reply =>
  typeof value === "object" && value !== null && "id" in value;

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
      new Blob([program(imageKernel.toString())], { type: "text/javascript" })
    );
    const created = new Worker(url);
    created.addEventListener("message", (event: MessageEvent<unknown>) => {
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
    created.addEventListener("error", () => {
      worker = null;
      for (const entry of waiting.values()) {
        entry.reject(new Error("zriz:worker:failed"));
      }
      waiting.clear();
    });
    worker = created;
  } catch {
    worker = null;
  }
  return worker;
};

const direct = (): Kernel => {
  local ??= imageKernel();
  return local;
};

const call = async (
  op: keyof Kernel,
  args: readonly unknown[]
): Promise<unknown> => {
  const target = spawn();
  if (!target) {
    throw new Error("zriz:worker:none");
  }
  next += 1;
  const id = next;
  const result = new Promise<unknown>((resolve, reject) => {
    waiting.set(id, { reject, resolve });
  });
  target.postMessage({ args, id, op }, []);
  return await result;
};

const isDecode = (value: unknown): value is DecodeReply =>
  typeof value === "object" && value !== null && "preview" in value;

const isRender = (value: unknown): value is RenderReply =>
  typeof value === "object" && value !== null && "blob" in value;

const fallback = (error: unknown): boolean =>
  error instanceof Error && error.message.startsWith("zriz:worker:");

const via = async <T>(
  op: keyof Kernel,
  args: readonly unknown[],
  check: (value: unknown) => value is T,
  here: (kernel: Kernel) => Promise<T>
): Promise<T> => {
  try {
    const reply = await call(op, args);
    if (check(reply)) {
      return reply;
    }
  } catch (error) {
    if (!fallback(error)) {
      throw error;
    }
  }
  return await here(direct());
};

const isBitmap = (value: unknown): value is ImageBitmap =>
  typeof ImageBitmap === "function" && value instanceof ImageBitmap;

const isBlob = (value: unknown): value is Blob => value instanceof Blob;

const isNothing = (value: unknown): value is undefined => value === undefined;

export const decodeOff = async (
  blob: Blob,
  edge: number,
  keep?: number
): Promise<DecodeReply> =>
  await via(
    "decode",
    [blob, edge, keep],
    isDecode,
    async (kernel) => await kernel.decode(blob, edge, keep)
  );

export const keepOff = async (
  id: number,
  bitmap: ImageBitmap
): Promise<void> => {
  await via("keep", [id, bitmap], isNothing, async (kernel) => {
    await kernel.keep(id, bitmap);
  });
};

export const motionOff = async (id: number, type: string): Promise<Blob> =>
  await via(
    "motion",
    [id, type],
    isBlob,
    async (kernel) => await kernel.motion(id, type)
  );

export const resampleOff = async (
  id: number,
  scale: number
): Promise<ImageBitmap> =>
  await via(
    "resample",
    [id, scale],
    isBitmap,
    async (kernel) => await kernel.resample(id, scale)
  );

export const regionOff = async (
  source: Blob | ImageBitmap,
  rect: Region,
  width: number,
  height: number
): Promise<ImageBitmap> =>
  await via(
    "region",
    [source, rect, width, height],
    isBitmap,
    async (kernel) => await kernel.region(source, rect, width, height)
  );

export const releaseOff = async (id: number): Promise<void> => {
  await via("release", [id], isNothing, async (kernel) => {
    await kernel.release(id);
  });
};

export const renderOff = async (job: RenderJob): Promise<RenderReply> => {
  try {
    const reply = await call("render", [job]);
    if (isRender(reply)) {
      return reply;
    }
  } catch (error) {
    if (!fallback(error)) {
      throw error;
    }
  }
  return await direct().render(job);
};

export const workerActive = (): boolean =>
  worker !== null && worker !== undefined;

export const renderHere = async (job: RenderJob): Promise<RenderReply> =>
  await direct().render(job);
