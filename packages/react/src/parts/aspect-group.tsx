"use client";

import type { Aspect } from "@zriz/core";
import { forwardRef, useCallback } from "react";
import type { KeyboardEvent } from "react";

import { AspectGroupContext } from "../aspect-group-context";
import { useCropperContext } from "../context";
import { useElementBox, useMergedRef } from "../part";
import type { Part, PartProps } from "../part";
import { useCropperState } from "../use-cropper";
import { usePart } from "../use-render";

type AspectGroupState = {
  aspect: Aspect;
};

type AspectGroupProps = PartProps<"div", AspectGroupState>;

const ITEM_SELECTOR = '[data-zriz-item="aspect-item"]';

const itemsOf = (group: Element): HTMLElement[] =>
  [...group.querySelectorAll<HTMLElement>(ITEM_SELECTOR)].filter(
    (item) =>
      item.closest('[data-zriz-item="aspect-group"]') === group &&
      !item.matches(":disabled,[data-disabled]")
  );

const syncStop = (group: Element): void => {
  const enabled = itemsOf(group);
  const checked = enabled.find(
    (item) => item.getAttribute("aria-checked") === "true"
  );

  for (const item of enabled) {
    item.tabIndex = item === (checked ?? enabled[0]) ? 0 : -1;
  }
};

const ARROW_STEPS: Partial<Record<string, number>> = {
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -1,
};

const AspectGroup: Part<AspectGroupProps, HTMLDivElement> = forwardRef<
  HTMLDivElement,
  AspectGroupProps
>(function AspectGroup(props, ref) {
  const cropper = useCropperContext();
  const aspect = useCropperState((s) => s.aspect);
  const box = useElementBox();
  const own = useCallback(
    (group: HTMLDivElement) => {
      const clear = box.set(group);

      syncStop(group);
      const observer = new MutationObserver(() => {
        syncStop(group);
      });

      observer.observe(group, {
        attributeFilter: ["aria-checked", "data-disabled", "disabled"],
        attributes: true,
        childList: true,
        subtree: true,
      });

      return () => {
        observer.disconnect();
        clear();
      };
    },
    [box]
  );

  const onKeyDown = (event: KeyboardEvent): void => {
    const element = box.get();
    const { disabled, ready } = cropper.getState();

    if (
      !element ||
      disabled ||
      !ready ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }

    const enabled = itemsOf(element);
    const index = (enabled as readonly EventTarget[]).indexOf(event.target);

    if (index === -1) {
      return;
    }

    let next: number;

    if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = enabled.length - 1;
    } else {
      const step = ARROW_STEPS[event.key];

      if (step === undefined) {
        return;
      }

      const flip =
        (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
        getComputedStyle(element).direction === "rtl";

      next = (index + (flip ? -step : step) + enabled.length) % enabled.length;
    }

    event.preventDefault();
    const item = enabled[next];

    item?.focus();
    item?.click();
  };

  const element = usePart(
    "div",
    { "data-zriz-item": "aspect-group", onKeyDown, role: "radiogroup" },
    props,
    useMergedRef(own, ref),
    { aspect }
  );

  return (
    <AspectGroupContext.Provider value>{element}</AspectGroupContext.Provider>
  );
});

export type { AspectGroupProps, AspectGroupState };
export { AspectGroup };
