"use client";

import { createElement, isValidElement, useMemo } from "react";
import type { ReactElement, Ref } from "react";

import { mergeProps, mergeRefs } from "./merge-props";

export type RenderProp<S> =
  | ReactElement
  | ((props: Record<string, unknown>, state: S) => ReactElement);

export type ClassName<S> = string | ((state: S) => string | undefined);

export interface RenderOptions<S> {
  tag: keyof React.JSX.IntrinsicElements;
  state: S;
  props: Record<string, unknown>;
  ref?: Ref<HTMLElement> | undefined;
  render?: RenderProp<S> | undefined;
  className?: ClassName<S> | undefined;
}

export const useRender = <S>({
  tag,
  state,
  props,
  ref,
  render,
  className,
}: RenderOptions<S>): ReactElement => {
  const resolved =
    typeof className === "function" ? className(state) : className;
  const elementRef = isValidElement<{ ref?: Ref<HTMLElement> }>(render)
    ? render.props.ref
    : undefined;
  const merged = useMemo(
    () => (elementRef ? mergeRefs(ref, elementRef) : ref),
    [ref, elementRef]
  );
  const own = { ...props, className: resolved, ref: merged };
  if (typeof render === "function") {
    return render(own, state);
  }
  if (isValidElement<Record<string, unknown>>(render)) {
    return createElement(render.type, {
      ...mergeProps(own, render.props),
      key: render.key,
      ref: merged,
    });
  }
  return createElement(tag, own);
};
