import "../../core/src/styles.css";
import type { Cropper as CropperApi } from "@zriz/core";
import { createRef } from "react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";

import type { RootProps } from "../src";
import * as Cropper from "../src/cropper";

const frames = async (n = 3): Promise<void> => {
  for (let i = 0; i < n; i += 1) {
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }
};

const mount = async (children: ReactNode, props: Partial<RootProps> = {}) => {
  const ref = createRef<CropperApi>();
  const screen = await render(
    <Cropper.Root
      actionsRef={ref}
      image={{ height: 300, width: 400 }}
      {...props}
    >
      {children}
    </Cropper.Root>
  );

  await frames();

  const pick = (item: string): HTMLElement => {
    const found = screen.container.querySelector<HTMLElement>(
      `[data-zriz-item="${item}"]`
    );

    if (!found) {
      throw new Error(`missing ${item}`);
    }

    return found;
  };

  const api = (): CropperApi => {
    if (!ref.current) {
      throw new Error("no cropper");
    }

    return ref.current;
  };

  return { api, pick, root: pick("root"), screen };
};

const pointer = (target: Element, type: string, x: number): void => {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      button: 0,
      buttons: 1,
      cancelable: true,
      clientX: x,
      clientY: 10,
      composed: true,
      pointerId: 1,
      pointerType: "mouse",
    })
  );
};

const round = (value: number): number => Math.round(value * 1e6) / 1e6;

const dragging = (part: Element): [Element, string] => [part, "data-dragging"];

const on = (element: Element, attribute: string): boolean =>
  element.hasAttribute(attribute);

const selectable = (element: Element): string => {
  const style = getComputedStyle(element);

  return (
    style.getPropertyValue("user-select") ||
    style.getPropertyValue("-webkit-user-select")
  );
};

const MotionHost = ({ motion }: Pick<RootProps, "motion">) => (
  <Cropper.Root image={{ height: 300, width: 400 }} motion={motion} />
);

describe("a second viewport", () => {
  afterEach(async () => {
    await cleanup();
    vi.restoreAllMocks();
  });

  it("warns in development when two viewports with a size share a cropper", async () => {
    const warn = vi.spyOn(console, "warn").mockReturnValue(undefined);

    await render(
      <div style={{ height: 200, width: 200 }}>
        <Cropper.Root>
          <Cropper.Viewport style={{ height: 100 }} />
          <Cropper.Viewport style={{ display: "none" }} />
        </Cropper.Root>
      </div>
    );

    expect(warn).not.toHaveBeenCalled();
    await cleanup();

    await render(
      <div style={{ height: 200, width: 200 }}>
        <Cropper.Root>
          <Cropper.Viewport style={{ height: 100 }} />
          <Cropper.Viewport style={{ height: 50 }} />
        </Cropper.Root>
      </div>
    );

    expect(warn.mock.calls.flat().join(",")).toContain(
      "one <Cropper.Viewport>"
    );
  });
});

describe("presses on touch", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("stops double-tap zoom and text selection on every button part, the dial value and the sliders", async () => {
    const { pick } = await mount(
      <>
        <Cropper.Rotate>Rotate</Cropper.Rotate>
        <Cropper.Flip>Flip</Cropper.Flip>
        <Cropper.Reset hidden={false}>Reset</Cropper.Reset>
        <Cropper.ZoomStep factor={2}>In</Cropper.ZoomStep>
        <Cropper.AspectItem value={1}>Square</Cropper.AspectItem>
        <Cropper.Orientation>Swap</Cropper.Orientation>
        <Cropper.DialValue />
        <Cropper.Dial aria-label="Dial" />
        <Cropper.Zoom aria-label="Zoom" />
      </>
    );

    const buttons = [...document.querySelectorAll("button")];

    expect(buttons).toHaveLength(6);

    for (const button of buttons) {
      expect(getComputedStyle(button).touchAction).toBe("manipulation");
      expect(selectable(button)).toBe("none");
    }

    expect(selectable(pick("dial-value"))).toBe("none");

    for (const name of ["dial", "zoom"]) {
      const { style } = pick(name);

      expect(style.getPropertyValue("user-select")).toBe("none");
      expect(style.getPropertyValue("-webkit-user-select")).toBe("none");
    }
  });

  it("lets a style of the caller replace the press style", async () => {
    const { pick } = await mount(
      <Cropper.Flip style={{ color: "red", touchAction: "auto" }}>
        Flip
      </Cropper.Flip>
    );
    const button = pick("flip");

    expect(getComputedStyle(button).touchAction).toBe("auto");
    expect(button.style.color).toBe("red");
    expect(selectable(button)).toBe("none");
  });
});

