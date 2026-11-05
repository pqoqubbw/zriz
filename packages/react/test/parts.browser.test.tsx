import type { ChangeReason, Cropper as CropperApi } from "@zriz/core";
import { viewOf } from "@zriz/core/dom";
import { createRef } from "react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
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

const on = (element: Element, attribute: string): boolean =>
  element.hasAttribute(attribute);

const GESTURES: [ChangeReason, string][] = [
  ["pinch", "data-pinching"],
  ["resize", "data-resizing"],
  ["dial", "data-rotating"],
  ["wheel", "data-zooming"],
  ["zoom-control", "data-zooming"],
];

describe("buttons and state attributes", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("Flip mirrors on click, and aria-pressed and data-mirrored follow", async () => {
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
  });

  it('Flip axis="y" keeps the axis of a mirror', async () => {
    const { api, pick } = await mount(
      <Cropper.Flip axis="y">flip</Cropper.Flip>
    );
    const before = api().getValue().quarterTurns;

    pick("flip").click();
    await frames();
    expect(api().getValue().mirrored).toBeTruthy();
    expect(api().getValue().quarterTurns).not.toBe(before);
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

  it("ZoomStep multiplies the zoom with its own reason", async () => {
    const reasons: string[] = [];
    const { api, screen } = await mount(
      <>
        <Cropper.ZoomStep factor={2}>in</Cropper.ZoomStep>
        <Cropper.ZoomStep factor={0.5}>out</Cropper.ZoomStep>
      </>,
      {
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
    expect(api().getZoom()).toBeCloseTo(2, 6);
    expect(reasons).toContain("zoom-control");
    zoomOut?.click();
    await frames();
    expect(api().getZoom()).toBeCloseTo(1, 6);
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

  it("Grid draws the fine lines for the dial and keeps them while it fades", async () => {
    const { api, pick } = await mount(<Cropper.Grid />);
    const grid = pick("grid");
    const read = () => ({
      coarse: grid.querySelectorAll("[data-coarse]").length,
      grid: grid.dataset.grid,
      lines: grid.children.length,
    });

    expect(grid.children).toHaveLength(4);
    api().begin("dial");
    await frames();
    expect(read()).toStrictEqual({ coarse: 4, grid: "none", lines: 4 });
    api().setRotation(2, { reason: "dial" });
    await frames();

    expect({ ...read(), visible: on(grid, "data-visible") }).toStrictEqual({
      coarse: 0,
      grid: "fine",
      lines: 16,
      visible: true,
    });

    api().end();
    await frames();
    expect(read()).toStrictEqual({ coarse: 0, grid: "none", lines: 16 });
    api().begin("pan");
    await frames();
    expect(read()).toStrictEqual({ coarse: 4, grid: "coarse", lines: 4 });
    api().end();
  });

  it("Dial shows data-dragging only while a pointer drags it", async () => {
    const { pick, root } = await mount(
      <Cropper.Dial aria-label="Straighten" />
    );
    const dial = pick("dial");

    pointer(dial, "pointerdown", 100);
    await frames();
    expect(on(dial, "data-dragging")).toBeFalsy();
    expect(on(root, "data-rotating")).toBeTruthy();
    pointer(dial, "pointermove", 150);
    await frames();
    expect(on(dial, "data-dragging")).toBeTruthy();
    pointer(dial, "pointerup", 150);
    await frames();
    expect(on(dial, "data-dragging")).toBeFalsy();
  });

  it("Zoom shows data-dragging only while a pointer holds it", async () => {
    const { pick, root } = await mount(<Cropper.Zoom aria-label="Zoom" />);
    const zoom = pick("zoom");

    expect(on(zoom, "data-dragging")).toBeFalsy();
    pointer(zoom, "pointerdown", 100);
    await frames();
    expect(on(zoom, "data-dragging")).toBeTruthy();
    expect(on(root, "data-zooming")).toBeTruthy();
    pointer(zoom, "pointerup", 100);
    await frames();
    expect(on(zoom, "data-dragging")).toBeFalsy();
    expect(on(root, "data-zooming")).toBeFalsy();
  });

  it.each(GESTURES)("Root reason %s turns on %s", async (reason, attribute) => {
    const { api, root } = await mount(null);

    expect(on(root, attribute)).toBeFalsy();
    api().begin(reason);
    await frames();
    const seen = new Set(
      GESTURES.map(([, name]) => name).filter((name) => on(root, name))
    );

    expect([...seen]).toStrictEqual([attribute]);
    api().end();
    await frames();
    expect(on(root, attribute)).toBeFalsy();
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

  it("Root shows data-settling while an animation runs", async () => {
    const { api, root } = await mount(null);

    expect(on(root, "data-settling")).toBeFalsy();
    let running = true;

    api().run(() => running);
    await frames();
    expect(on(root, "data-settling")).toBeTruthy();
    running = false;
    await expect.poll(() => on(root, "data-settling")).toBeFalsy();
  });

  it("Root shows data-overscroll while the view is pulled past an edge", async () => {
    const { api, root } = await mount(null);

    expect(on(root, "data-overscroll")).toBeFalsy();
    viewOf(api()).setOverscroll({ x: 8, y: 0 });
    await frames();
    expect(on(root, "data-overscroll")).toBeTruthy();
    viewOf(api()).setOverscroll({ x: 0, y: 0 });
    await frames();
    expect(on(root, "data-overscroll")).toBeFalsy();
  });

  it('Root shows data-reduced-motion for motion="reduce", from mount', async () => {
    const { root } = await mount(null, { motion: "reduce" });

    expect(on(root, "data-reduced-motion")).toBeTruthy();
  });
});
