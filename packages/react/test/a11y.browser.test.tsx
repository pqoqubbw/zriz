import type { Cropper as CropperApi } from "@zriz/core";
import axe from "axe-core";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";

import * as Cropper from "../src/cropper";

const frames = async (n = 2): Promise<void> => {
  for (let i = 0; i < n; i += 1) {
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }
};

const Editor = ({ api }: { api: React.Ref<CropperApi> }) => (
  <Cropper.Root actionsRef={api} image={{ height: 300, width: 400 }}>
    <Cropper.Viewport
      style={{ height: 300, padding: 20, position: "relative", width: 400 }}
    >
      <Cropper.Mask />
      <Cropper.Area aria-label="Crop area">
        <Cropper.Grid />
        <Cropper.Handle position="top-left" />
      </Cropper.Area>
    </Cropper.Viewport>
    <Cropper.Instructions>Arrows move the photo.</Cropper.Instructions>
    <Cropper.Dial aria-label="Straighten" style={{ height: 40, width: 361 }}>
      <Cropper.DialTicks />
      <Cropper.DialValue />
    </Cropper.Dial>
    <Cropper.Zoom aria-label="Zoom" style={{ height: 20, width: 200 }}>
      <Cropper.ZoomThumb />
    </Cropper.Zoom>
    <Cropper.AspectGroup aria-label="Aspect">
      <Cropper.AspectItem value="free">Free</Cropper.AspectItem>
      <Cropper.AspectItem value={1}>Square</Cropper.AspectItem>
    </Cropper.AspectGroup>
    <Cropper.Rotate aria-label="Rotate left" />
    <Cropper.Flip aria-label="Flip" />
    <Cropper.Reset>Reset</Cropper.Reset>
    <Cropper.Announcer announce={() => "Saved"} />
  </Cropper.Root>
);

describe("accessibility", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("has no axe violations", async () => {
    const api = createRef<CropperApi>();
    const screen = await render(<Editor api={api} />);
    await frames(3);
    const result = await axe.run(screen.container);
    expect(result.violations.map((v) => v.id)).toStrictEqual([]);
  });

  it("exposes the zoom slider with keys and percent text", async () => {
    const api = createRef<CropperApi>();
    const screen = await render(<Editor api={api} />);
    await frames(2);
    const zoom = screen.container.querySelector<HTMLElement>(
      '[data-zriz-item="zoom"]'
    );
    zoom?.focus();
    await userEvent.keyboard("{End}");
    await frames(3);
    expect(api.current?.getZoom()).toBeCloseTo(15, 6);
    expect(zoom?.getAttribute("aria-valuetext")).toBe("1,500%");
    await userEvent.keyboard("{Home}");
    await frames(3);
    expect(api.current?.getZoom()).toBeCloseTo(1, 6);
  });

  it("warns once when a part has no name", async () => {
    const warn = vi.spyOn(console, "warn").mockReturnValue(undefined);
    await render(
      <Cropper.Root image={{ height: 300, width: 400 }}>
        <Cropper.Dial />
        <Cropper.Dial />
      </Cropper.Root>
    );
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});
