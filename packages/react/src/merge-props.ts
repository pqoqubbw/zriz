import type { CSSProperties, Ref } from "react";

const vetoes = new WeakMap<object, () => void>();

export const preventZrizHandler = (event: object): void => {
  vetoes.get(event)?.();
};

type Handler = (event: object) => void;

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

const noop = (): void => undefined;

export const mergeRefs = <T>(
  ...refs: (Ref<T> | undefined)[]
): ((node: T | null) => () => void) => {
  let cleanups: ((() => unknown) | null)[] | null = null;
  return (node) => {
    const previous = cleanups;
    cleanups = null;
    if (previous) {
      run(previous);
    } else if (node === null) {
      refs.map((ref) => attach(ref, null));
    }
    if (node === null) {
      return noop;
    }
    const mine = refs.map((ref) => attach(ref, node));
    cleanups = mine;
    return () => {
      if (cleanups === mine) {
        cleanups = null;
        run(mine);
      }
    };
  };
};

export const mergeProps = (
  ours: Record<string, unknown>,
  theirs: Record<string, unknown>
): Record<string, unknown> => {
  const merged: Record<string, unknown> = { ...ours };
  for (const [key, value] of Object.entries(theirs)) {
    const own = merged[key];
    if (isHandler(key, value) && isHandler(key, own)) {
      merged[key] = (event: object) => {
        let prevented = false;
        vetoes.set(event, () => {
          prevented = true;
        });
        value(event);
        vetoes.delete(event);
        if (!prevented) {
          own(event);
        }
      };
    } else if (key === "style" && isStyle(own) && isStyle(value)) {
      merged.style = { ...own, ...value };
    } else if (
      key === "className" &&
      typeof own === "string" &&
      typeof value === "string"
    ) {
      merged.className = `${own} ${value}`;
    } else if (value !== undefined) {
      merged[key] = value;
    }
  }
  return merged;
};
