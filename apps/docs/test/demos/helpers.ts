import { createElement } from "react";
import type { ComponentType, ReactNode } from "react";
import { expect } from "vitest";
import { cleanup, render } from "vitest-browser-react";

import "../../app/globals.css";

import { Demo } from "../../components/doc/demo";
import { Panel } from "../../components/ui/panel";
import type { PanelProps } from "../../components/ui/panel";
import type { DemoName } from "../../demos/registry";
import { Frame } from "../../demos/shell/frame";
import { DEMO_SIZES } from "../../demos/shell/sizes";
import type { DemoWidth } from "../../demos/shell/sizes";

type Box = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type ColumnProps = {
  children?: ReactNode;
  width: DemoWidth;
};

type Side = "bottom" | "left" | "right" | "top";

const ALL_SIDES: readonly Side[] = ["top", "right", "bottom", "left"];

const REACH = 21.5;

const TIMEOUT = 15_000;

const Column = ({ children, width }: ColumnProps) =>
  createElement(
    "div",
    { style: { width: DEMO_SIZES[width].column } },
    children
  );

const inColumn = (width: DemoWidth, children: ReactNode) =>
  createElement(Column, { width }, children);

const inPanel = (name: DemoName, children: ReactNode) => {
  const props: PanelProps & { "data-demo": DemoName } = {
    className: "@container flex flex-col items-center p-1",
    "data-demo": name,
    radius: "demo",
  };

  return createElement(Panel, props, children);
};

const mountDemo = async (name: DemoName, width: DemoWidth = "desktop") =>
  await render(inColumn(width, createElement(Demo, { className: "", name })));

const mountFrame = async (name: DemoName, width: DemoWidth = "desktop") =>
  await render(inColumn(width, inPanel(name, createElement(Frame, { name }))));

const mountLive = async (
  Live: ComponentType,
  name: DemoName,
  width: DemoWidth = "desktop"
) => await render(inColumn(width, inPanel(name, createElement(Live))));

const find = (selector: string, root: ParentNode = document): HTMLElement => {
  const found = root.querySelector<HTMLElement>(selector);

  if (!found) {
    throw new Error(`no ${selector}`);
  }

  return found;
};

const item = (name: string): string => `[data-zriz-item="${name}"]`;

const button = (label: string, root: ParentNode = document): HTMLElement =>
  find(`button[aria-label="${label}"]`, root);

const ready = async (): Promise<void> => {
  await expect
    .poll(() => document.querySelector(`${item("image")}[data-ready]`), {
      timeout: TIMEOUT,
    })
    .not.toBeNull();

  await expect
    .poll(() => document.querySelector(`${item("area")}[data-visible]`), {
      timeout: TIMEOUT,
    })
    .not.toBeNull();
};

const frames = async (count: number): Promise<void> => {
  const start = performance.now();

  await expect
    .poll(() => performance.now() - start > count * 16, { interval: 16 })
    .toBeTruthy();
};

const settle = async (): Promise<void> => {
  await frames(6);

  await expect
    .poll(() => document.querySelector(`${item("root")}[data-settling]`), {
      timeout: TIMEOUT,
    })
    .toBeNull();

  await expect
    .poll(() => document.querySelector(`${item("root")}[data-interacting]`), {
      timeout: TIMEOUT,
    })
    .toBeNull();
};

const boxIn = (element: Element, panel: Element): Box => {
  const own = element.getBoundingClientRect();
  const base = panel.getBoundingClientRect();

  return {
    height: own.height,
    width: own.width,
    x: own.left - base.left,
    y: own.top - base.top,
  };
};

const FRAME_PARTS = [
  '[data-slot="stage"]',
  '[data-slot="corner-start"] > :first-child',
  '[data-slot="corner-end"] > :last-child',
  '[data-slot="zone"]',
  '[data-slot="zone-row"] > *',
  '[data-slot="ruler"]',
  '[data-slot="value"]',
  '[data-slot="track"]',
] as const;

const layoutOf = (): string[] => {
  const panel = find("[data-demo]");
  const { height, width } = panel.getBoundingClientRect();
  const out = [`panel ${width.toFixed(1)}x${height.toFixed(1)}`];

  for (const selector of FRAME_PARTS) {
    for (const [index, element] of [
      ...panel.querySelectorAll(selector),
    ].entries()) {
      const box = boxIn(element, panel);

      out.push(
        `${selector} ${index} ${box.x.toFixed(1)} ${box.y.toFixed(1)} ${box.width.toFixed(1)} ${box.height.toFixed(1)}`
      );
    }
  }

  return out;
};

const frameLayout = async (
  name: DemoName,
  width: DemoWidth = "desktop"
): Promise<string[]> => {
  await mountFrame(name, width);

  const layout = layoutOf();

  await cleanup();

  return layout;
};

const hits = (target: Element, sides: readonly Side[] = ALL_SIDES): boolean => {
  const box = target.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const at: Record<Side, readonly [number, number]> = {
    bottom: [x, y + REACH],
    left: [x - REACH, y],
    right: [x + REACH, y],
    top: [x, y - REACH],
  };

  return sides.every((side) => {
    const [px, py] = at[side];
    const hit = document.elementFromPoint(px, py);

    return hit !== null && (hit === target || target.contains(hit));
  });
};

export type { Side };
export {
  button,
  find,
  frameLayout,
  hits,
  item,
  layoutOf,
  mountDemo,
  mountLive,
  ready,
  settle,
};
