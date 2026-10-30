import type { CSSProperties, Ref } from "react";

const vetoes = new WeakMap<object, () => void>();

export const preventZrizHandler = (event: object): void => {
  vetoes.get(event)?.();
};

type Handler = (event: object) => void;

const isHandler = (key: string, value: unknown): value is Handler =>
  key.length > 2 &&
  key.startsWith("on") &&
  (key.codePointAt(2) ?? 0) >= 65 &&
  (key.codePointAt(2) ?? 0) <= 90 &&
  typeof value === "function";

const isStyle = (value: unknown): value is CSSProperties =>
  typeof value === "object" && value !== null;

export const mergeRefs =
  <T>(...refs: (Ref<T> | undefined)[]) =>
  (node: T | null): (() => void) => {
    const cleanups = refs.map((ref) => {
      if (typeof ref === "function") {
        const cleanup = ref(node);
        return typeof cleanup === "function"
          ? cleanup
          : () => {
              ref(null);
            };
      }
      if (ref) {
        ref.current = node;
        return () => {
          ref.current = null;
        };
      }
      return null;
    });
    return () => {
      for (const cleanup of cleanups) {
        cleanup?.();
      }
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
