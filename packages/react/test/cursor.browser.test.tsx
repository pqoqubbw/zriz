import "../../core/src/styles.css";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "vitest-browser-react";

import * as Cropper from "../src/cropper";

const edges = [
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

const Editor = () => (
  <Cropper.Root image={{ height: 300, width: 400 }}>
    <Cropper.Viewport
      style={{ height: 300, padding: 20, position: "relative", width: 400 }}
    >
      <Cropper.Area aria-label="Crop">
        {edges.map(([edge]) => (
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

  it("shows a resize cursor on every handle and grab on the photo and dial", async () => {
    const screen = await render(<Editor />);
    await frames();
    const cursorOf = (selector: string): string => {
      const element = screen.container.querySelector(selector);
      return element ? getComputedStyle(element).cursor : "";
    };
    expect(
      edges.map(([edge]) => cursorOf(`[data-edge="${edge}"]`))
    ).toStrictEqual(edges.map(([, cursor]) => cursor));
    expect(cursorOf('[data-zriz-item="viewport"]')).toBe("grab");
    expect(cursorOf('[data-zriz-item="dial"]')).toBe("grab");
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