describe("buttons and state attributes", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("Flip mirrors on click, aria-pressed and data-mirrored follow, and axis y keeps the mirror's axis", async () => {
    const { api, pick, root } = await mount(<Cropper.Flip>flip</Cropper.Flip>);
    const button = pick("flip");
    const read = () => ({
      button: on(button, "data-mirrored"),
      mirrored: api().getValue().mirrored,
      pressed: button.getAttribute("aria-pressed"),
      root: on(root, "data-mirrored"),
    });
    const off = {
      button: false,
      mirrored: false,
      pressed: "false",
      root: false,
    };

    expect(read()).toStrictEqual(off);
    button.click();
    await frames();

    expect(read()).toStrictEqual({
      button: true,
      mirrored: true,
      pressed: "true",
      root: true,
    });

    button.click();
    await frames();
    expect(read()).toStrictEqual(off);
    await cleanup();

    const y = await mount(<Cropper.Flip axis="y">flip</Cropper.Flip>);
    const before = y.api().getValue().quarterTurns;

    y.pick("flip").click();
    await frames();
    expect(y.api().getValue().mirrored).toBeTruthy();
    expect(y.api().getValue().quarterTurns).not.toBe(before);
  });

  it("Reset undoes a change on click and hides itself", async () => {
    const { api, pick, root } = await mount(
      <Cropper.Reset>reset</Cropper.Reset>
    );
    const button = pick("reset");
    const read = () => ({
      changed: on(root, "data-changed"),
      hidden: button.hidden,
      pristine: on(button, "data-pristine"),
    });
    const clean = { changed: false, hidden: true, pristine: true };

    expect(read()).toStrictEqual(clean);
    api().setRotation(9);
    await frames();

    expect(read()).toStrictEqual({
      changed: true,
      hidden: false,
      pristine: false,
    });

    button.click();
    await frames();
    expect(api().getValue().rotation).toBe(0);
    expect(read()).toStrictEqual(clean);
  });

  it("ZoomStep and Orientation report their own reason", async () => {
    const reasons: string[] = [];
    const { api, pick, screen } = await mount(
      <>
        <Cropper.ZoomStep factor={2}>in</Cropper.ZoomStep>
        <Cropper.ZoomStep factor={0.5}>out</Cropper.ZoomStep>
        <Cropper.Orientation>turn</Cropper.Orientation>
      </>,
      {
        aspect: 16 / 9,
        onValueChange: (_, details) => {
          reasons.push(details.reason);
        },
      }
    );
    const [zoomIn, zoomOut] = screen.container.querySelectorAll<HTMLElement>(
      '[data-zriz-item="zoom-step"]'
    );

    zoomIn?.click();
    await frames();

    expect([round(api().getZoom()), reasons.at(-1)]).toStrictEqual([
      2,
      "zoom-control",
    ]);

    zoomOut?.click();
    await frames();
    expect(api().getZoom()).toBeCloseTo(1, 6);
    reasons.length = 0;
    pick("orientation").click();
    await frames(4);
    expect(api().getValue().aspect).toBeCloseTo(9 / 16, 6);
    expect([...new Set(reasons)]).toStrictEqual(["orientation"]);
  });

  it("AspectItem outside a group is a pressed button with no tab trick", async () => {
    const { api, pick } = await mount(
      <Cropper.AspectItem value={1}>square</Cropper.AspectItem>
    );
    const item = pick("aspect-item");
    const read = () => ({
      checked: item.getAttribute("aria-checked"),
      marked: on(item, "data-checked"),
      pressed: item.getAttribute("aria-pressed"),
      role: item.getAttribute("role"),
      tabIndex: item.getAttribute("tabindex"),
    });
    const plain = { checked: null, role: null, tabIndex: null };

    expect(read()).toStrictEqual({ ...plain, marked: false, pressed: "false" });
    item.click();
    await frames();
    expect(api().getValue().aspect).toBe(1);
    expect(read()).toStrictEqual({ ...plain, marked: true, pressed: "true" });
  });

  it("Grid shows only while on, draws the fine lines for the dial and keeps them while it fades", async () => {
    const { api, pick } = await mount(<Cropper.Grid />);
    const grid = pick("grid");
    const read = () => ({
      coarse: grid.querySelectorAll("[data-coarse]").length,
      fine: grid.children.length > 4,
      grid: grid.dataset.grid,
    });

    expect([
      grid.children.length,
      getComputedStyle(grid).opacity,
    ]).toStrictEqual([4, "0"]);

    api().begin("dial");
    await frames();
    expect(read()).toStrictEqual({ coarse: 4, fine: false, grid: "none" });
    api().setRotation(2, { reason: "dial" });
    await frames();

    expect({ ...read(), visible: on(grid, "data-visible") }).toStrictEqual({
      coarse: 0,
      fine: true,
      grid: "fine",
      visible: true,
    });

    api().end();
    await frames();
    expect(read()).toStrictEqual({ coarse: 0, fine: true, grid: "none" });
    api().begin("pan");
    await frames();

    expect({ ...read(), visible: on(grid, "data-visible") }).toStrictEqual({
      coarse: 4,
      fine: false,
      grid: "coarse",
      visible: true,
    });

    api().end();
  });

  it("Dial and Zoom show data-dragging only while a pointer drags them", async () => {
    const { pick, root } = await mount(
      <>
        <Cropper.Dial aria-label="Straighten" />
        <Cropper.Zoom aria-label="Zoom" />
      </>
    );
    const dial = pick("dial");
    const zoom = pick("zoom");
    const seen: string[] = [];

    const note = (...flags: [Element, string][]) => {
      seen.push(
        flags
          .filter(([element, name]) => on(element, name))
          .map(
            ([element, name]) => `${element === root ? "root" : "part"} ${name}`
          )
          .join(", ")
      );
    };

    pointer(dial, "pointerdown", 100);
    await frames();
    note(dragging(dial), [root, "data-rotating"]);
    pointer(dial, "pointermove", 150);
    await frames();
    note(dragging(dial));
    pointer(dial, "pointerup", 150);
    await frames();
    note(dragging(dial));
    note(dragging(zoom));
    pointer(zoom, "pointerdown", 100);
    await frames();
    note(dragging(zoom), [root, "data-zooming"]);
    pointer(zoom, "pointerup", 100);
    await frames();
    note(dragging(zoom), [root, "data-zooming"]);

    expect(seen).toStrictEqual([
      "root data-rotating",
      "part data-dragging",
      "",
      "",
      "part data-dragging, root data-zooming",
      "",
    ]);
  });

  it("Root shows data-interacting during a gesture and its hold", async () => {
    const { api, root } = await mount(null);

    expect(on(root, "data-interacting")).toBeFalsy();
    api().begin("resize");
    await frames();
    expect(on(root, "data-interacting")).toBeTruthy();
    api().end();
    await frames();
    expect(on(root, "data-interacting")).toBeTruthy();

    await expect
      .poll(() => on(root, "data-interacting"), { timeout: 5000 })
      .toBeFalsy();
  });

  it('Root shows data-reduced-motion for motion="reduce" from the first paint and follows the prop', async () => {
    const screen = await render(<MotionHost motion="reduce" />);
    const reduced = () =>
      screen.container.querySelector("[data-reduced-motion]") !== null;

    expect(reduced()).toBeTruthy();
    await screen.rerender(<MotionHost motion="always" />);
    expect(reduced()).toBeFalsy();
    await screen.rerender(<MotionHost motion="reduce" />);
    expect(reduced()).toBeTruthy();
  });
});
