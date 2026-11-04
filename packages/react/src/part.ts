"use client";

import type {
  ComponentPropsWithoutRef,
  ForwardRefExoticComponent,
  JSX,
  PropsWithoutRef,
  Ref,
  RefAttributes,
} from "react";
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
  className?: ClassName<S>;
  /** Your own element, or a function of props and state that returns one. */
  render?: RenderProp<S>;
} & RefAttributes<ElementOf<T>>;

export type Part<P, E> = ForwardRefExoticComponent<
  PropsWithoutRef<P> & RefAttributes<E>
>;

export interface RootContext {
  shape: "rect" | "circle";
  instructions: string;
  dir: "ltr" | "rtl";
  locale: string | undefined;
}

export const RootContextValue: React.Context<RootContext> =
  createContext<RootContext>({
    dir: "ltr",
    instructions: "",
    locale: undefined,
    shape: "rect",
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

const hold = <T>(ref: Ref<T> | undefined, node: T): (() => void) =>
  mergeRefs<T>(ref)(node);

export const useMergedRef = <T>(
  own: (node: T) => (() => void) | undefined,
  theirs: Ref<T> | undefined
): ((node: T | null) => void) => {
  const latest = useRef(theirs);
  const node = useRef<T | null>(null);
  const release = useRef<(() => void) | undefined>(undefined);
  const unbind = useRef<(() => void) | undefined>(undefined);
  useIsomorphicLayoutEffect(() => {
    if (latest.current === theirs) {
      return;
    }
    latest.current = theirs;
    if (node.current !== null) {
      release.current?.();
      release.current = hold(theirs, node.current);
    }
  }, [theirs]);
  return useCallback(
    (next: T | null) => {
      release.current?.();
      release.current = undefined;
      unbind.current?.();
      unbind.current = undefined;
      node.current = next;
      if (next !== null) {
        unbind.current = own(next);
        release.current = hold(latest.current, next);
      }
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
    props[key] = native(handler);
  }
  return props;
};
