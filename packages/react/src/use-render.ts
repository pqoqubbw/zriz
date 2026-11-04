"use client";

import { createElement, isValidElement, useMemo, version } from "react";
import type { JSX, ReactElement, Ref } from "react";

import { mergeProps, mergeRefs } from "./merge-props";

export type RenderProp<S> =
  | ReactElement
  | ((props: Record<string, unknown>, state: S) => ReactElement);

const legacy = Number(version.slice(0, version.indexOf("."))) < 19;

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

export interface RenderOptions<S> {
  tag: keyof JSX.IntrinsicElements;
  state: S;
  props: Record<string, unknown>;
  ref?: Ref<HTMLElement> | undefined;
  render?: RenderProp<S> | undefined;
  className?: ClassName<S> | undefined;
}

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
    () => (elementRef ? mergeRefs(ref, elementRef) : ref),
    [ref, elementRef]
  );
  const own = { ...mergeProps(ours, theirs), className: resolved, ref: merged };
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

export const useRender = <S>({
  tag,
  state,
  props,
  ref,
  render,
  className,
}: RenderOptions<S>): ReactElement =>
  usePart(tag, props, { className, render }, ref, state);
