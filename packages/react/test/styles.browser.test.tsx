import "../../core/src/styles.css";
import type { Cropper as CropperApi } from "@zriz/core";
import { createRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "vitest-browser-react";

import * as Cropper from "../src/cropper";

const frames = async (n = 2): Promise<void> => {
  for (let i = 0; i < n; i += 1) {
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }
};

const user = document.createElement("style");
user.textContent =
  ".user-scrim { background: rgb(255 0 0); } .user-tick > * { background: rgb(0 128 0); }";

const Editor = ({ api }: { api: React.Ref<CropperApi> }) => (
  <Cropper.Root actionsRef={api} image={{ height: 300, width: 400 }}>
    <Cropper.Viewport
      style={{
        boxSizing: "border-box",
        height: 300,
        padding: 20,
        position: "relative",
        width: 400,
      }}
    >
      <Cropper.Mask className="user-scrim" />
      <Cropper.Area aria-label="Crop">
        <Cropper.Grid />
        <Cropper.Handle position="top-left" />
        <Cropper.Handle position="bottom-right" />
        <Cropper.Handle position="top" />
      </Cropper.Area>
    </Cropper.Viewport>
    <Cropper.Dial aria-label="Straighten" style={{ height: 40, width: 361 }}>
      <Cropper.DialTicks className="user-tick" />
    </Cropper.Dial>
  </Cropper.Root>
);

const pick = (selector: string): HTMLElement => {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) {
    throw new Error(`missing ${selector}`);
  }
  return element;
};

describe("default styles", () => {
  afterEach(async () => {
    user.remove();
    await cleanup();
  });

  it("paints the frame, corner arms, edge bars and ticks", async () => {
    const api = createRef<CropperApi>();
    await render(<Editor api={api} />);
    await frames(3);
    const frame = getComputedStyle(pick('[data-zriz-item="area"]'), "::after");
    expect(frame.outlineWidth).toBe("1px");
    const corner = getComputedStyle(
      pick('[data-edge="bottom-right"]'),
      "::before"
    );
    expect(corner.width).toBe("20px");
    expect(corner.scale).toBe("-1");
  });

  it("paints edge bars and ticks", async () => {
    const api = createRef<CropperApi>();
    await render(<Editor api={api} />);
    await frames(3);
    const bar = getComputedStyle(pick('[data-edge="top"]'), "::before");
    expect(bar.width).toBe("25px");
    expect(bar.height).toBe("3px");
    const tick = pick('[data-zriz-item="dial-ticks"] > [data-zero]');
    expect(tick.getBoundingClientRect().height).toBe(10);
  });

  it("shows the grid only while it is on", async () => {
    const api = createRef<CropperApi>();
    await render(<Editor api={api} />);
    await frames(2);
    const grid = pick('[data-zriz-item="grid"]');
    expect(getComputedStyle(grid).opacity).toBe("0");
    api.current?.begin("pan");
    await frames(2);
    expect(Object.hasOwn(grid.dataset, "visible")).toBeTruthy();
    expect(grid.children).toHaveLength(4);
    api.current?.end();
  });

  it("loses to a plain class from the user", async () => {
    document.head.append(user);
    const api = createRef<CropperApi>();
    await render(<Editor api={api} />);
    await frames(2);
    expect(
      getComputedStyle(pick('[data-zriz-item="mask"]')).backgroundColor
    ).toBe("rgb(255, 0, 0)");
    expect(
      getComputedStyle(pick('[data-zriz-item="dial-ticks"] > [data-major]'))
        .backgroundColor
    ).toBe("rgb(0, 128, 0)");
  });

  it("keeps a circle round: aspect 1, other ratios off, no corner handles", async () => {
    const api = createRef<CropperApi>();
    await render(
      <Cropper.Root
        actionsRef={api}
        aspect="free"
        image={{ height: 300, width: 400 }}
        shape="circle"
      >
        <Cropper.Viewport
          style={{ height: 300, position: "relative", width: 400 }}
        >
          <Cropper.Area aria-label="Crop">
            <Cropper.Handle position="top-left" />
            <Cropper.Handle position="top" />
          </Cropper.Area>
        </Cropper.Viewport>
        <Cropper.AspectGroup aria-label="Aspect">
          <Cropper.AspectItem value={1}>Square</Cropper.AspectItem>
          <Cropper.AspectItem value={16 / 9}>Wide</Cropper.AspectItem>
        </Cropper.AspectGroup>
      </Cropper.Root>
    );
    await frames(2);
    expect(api.current?.getValue().aspect).toBe(1);
    const [square, wide] = document.querySelectorAll<HTMLButtonElement>(
      '[data-zriz-item="aspect-item"]'
    );
    expect(square?.disabled).toBeFalsy();
    expect(wide?.disabled).toBeTruthy();
    expect(getComputedStyle(pick('[data-edge="top-left"]')).display).toBe(
      "none"
    );
    expect(getComputedStyle(pick('[data-edge="top"]')).display).not.toBe(
      "none"
    );
  });
  it("lets a part pin its own scheme inside a themed page", async () => {
    render(
      <div className="dark">
        <Cropper.Root image={{ height: 300, width: 400 }}>
          <Cropper.Dial aria-label="Straighten" className="light" />
          <Cropper.Zoom aria-label="Zoom" />
        </Cropper.Root>
      </div>,
    );
    await frames();
    expect(getComputedStyle(pick('[data-zriz-item="dial"]')).colorScheme).toBe("light");
    expect(getComputedStyle(pick('[data-zriz-item="zoom"]')).colorScheme).toBe("dark");
  });
});
