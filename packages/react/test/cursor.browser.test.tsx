import "../../core/src/styles.css";
import { createCropper } from "@zriz/core";
import type { Cropper as CropperApi } from "@zriz/core";
import { Suspense, createRef, lazy } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "vitest-browser-react";

import * as Cropper from "../src/cropper";
import { preventZrizHandler } from "../src/merge-props";

const shadowCss = (): string =>
  [...document.styleSheets]
    .flatMap((sheet) => {
      try {
        return [...sheet.cssRules];
      } catch {
        return [];
      }
    })
    .map((rule) => rule.cssText)
    .join("\n");

const EDGES = [
  ["top-left", "nwse-resize"],
  ["top", "ns-resize"],
  ["top-right", "nesw-resize"],
  ["right", "ew-resize"],
  ["bottom-right", "nwse-resize"],
  ["bottom", "ns-resize"],
  ["bottom-left", "nesw-resize"],
  ["left", "ew-resize"],
] as const;

const page = (): string => getComputedStyle(document.body).cursor;

const frames = async (n = 2): Promise<void> => {
  for (let i = 0; i < n; i += 1) {
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }
};

const find = (container: Element, selector: string): HTMLElement => {
  const found = container.querySelector<HTMLElement>(selector);

  if (found === null) {
    throw new Error(selector);
  }

  return found;
};

const Editor = () => (
  <Cropper.Root image={{ height: 300, width: 400 }}>
    <Cropper.Viewport
      style={{ height: 300, padding: 20, position: "relative", width: 400 }}
    >
      <Cropper.Area aria-label="Crop">
        {EDGES.map(([edge]) => (
          <Cropper.Handle key={edge} position={edge} />
        ))}
      </Cropper.Area>
    </Cropper.Viewport>
    <Cropper.Dial aria-label="Straighten" style={{ height: 40, width: 300 }}>
      <Cropper.DialTicks />
    </Cropper.Dial>
  </Cropper.Root>
);

const press = (
  target: Element,
  type: string,
  x: number,
  y: number,
  pointerId = 1
) =>
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      button: 0,
      buttons: 1,
      clientX: x,
      clientY: y,
      pointerId,
      pointerType: "mouse",
    })
  );

describe("cursors", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("a held cursor reaches parts inside a shadow tree, and leaves with the press", async () => {
    const outer = document.createElement("div");

    document.body.append(outer);
    const middle = document.createElement("div");

    outer.attachShadow({ mode: "open" }).append(middle);
    const shadow = middle.attachShadow({ mode: "open" });
    const stylesheet = document.createElement("style");

    stylesheet.textContent = shadowCss();
    const inside = document.createElement("div");

    shadow.append(stylesheet, inside);
    const screen = await render(<Editor />, { container: inside });

    await frames();
    const cursors = (): string[] =>
      [
        find(screen.container, '[data-zriz-item="viewport"]'),
        find(screen.container, '[data-edge="top"]'),
      ].map((element) => getComputedStyle(element).cursor);
    const handle = find(screen.container, '[data-edge="top-left"]');
    const resting = cursors();

    press(handle, "pointerdown", 30, 30);
    expect(cursors()).toStrictEqual(["nwse-resize", "nwse-resize"]);
    press(handle, "pointerup", 30, 30);
    expect(cursors()).toStrictEqual(resting);
    expect(document.adoptedStyleSheets).toHaveLength(0);
    expect(shadow.adoptedStyleSheets).toHaveLength(0);
    outer.remove();
  });

  it("shows resize and grab cursors on the parts and holds the drag's cursor across the page until it lets go", async () => {
    const screen = await render(
      <>
        <Editor />
        <Cropper.Root image={{ height: 300, width: 400 }}>
          <Cropper.Zoom
            aria-label="Zoom"
            style={{ cursor: "pointer", height: 20, width: 200 }}
          />
        </Cropper.Root>
      </>
    );

    await frames();

    const cursorOf = (selector: string): string =>
      getComputedStyle(find(screen.container, selector)).cursor;

    expect([
      ...EDGES.map(([edge]) => cursorOf(`[data-edge="${edge}"]`)),
      cursorOf('[data-zriz-item="viewport"]'),
      cursorOf('[data-zriz-item="dial"]'),
    ]).toStrictEqual([...EDGES.map(([, cursor]) => cursor), "grab", "grab"]);

    const held: string[] = [];

    const drag = (target: Element, end: string, x: number, y: number): void => {
      press(target, "pointerdown", x, y);
      held.push(page());
      press(target, end, x, y);
      held.push(page());
    };

    const at = (selector: string): [Element, number, number] => {
      const target = find(screen.container, selector);
      const box = target.getBoundingClientRect();

      return [
        target,
        box.x + Math.min(5, box.width / 2),
        box.y + Math.min(5, box.height / 2),
      ];
    };

    const [handle, hx, hy] = at('[data-edge="top-right"]');
    const [viewport, vx, vy] = at('[data-zriz-item="viewport"]');
    const [track, tx, ty] = at('[data-zriz-item="zoom"]');

    drag(handle, "pointerup", hx, hy);
    drag(viewport, "pointercancel", vx, vy);
    drag(track, "pointerup", tx + 45, ty);

    expect(held).toStrictEqual([
      "nesw-resize",
      "auto",
      "grabbing",
      "auto",
      "pointer",
      "auto",
    ]);
  });

  it("shows grabbing on the viewport while its own root pans", async () => {
    const api = createRef<CropperApi>();
    const screen = await render(
      <Cropper.Root actionsRef={api} image={{ height: 300, width: 400 }}>
        <Cropper.Viewport style={{ height: 300, width: 400 }} />
      </Cropper.Root>
    );

    await frames();
    api.current?.begin("pan");
    await frames();
    const { cursor } = getComputedStyle(
      find(screen.container, '[data-zriz-item="viewport"]')
    );

    api.current?.end();
    expect(cursor).toBe("grabbing");
  });
});

