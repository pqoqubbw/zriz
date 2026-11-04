import nodePath from "node:path";

import type { BrowserCommand } from "vitest/node";

type Path = readonly (readonly [number, number, number?])[];

declare module "vitest/browser" {
  interface BrowserCommands {
    drag: (selector: string, path: Path) => Promise<void>;
    forcedColors: (mode: "active" | "none") => Promise<void>;
    gc: () => Promise<void>;
    hold: (selector: string, x: number, y: number) => Promise<void>;
    pinch: (
      selector: string,
      a: Path,
      b: Path,
      release: boolean
    ) => Promise<void>;
    release: () => Promise<void>;
    touch: (selector: string, path: Path) => Promise<void>;
  }
}

declare global {
  interface Window {
    File: typeof File;
    ResizeObserver: typeof ResizeObserver;
  }
}

interface Origin {
  x: number;
  y: number;
}

const origin = async (
  context: Parameters<BrowserCommand>[0],
  selector: string
): Promise<Origin> => {
  if (!("frame" in context)) {
    throw new Error("playwright only");
  }
  const frame = await context.frame();
  const box = await frame.locator(selector).boundingBox();
  if (!box) {
    throw new Error(`no box for ${selector}`);
  }
  return { x: box.x, y: box.y };
};

export const forcedColors: BrowserCommand<[mode: "active" | "none"]> = async (
  context,
  mode
) => {
  if (!("page" in context)) {
    throw new Error("playwright only");
  }
  await context.page.emulateMedia({ forcedColors: mode });
};

export const gc: BrowserCommand = async (context) => {
  if (!("page" in context)) {
    throw new Error("playwright only");
  }
  await context.page.requestGC();
};

export const drag: BrowserCommand<[selector: string, path: Path]> = async (
  context,
  selector,
  path
) => {
  if (!("page" in context)) {
    throw new Error("playwright only");
  }
  const at = await origin(context, selector);
  const { mouse } = context.page;
  const [first, ...rest] = path;
  if (!first) {
    return;
  }
  await mouse.move(at.x + first[0], at.y + first[1]);
  await mouse.down();
  for (const [x, y, pause] of rest) {
    if (pause !== undefined) {
      await new Promise((resolve) => {
        setTimeout(resolve, pause);
      });
    }
    await mouse.move(at.x + x, at.y + y);
  }
  await mouse.up();
};

export const pinch: BrowserCommand<
  [selector: string, a: Path, b: Path, release: boolean]
> = async (context, selector, a, b, release) => {
  if (
    !("page" in context) ||
    context.page.context().browser()?.browserType().name() !== "chromium"
  ) {
    throw new Error("chromium only");
  }
  const at = await origin(context, selector);
  const session = await context.page.context().newCDPSession(context.page);
  const points = (i: number) =>
    [a[i], b[i]].map((p, id) => ({
      id,
      x: at.x + (p?.[0] ?? 0),
      y: at.y + (p?.[1] ?? 0),
    }));
  await session.send("Input.dispatchTouchEvent", {
    touchPoints: points(0),
    type: "touchStart",
  });
  for (let i = 1; i < a.length; i += 1) {
    await session.send("Input.dispatchTouchEvent", {
      touchPoints: points(i),
      type: "touchMove",
    });
  }
  if (release) {
    await session.send("Input.dispatchTouchEvent", {
      touchPoints: [],
      type: "touchEnd",
    });
  }
  await session.detach();
};

export const touch: BrowserCommand<[selector: string, path: Path]> = async (
  context,
  selector,
  path
) => {
  if (
    !("page" in context) ||
    context.page.context().browser()?.browserType().name() !== "chromium"
  ) {
    throw new Error("chromium only");
  }
  const at = await origin(context, selector);
  const session = await context.page.context().newCDPSession(context.page);
  const point = (p: readonly [number, number, number?]) => [
    { id: 0, x: at.x + p[0], y: at.y + p[1] },
  ];
  const [first, ...rest] = path;
  if (!first) {
    return;
  }
  await session.send("Input.dispatchTouchEvent", {
    touchPoints: point(first),
    type: "touchStart",
  });
  for (const p of rest) {
    await session.send("Input.dispatchTouchEvent", {
      touchPoints: point(p),
      type: "touchMove",
    });
  }
  await session.send("Input.dispatchTouchEvent", {
    touchPoints: [],
    type: "touchEnd",
  });
  await session.detach();
};

export const choose: BrowserCommand<[selector: string, file: string]> = async (
  context,
  selector,
  file
) => {
  if (!("frame" in context)) {
    throw new Error("playwright only");
  }
  const frame = await context.frame();
  const [chooser] = await Promise.all([
    context.page.waitForEvent("filechooser"),
    frame.locator(selector).click(),
  ]);
  await chooser.setFiles(nodePath.resolve(context.project.config.root, file));
};

export const hold: BrowserCommand<
  [selector: string, x: number, y: number]
> = async (context, selector, x, y) => {
  if (!("page" in context)) {
    throw new Error("playwright only");
  }
  const at = await origin(context, selector);
  await context.page.mouse.move(at.x + x, at.y + y);
  await context.page.mouse.down();
  await context.page.mouse.move(at.x + x + 15, at.y + y);
  await context.page.mouse.move(at.x + x + 30, at.y + y);
};

export const release: BrowserCommand = async (context) => {
  if (!("page" in context)) {
    throw new Error("playwright only");
  }
  await context.page.mouse.up();
};
