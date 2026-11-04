import { ZrizError } from "./error";

const TIMEOUT_MS = 15_000;
const MAX_DELAY_MS = 2_147_483_647;
const SUSPENDED_MS = 1000;

const noop = (): void => undefined;

const aborted = (): ZrizError => new ZrizError("aborted", "zriz: aborted");

const deadline = (
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
        if (performance.now() - due > SUSPENDED_MS) {
          arm(delay);
        } else {
          reject(new ZrizError("timeout", `zriz: timed out after ${ms} ms`));
        }
      }, delay);
    };

    arm(Math.min(ms, MAX_DELAY_MS));

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

const withTimeout = async <T>(
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

export { MAX_DELAY_MS, TIMEOUT_MS, aborted, deadline, noop, withTimeout };