describe("a gesture whose part goes away", () => {
  afterEach(async () => {
    await cleanup();
  });

  const image = { height: 3000, width: 4000 };
  const parts = [
    ["handle", "resize", '[data-edge="right"]'],
    ["dial", "dial", '[data-zriz-item="dial"]'],
    ["zoom", "zoom-control", '[data-zriz-item="zoom"]'],
    ["area", "keyboard", "[data-testid=area]"],
  ] as const;

  const held = (props: {
    parts?: boolean;
    max?: number;
    edge?: "right" | "left";
  }) => {
    const cropper = createCropper({ image });
    const Tree = (next: typeof props) => (
      <Cropper.Root cropper={cropper}>
        <Cropper.Viewport
          style={{ height: 300, position: "relative", width: 400 }}
        >
          {next.parts === false ? null : (
            <Cropper.Area aria-label="Crop" data-testid="area">
              <Cropper.Handle
                position={next.edge ?? "right"}
                data-edge="right"
              />
            </Cropper.Area>
          )}
        </Cropper.Viewport>
        {next.parts === false ? null : (
          <>
            <Cropper.Dial
              aria-label="Straighten"
              style={{ height: 40, width: 300 }}
            />
            <Cropper.Zoom
              aria-label="Zoom"
              max={next.max ?? 15}
              style={{ height: 20, width: 300 }}
            />
          </>
        )}
      </Cropper.Root>
    );

    return { Tree, cropper };
  };

  it.each(parts)(
    "unmounting the %s mid-gesture frees the cropper and page",
    async (_, reason, selector) => {
      const { cropper, Tree } = held({});
      const screen = await render(<Tree />);

      await frames();
      const part = find(screen.container, selector);
      const sheets = document.adoptedStyleSheets.length;

      if (reason === "keyboard") {
        part.dispatchEvent(
          new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" })
        );
      } else {
        press(part, "pointerdown", 100, 10);
      }

      expect(cropper.getState().interacting).toBe(reason);
      await screen.rerender(<Tree parts={false} />);
      expect(cropper.getState().interacting).toBeNull();
      expect(document.adoptedStyleSheets).toHaveLength(sheets);
      const escape = new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Escape",
      });

      document.body.dispatchEvent(escape);
      expect(escape.defaultPrevented).toBeFalsy();
    }
  );

  it("a prop change mid-drag keeps the drag alive to its own release", async () => {
    const { cropper, Tree } = held({});
    const screen = await render(<Tree max={15} edge="right" />);

    await frames();
    const zoom = find(screen.container, '[data-zriz-item="zoom"]');

    press(zoom, "pointerdown", 100, 10);
    await screen.rerender(<Tree max={10} edge="right" />);
    expect(cropper.getState().interacting).toBe("zoom-control");
    press(zoom, "pointerup", 100, 10);
    expect(cropper.getState().interacting).toBeNull();

    const handle = find(screen.container, '[data-edge="right"]');

    press(handle, "pointerdown", 100, 10);
    await screen.rerender(<Tree max={10} edge="left" />);
    expect(cropper.getState().interacting).toBe("resize");
    press(handle, "pointerup", 100, 10);
    expect(cropper.getState().interacting).toBeNull();
  });

  it.each(["handle", "zoom"])(
    "a suspense hide mid-drag on a %s holds the value and ends the gesture",
    async (part) => {
      const Pending = lazy(
        async () => await new Promise<{ default: () => null }>(() => {})
      );
      const cropper = createCropper({ image });

      type TreeProps = { hide: boolean };

      const Tree = ({ hide }: TreeProps) => (
        <div style={{ paddingLeft: 200, paddingTop: 150 }}>
          <Suspense fallback={null}>
            {hide ? <Pending /> : null}
            <Cropper.Root cropper={cropper}>
              <Cropper.Viewport
                style={{ height: 300, position: "relative", width: 400 }}
              >
                <Cropper.Area aria-label="Crop">
                  <Cropper.Handle position="right" />
                </Cropper.Area>
              </Cropper.Viewport>
              <Cropper.Zoom
                aria-label="Zoom"
                style={{ height: 20, width: 200 }}
              />
            </Cropper.Root>
          </Suspense>
        </div>
      );
      const screen = await render(<Tree hide={false} />);

      await frames();
      const target = find(screen.container, `[data-zriz-item="${part}"]`);
      const box = target.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;

      press(target, "pointerdown", x, y);
      press(target, "pointermove", x - 20, y + 10);
      const before = cropper.getValue();

      expect(before).not.toStrictEqual(createCropper({ image }).getValue());
      await screen.rerender(<Tree hide />);
      await frames();
      expect(cropper.getState().interacting).toBeNull();
      press(target, "pointermove", x - 19, y + 10);
      expect(cropper.getValue()).toStrictEqual(before);
      press(target, "pointerup", x - 19, y + 10);
    }
  );

  it("marks only the handle that owns the drag, and clears the mark when it ends", async () => {
    const cropper = createCropper({ image });
    const screen = await render(
      <Cropper.Root cropper={cropper}>
        <Cropper.Viewport
          style={{ height: 300, position: "relative", width: 400 }}
        >
          <Cropper.Area aria-label="Crop">
            <Cropper.Handle position="left" data-testid="a" />
            <Cropper.Handle position="right" data-testid="b" />
            <Cropper.Handle position="top" data-testid="c" />
          </Cropper.Area>
        </Cropper.Viewport>
      </Cropper.Root>
    );

    await frames();
    const [a, b, c] = ["a", "b", "c"].map((id) =>
      find(screen.container, `[data-testid=${id}]`)
    );
    const active = (): boolean[] =>
      [a, b, c].map((handle) => Object.hasOwn(handle?.dataset ?? {}, "active"));

    if (!(a && b && c)) {
      throw new Error("no handles");
    }

    press(a, "pointerdown", 10, 10);
    press(b, "pointerdown", 20, 10, 2);
    press(c, "pointerdown", 30, 10, 3);
    await frames();
    expect(active()).toStrictEqual([true, true, false]);
    press(c, "pointerup", 30, 10, 3);
    press(b, "pointerup", 20, 10, 2);
    await frames();
    expect(active()).toStrictEqual([true, false, false]);
    press(a, "pointerup", 10, 10);
    await frames();
    expect(active()).toStrictEqual([false, false, false]);
    press(c, "pointerdown", 30, 10);
    await frames();
    expect(active()).toStrictEqual([false, false, true]);
    press(c, "pointerup", 30, 10);
    await frames();
    press(a, "pointerdown", 10, 10);
    await frames();
    expect(active()).toStrictEqual([true, false, false]);
    press(a, "pointerup", 10, 10);
  });

  it("a key from a child input is left alone", async () => {
    const cropper = createCropper({ image });
    const screen = await render(
      <Cropper.Root cropper={cropper}>
        <Cropper.Area aria-label="Crop" data-testid="area">
          <input data-testid="input" />
        </Cropper.Area>
      </Cropper.Root>
    );

    cropper.setRotation(7);
    const input = screen.container.querySelector("[data-testid=input]");
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "0",
    });

    input?.dispatchEvent(event);
    expect(event.defaultPrevented).toBeFalsy();
    expect(cropper.getValue().rotation).toBe(7);
    const area = screen.container.querySelector("[data-testid=area]");

    area?.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "0" })
    );

    expect(cropper.getValue().rotation).toBe(0);

    area?.dispatchEvent(
      new KeyboardEvent("keyup", { bubbles: true, key: "0" })
    );
  });

  it("a press vetoed on a handle or the viewport starts no gesture", async () => {
    const cropper = createCropper({ image });
    const screen = await render(
      <Cropper.Root cropper={cropper}>
        <Cropper.Viewport
          data-testid="v"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) {
              preventZrizHandler(event);
            }
          }}
          style={{ height: 300, position: "relative", width: 400 }}
        >
          <Cropper.Area aria-label="Crop">
            <Cropper.Handle
              data-testid="h"
              onPointerDown={(event) => {
                preventZrizHandler(event);
              }}
              position="right"
            />
          </Cropper.Area>
        </Cropper.Viewport>
      </Cropper.Root>
    );

    await frames();
    press(find(screen.container, "[data-testid=h]"), "pointerdown", 10, 10);
    expect(cropper.getState().interacting).toBeNull();
    press(find(screen.container, "[data-testid=h]"), "pointerup", 10, 10);
    const before = cropper.getValue();

    press(find(screen.container, "[data-testid=v]"), "pointerdown", 200, 150);
    expect(cropper.getState().interacting).toBeNull();
    press(find(screen.container, "[data-testid=v]"), "pointermove", 240, 150);
    expect(cropper.getValue()).toBe(before);
    press(find(screen.container, "[data-testid=v]"), "pointerup", 240, 150);
  });
});
