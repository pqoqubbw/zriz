import { ZrizError } from "./error";

export const TIMEOUT = 15_000;
const MAX_DELAY = 2_147_483_647;
const SUSPENDED = 1000;

const noop = (): void => undefined;

export const aborted = (): ZrizError =>
  new ZrizError("aborted", "zriz: aborted");

export const deadline = (
  ms: number,
  signal: AbortSignal | undefined
): {
  promise: Promise<never>;
  clear: () => void;
  pause: () => () => void;
} => {
  let clear = noop;
  let pause = (): (() => void) => noop;
  const promise = new Promise<never>((_resolve, reject) => {
    let timer: ReturnType<typeof setTimeout>;
    let due = 0;
    const arm = (delay: number): void => {
      due = performance.now() + delay;
      timer = setTimeout(() => {
        if (performance.now() - due > SUSPENDED) {
          arm(delay);
        } else {
          reject(new ZrizError("timeout", `zriz: timed out after ${ms} ms`));
        }
      }, delay);
    };
    arm(Math.min(ms, MAX_DELAY));
    const abort = (): void => {
      reject(aborted());
    };
    if (signal?.aborted === true) {
      abort();
    }
    signal?.addEventListener("abort", abort, { once: true });
    clear = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    };
    pause = () => {
      clearTimeout(timer);
      const left = Math.max(0, due - performance.now());
      return () => {
        arm(left);
      };
    };
  });
  return { clear, pause, promise };
};

export const withTimeout = async <T>(
  work: Promise<T>,
  ms: number,
  signal: AbortSignal | undefined
): Promise<T> => {
  const limit = deadline(ms, signal);
  try {
    return await Promise.race([work, limit.promise]);
  } finally {
    limit.clear();
  }
};

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
