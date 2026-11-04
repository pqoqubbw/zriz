"use client";

import type {
  CSSProperties,
  ComponentPropsWithoutRef,
  Context,
  ForwardRefExoticComponent,
  JSX,
  KeyboardEvent,
  PropsWithoutRef,
  Ref,
  RefAttributes,
} from "react";
import {
  createContext,
  useCallback,
  useEffect,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { attach, mergeRefs } from "./merge-props";
import type { ClassName, RenderProp } from "./use-render";

type ElementOf<T> = T extends keyof HTMLElementTagNameMap
  ? HTMLElementTagNameMap[T]
  : T extends keyof SVGElementTagNameMap
    ? SVGElementTagNameMap[T]
    : Element;

export type PartProps<T extends keyof JSX.IntrinsicElements, S> = Omit<
  ComponentPropsWithoutRef<T>,
  "className"
> & {
  /** A class, or a function of the part's state that returns one. */
  className?: ClassName<S> | undefined;
  /** Your own element, or a function of props and state that returns one. */
  render?: RenderProp<S> | undefined;
} & RefAttributes<ElementOf<T>>;

export type Part<P, E> = ForwardRefExoticComponent<
  PropsWithoutRef<P> & RefAttributes<E>
>;

export interface RootContextValue {
  box?: ElementBox;
  shape: "rect" | "circle";
  instructions: string | undefined;
  dir: "ltr" | "rtl";
  locale: string | undefined;
}

export const RootContext: Context<RootContextValue> =
  createContext<RootContextValue>({
    dir: "ltr",
    instructions: undefined,
    locale: undefined,
    shape: "rect",
  });

export const useIsomorphicLayoutEffect: typeof useEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export const useSameJson = <T>(value: T): T => {
  const [held, setHeld] = useState(value);
  if (JSON.stringify(held) !== JSON.stringify(value)) {
    setHeld(value);
  }
  return held;
};

export const useLatest = <T>(value: T): { readonly current: T } => {
  const ref = useRef(value);
  useIsomorphicLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
};

export const keepStyle =
  (base: CSSProperties) =>
  (node: HTMLElement | null): undefined => {
    if (node) {
      const { style } = node;
      for (const [key, value] of Object.entries(base)) {
        if (Reflect.get(style, key) === "") {
          Reflect.set(style, key, value);
        }
      }
    }
    return undefined;
  };

export const useKeptStyle = (
  keep: (node: HTMLElement | null) => undefined,
  ref: Ref<HTMLElement> | undefined
): Ref<HTMLElement> => useMemo(() => mergeRefs(keep, ref), [keep, ref]);

export interface ElementBox {
  get: () => Element | null;
  set: (node: Element) => () => void;
}

const createBox = (): ElementBox => {
  let node: Element | null = null;
  return {
    get: () => node,
    set: (next) => {
      node = next;
      return () => {
        node = null;
      };
    },
  };
};

export const useElementBox = (): ElementBox => useMemo(() => createBox(), []);

export const useHold = (hold: () => (() => unknown) | null): void => {
  const held = useRef<{
    from: typeof hold;
    release: (() => unknown) | null;
  } | null>(null);
  useIsomorphicLayoutEffect(() => {
    if (held.current?.from !== hold) {
      held.current?.release?.();
      held.current = { from: hold, release: hold() };
    }
  }, [hold]);
  useEffect(
    () => () => {
      held.current?.release?.();
      held.current = null;
    },
    []
  );
};

export const useMergedRef = <T>(
  own: (node: T) => (() => void) | undefined,
  theirs: Ref<T> | undefined
): ((node: T | null) => void) => {
  const latest = useRef(theirs);
  const held = useRef(theirs);
  const node = useRef<T | null>(null);
  const bound = useRef<typeof own | null>(null);
  const leaving = useRef(false);
  const release = useRef<(() => unknown) | null>(null);
  const unbind = useRef<(() => void) | undefined>(undefined);
  useInsertionEffect(() => {
    latest.current = theirs;
  }, [theirs]);
  useIsomorphicLayoutEffect(() => {
    if (held.current === theirs) {
      return;
    }
    held.current = theirs;
    if (node.current !== null && !leaving.current) {
      release.current?.();
      release.current = attach(theirs, node.current);
    }
  }, [theirs]);
  return useCallback(
    (next: T | null) => {
      release.current?.();
      release.current = null;
      const drop = (): void => {
        unbind.current?.();
        unbind.current = undefined;
        bound.current = null;
        node.current = null;
      };
      if (next === null) {
        leaving.current = true;
        queueMicrotask(() => {
          if (leaving.current) {
            leaving.current = false;
            drop();
          }
        });
        return;
      }
      leaving.current = false;
      if (next !== node.current || bound.current !== own) {
        drop();
        node.current = next;
        bound.current = own;
        unbind.current = own(next);
      }
      held.current = latest.current;
      release.current = attach(latest.current, next);
    },
    [own]
  );
};

export const native =
  <E extends Event>(handler: (event: E) => void) =>
  (event: { nativeEvent: E }): void => {
    handler(event.nativeEvent);
  };

export const nativeProps = <H extends Record<keyof H, (event: never) => void>>(
  handlers: H
): Record<string, unknown> => {
  const props: Record<string, unknown> = {};
  for (const [key, handler] of Object.entries<(event: never) => void>(
    handlers
  )) {
    if (key === "onKeyDown") {
      const send = native(handler);
      props[key] = (event: KeyboardEvent & { nativeEvent: never }): void => {
        if (event.target === event.currentTarget) {
          send(event);
        }
      };
    } else if (key !== "release") {
      props[key] = native(handler);
    }
  }
  return props;
};

export const useRelease = (handlers: { release: () => void }): void => {
  useIsomorphicLayoutEffect(() => handlers.release, [handlers]);
};
