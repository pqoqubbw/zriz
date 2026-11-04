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

const press = (target: Element, type: string, x: number, y: number) =>
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      button: 0,
      buttons: 1,
      clientX: x,
      clientY: y,
      pointerId: 1,
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

  it("a zoom drag holds a cursor the page gave the track", async () => {
    const screen = await render(
      <Cropper.Root image={{ height: 300, width: 400 }}>
        <Cropper.Zoom
          aria-label="Zoom"
          style={{ cursor: "pointer", height: 20, width: 200 }}
        />
      </Cropper.Root>
    );

    await frames();
    const track = find(screen.container, '[role="slider"]');
    const box = track.getBoundingClientRect();

    press(track, "pointerdown", box.x + 50, box.y + 5);
    expect(document.adoptedStyleSheets).toHaveLength(1);
    press(track, "pointerup", box.x + 50, box.y + 5);
    expect(document.adoptedStyleSheets).toHaveLength(0);
  });

  it("shows a resize cursor on every handle and grab on the photo and dial", async () => {
    const screen = await render(<Editor />);

    await frames();

    const cursorOf = (selector: string): string => {
      const element = screen.container.querySelector(selector);

      return element ? getComputedStyle(element).cursor : "";
    };

    expect(
      EDGES.map(([edge]) => cursorOf(`[data-edge="${edge}"]`))
    ).toStrictEqual(EDGES.map(([, cursor]) => cursor));

    expect(cursorOf('[data-zriz-item="viewport"]')).toBe("grab");
    expect(cursorOf('[data-zriz-item="dial"]')).toBe("grab");
  });

  it("leaves a page's own gesture and edge attributes alone", async () => {
    const screen = await render(
      <div data-panning="" data-pinching="">
        <Editor />
        <div data-edge="left" id="page-edge">
          <span />
        </div>
      </div>
    );

    await frames();

    expect(
      getComputedStyle(find(screen.container, '[data-zriz-item="viewport"]'))
        .cursor
    ).toBe("grab");

    expect(getComputedStyle(find(screen.container, "#page-edge")).cursor).toBe(
      "auto"
    );
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

  it("keeps the cursor across the page during a drag and lets go after", async () => {
    const screen = await render(<Editor />);

    await frames();
    const handle = screen.container.querySelector('[data-edge="top-right"]');

    if (!handle) {
      throw new Error("no handle");
    }

    const box = handle.getBoundingClientRect();
    const sheets = document.adoptedStyleSheets.length;

    press(handle, "pointerdown", box.x + box.width / 2, box.y + box.height / 2);
    expect(getComputedStyle(document.body).cursor).toBe("nesw-resize");
    press(handle, "pointerup", box.x, box.y);
    expect(document.adoptedStyleSheets).toHaveLength(sheets);
    expect(getComputedStyle(document.body).cursor).toBe("auto");
  });

  it("holds grabbing while the photo is dragged", async () => {
    const screen = await render(<Editor />);

    await frames();
    const viewport = screen.container.querySelector(
      '[data-zriz-item="viewport"]'
    );

    if (!viewport) {
      throw new Error("no viewport");
    }

    const box = viewport.getBoundingClientRect();

    press(viewport, "pointerdown", box.x + 5, box.y + 5);
    expect(getComputedStyle(document.body).cursor).toBe("grabbing");
    press(viewport, "pointercancel", box.x + 5, box.y + 5);
    expect(getComputedStyle(document.body).cursor).toBe("auto");
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
  ] as const;

  const held = (props: {
    dial?: boolean;
    max?: number;
    edge?: "right" | "left";
  }) => {
    const cropper = createCropper({ image });
    const Tree = (next: typeof props) => (
      <Cropper.Root cropper={cropper}>
        <Cropper.Viewport
          style={{ height: 300, position: "relative", width: 400 }}
        >
          <Cropper.Area aria-label="Crop">
            {next.dial === false ? null : (
              <Cropper.Handle
                position={next.edge ?? "right"}
                data-edge="right"
              />
            )}
          </Cropper.Area>
        </Cropper.Viewport>
        {next.dial === false ? null : (
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
    "unmounting the %s mid-drag frees the cropper and page",
    async (_, reason, selector) => {
      const { cropper, Tree } = held({});
      const screen = await render(<Tree />);

      await frames();
      const part = find(screen.container, selector);
      const sheets = document.adoptedStyleSheets.length;

      press(part, "pointerdown", 100, 10);
      expect(cropper.getState().interacting).toBe(reason);
      await screen.rerender(<Tree dial={false} />);
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

  it("a key held on an area that unmounts ends the key gesture", async () => {
    const cropper = createCropper({ image });

    type TreeProps = { area?: boolean };

    const Tree = ({ area = true }: TreeProps) => (
      <Cropper.Root cropper={cropper}>
        {area ? <Cropper.Area aria-label="Crop" data-testid="area" /> : null}
      </Cropper.Root>
    );
    const screen = await render(<Tree />);

    screen.container
      .querySelector("[data-testid=area]")
      ?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" })
      );

    expect(cropper.getState().interacting).toBe("keyboard");
    await screen.rerender(<Tree area={false} />);
    expect(cropper.getState().interacting).toBeNull();
  });

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

  it("a suspense hide mid-drag holds the value and ends the gesture", async () => {
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
                <Cropper.Handle data-edge="right" position="right" />
              </Cropper.Area>
            </Cropper.Viewport>
          </Cropper.Root>
        </Suspense>
      </div>
    );
    const screen = await render(<Tree hide={false} />);

    await frames();
    const handle = find(screen.container, '[data-edge="right"]');
    const box = handle.getBoundingClientRect();

    press(handle, "pointerdown", box.x + 22, box.y + 22);
    press(handle, "pointermove", box.x - 18, box.y + 22);
    const before = cropper.getValue();

    await screen.rerender(<Tree hide />);
    expect(cropper.getState().interacting).toBeNull();
    press(handle, "pointermove", box.x - 17, box.y + 22);
    expect(cropper.getValue()).toBe(before);
  });

  it("a failed press does not light up a second handle", async () => {
    const cropper = createCropper({ image });
    const screen = await render(
      <Cropper.Root cropper={cropper}>
        <Cropper.Viewport
          style={{ height: 300, position: "relative", width: 400 }}
        >
          <Cropper.Area aria-label="Crop">
            <Cropper.Handle position="left" data-testid="a" />
            <Cropper.Handle position="right" data-testid="b" />
          </Cropper.Area>
        </Cropper.Viewport>
      </Cropper.Root>
    );

    await frames();
    const a = find(screen.container, "[data-testid=a]");
    const b = find(screen.container, "[data-testid=b]");

    press(a, "pointerdown", 10, 10);

    b.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        buttons: 1,
        clientX: 20,
        pointerId: 2,
        pointerType: "mouse",
      })
    );

    await frames();
    expect(Object.hasOwn(b.dataset, "active")).toBeFalsy();
    expect(Object.hasOwn(a.dataset, "active")).toBeTruthy();
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

  it("a press vetoed on a handle does not start a pan under it", async () => {
    const cropper = createCropper({ image });
    const screen = await render(
      <Cropper.Root cropper={cropper}>
        <Cropper.Viewport
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
  });

  it("root opts out of a swipe-to-dismiss drawer around it", async () => {
    const screen = await render(<Editor />);

    expect(
      Object.hasOwn(
        find(screen.container, '[data-zriz-item="root"]').dataset,
        "baseUiSwipeIgnore"
      )
    ).toBeTruthy();
  });
});
