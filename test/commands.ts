import type { BrowserCommand } from "vitest/node";

type Path = readonly (readonly [number, number, number?])[];

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
