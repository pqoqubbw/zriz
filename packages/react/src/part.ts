"use client";

import type { Cropper } from "@zriz/core";
import type { ComponentProps, Ref } from "react";
import {
  createContext,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";

import { mergeRefs } from "./merge-props";
import type { ClassName, RenderProp } from "./use-render";

export type PartProps<T extends keyof React.JSX.IntrinsicElements, S> = Omit<
  ComponentProps<T>,
  "className"
> & {
  /** A class, or a function of the part's state that returns one. */
  className?: ClassName<S>;
  /** Your own element, or a function of props and state that returns one. */
  render?: RenderProp<S>;
};

export interface RootContext {
  shape: "rect" | "circle";
  instructions: string;
  src: string | null;
  crossOrigin: "anonymous" | "use-credentials" | undefined;
  dir: "ltr" | "rtl";
  locale: string | undefined;
}

export const RootContextValue: React.Context<RootContext> =
  createContext<RootContext>({
    crossOrigin: undefined,
    dir: "ltr",
    instructions: "",
    locale: undefined,
    shape: "rect",
    src: null,
  });

export const useIsomorphicLayoutEffect: typeof useEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export const useLatest = <T>(value: T): { readonly current: T } => {
  const ref = useRef(value);
  useIsomorphicLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
};

export interface ElementBox {
  get: () => Element | null;
  set: (node: Element | null) => void;
}

const createBox = (): ElementBox => {
  let node: Element | null = null;
  return {
    get: () => node,
    set: (next) => {
      node = next;
    },
  };
};

export const useElementBox = (): ElementBox => useMemo(() => createBox(), []);

export const useMergedRef = <T>(
  own: (node: T | null) => (() => void) | undefined,
  theirs: Ref<T> | undefined
): ((node: T | null) => () => void) => {
  const latest = useRef(theirs);
  const node = useRef<T | null>(null);
  const release = useRef<(() => void) | null>(null);
  useIsomorphicLayoutEffect(() => {
    if (latest.current === theirs) {
      return;
    }
    latest.current = theirs;
    if (node.current !== null) {
      release.current?.();
      release.current = mergeRefs<T>(theirs)(node.current);
    }
  }, [theirs]);
  return useCallback(
    (next: T | null) => {
      node.current = next;
      const cleanup = own(next);
      release.current =
        next === null ? null : mergeRefs<T>(latest.current)(next);
      return () => {
        release.current?.();
        release.current = null;
        node.current = null;
        cleanup?.();
      };
    },
    [own]
  );
};

export const native =
  <E extends Event>(handler: (event: E) => void) =>
  (event: { nativeEvent: E }): void => {
    handler(event.nativeEvent);
  };

export type Bind = (cropper: Cropper, element: HTMLElement) => () => void;
