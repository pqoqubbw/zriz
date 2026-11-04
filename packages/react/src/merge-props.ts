import { version } from "react";
import type { CSSProperties, Ref } from "react";

const legacy: boolean = Number(version.slice(0, version.indexOf("."))) < 19;

const vetoes = new WeakMap<object, () => void>();

const preventZrizHandler = (event: object): void => {
  vetoes.get(event)?.();
};

type Handler = (...args: unknown[]) => void;

type Step = (args: unknown[], vetoed: boolean) => void;

const steps = new WeakMap<Handler, Step>();

const chain = (own: Handler, theirs: Handler): Handler => {
  const inner = steps.get(own);

  const step: Step = (args, vetoed) => {
    const event = new Object(args[0]);
    let prevented = vetoed;

    vetoes.set(event, () => {
      prevented = true;
    });

    theirs(...args);
    vetoes.delete(event);

    if (inner) {
      inner(args, prevented);
    } else if (!prevented) {
      own(...args);
    }
  };

  const handler: Handler = (...args) => {
    step(args, false);
  };

  steps.set(handler, step);

  return handler;
};

const isHandler = (key: string, value: unknown): value is Handler =>
  /^on[A-Z]/u.test(key) && typeof value === "function";

const isStyle = (value: unknown): value is CSSProperties =>
  typeof value === "object" && value !== null;

const attach = <T>(
  ref: Ref<T> | undefined,
  node: T | null
): (() => unknown) | null => {
  if (typeof ref === "function") {
    const cleanup = ref(node);

    return typeof cleanup === "function"
      ? cleanup
      : () => {
          ref(null);
        };
  }

  if (ref && typeof ref === "object") {
    ref.current = node;

    return () => {
      ref.current = null;
    };
  }

  return null;
};

const run = (cleanups: ((() => unknown) | null)[]): void => {
  for (const cleanup of cleanups) {
    cleanup?.();
  }
};

const mergeRefs = <T>(
  ...refs: (Ref<T> | undefined)[]
): ((node: T | null) => (() => void) | undefined) => {
  let cleanups: ((() => unknown) | null)[] | null = null;

  return (node) => {
    const previous = cleanups;

    cleanups = null;

    if (previous) {
      run(previous);
    } else if (node === null) {
      refs.map((ref) => attach(ref, null));
    }

    const mine = node === null ? null : refs.map((ref) => attach(ref, node));

    cleanups = mine;

    return mine === null || legacy
      ? undefined
      : () => {
          if (cleanups === mine) {
            cleanups = null;
            run(mine);
          }
        };
  };
};

const mergeProps = (ours: object, theirs: object): Record<string, unknown> => {
  const merged: Record<string, unknown> = { ...ours };

  for (const [key, value] of Object.entries<unknown>({ ...theirs })) {
    const own = merged[key];

    if (isHandler(key, value) && isHandler(key, own)) {
      merged[key] = chain(own, value);
    } else if (key === "style" && isStyle(own) && isStyle(value)) {
      merged.style = { ...own, ...value };
    } else if (
      key === "className" &&
      typeof own === "string" &&
      typeof value === "string"
    ) {
      merged.className = `${own} ${value}`;
    } else if (value !== undefined && !isHandler(key, own)) {
      merged[key] = value;
    }
  }

  return merged;
};

export { attach, legacy, mergeProps, mergeRefs, preventZrizHandler };
