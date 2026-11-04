"use client";

import { createElement, isValidElement, useMemo } from "react";
import type { JSX, ReactElement, Ref } from "react";

import { legacy, mergeProps, mergeRefs } from "./merge-props";

export type RenderProp<S> =
  | ReactElement
  | ((props: Record<string, unknown>, state: S) => ReactElement);

const isRef = (value: unknown): value is Ref<HTMLElement> =>
  typeof value === "function" ||
  (typeof value === "object" && value !== null && "current" in value);

const refOf = (element: ReactElement): Ref<HTMLElement> | undefined => {
  const holder: unknown = legacy ? element : element.props;
  const ref =
    typeof holder === "object" && holder !== null && "ref" in holder
      ? holder.ref
      : undefined;

  return isRef(ref) ? ref : undefined;
};

export type ClassName<S> = string | ((state: S) => string | undefined);

export type RenderOptions<S> = {
  tag: keyof JSX.IntrinsicElements;
  state: S;
  props: object;
  ref?: Ref<Element> | undefined;
  render?: RenderProp<S> | undefined;
  className?: ClassName<S> | undefined;
};

export const usePart = <S>(
  tag: keyof JSX.IntrinsicElements,
  ours: Record<string, unknown>,
  {
    render,
    className,
    ...theirs
  }: {
    render?: RenderProp<S> | undefined;
    className?: ClassName<S> | undefined;
  },
  ref: Ref<HTMLElement> | undefined,
  state: S
): ReactElement => {
  const resolved =
    typeof className === "function" ? className(state) : className;
  const elementRef = isValidElement(render) ? refOf(render) : undefined;
  const merged = useMemo(
    () => (elementRef || (legacy && ref) ? mergeRefs(ref, elementRef) : ref),
    [ref, elementRef]
  );
  const own = { ...mergeProps(ours, theirs), className: resolved, ref: merged };

  if (typeof render === "function") {
    return render(own, state);
  }

  if (isValidElement<Record<string, unknown>>(render)) {
    return createElement(render.type, {
      ...mergeProps(own, render.props),
      key: render.key ?? undefined,
      ref: merged,
    });
  }

  return createElement(tag, own);
};

export const useRender = <S>({
  tag,
  state,
  props,
  ref,
  render,
  className,
}: RenderOptions<S>): ReactElement => {
  const {
    className: base,
    ref: inner,
    ...rest
  }: { className?: unknown; ref?: unknown } = props;
  const resolved =
    typeof className === "function" ? className(state) : className;
  const joined = mergeProps({ className: base }, { className: resolved });
  const outer = isRef(ref) ? ref : undefined;
  const merged = useMemo(() => {
    if (!isRef(inner)) {
      return outer;
    }

    return outer ? mergeRefs(outer, inner) : inner;
  }, [inner, outer]);

  return usePart(
    tag,
    rest,
    {
      className:
        typeof joined.className === "string" ? joined.className : undefined,
      render,
    },
    merged,
    state
  );
};
