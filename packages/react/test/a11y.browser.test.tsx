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

  it("names the photo with alt", async () => {
    const screen = await render(
      <Cropper.Root image={{ height: 300, width: 400 }}>
        <Cropper.Viewport style={{ height: 300, width: 400 }}>
          <Cropper.Image alt="A dog on a beach" />
        </Cropper.Viewport>
      </Cropper.Root>
    );
    await frames(2);
    await expect
      .element(screen.getByRole("img", { name: "A dog on a beach" }))
      .toBeInTheDocument();
  });

  it("speaks the same message again after a second commit", async () => {
    const api = createRef<CropperApi>();
    const screen = await render(<Editor api={api} />);
    await frames(3);
    const region = (): string =>
      screen.container.querySelector('[data-zriz-item="announcer"]')
        ?.textContent ?? "";
    api.current?.rotate90();
    await frames(4);
    const first = region();
    api.current?.rotate90();
    await frames(4);
    const second = region();
    expect(first.trim()).toBe("Saved");
    expect(second.trim()).toBe("Saved");
    expect(second).not.toBe(first);
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

  it("moves through the aspect group with arrows and one tab stop", async () => {
    const api = createRef<CropperApi>();
    const screen = await render(
      <Cropper.Root actionsRef={api} image={{ height: 300, width: 400 }}>
        <Cropper.AspectGroup aria-label="Aspect">
          <Cropper.AspectItem value="free">Free</Cropper.AspectItem>
          <Cropper.AspectItem value={1}>Square</Cropper.AspectItem>
          <Cropper.AspectItem value={16 / 9}>Wide</Cropper.AspectItem>
        </Cropper.AspectGroup>
      </Cropper.Root>
    );
    await frames(2);
    const items = [
      ...screen.container.querySelectorAll<HTMLButtonElement>(
        '[data-zriz-item="aspect-item"]'
      ),
    ];
    expect(items.map((item) => item.tabIndex)).toStrictEqual([0, -1, -1]);
    items[0]?.focus();
    await userEvent.keyboard("{ArrowRight}");
    await frames(2);
    expect(document.activeElement).toBe(items[1]);
    expect(api.current?.getValue().aspect).toBe(1);
    expect(items.map((item) => item.tabIndex)).toStrictEqual([-1, 0, -1]);
  });

  it("wraps around and jumps to the ends of the aspect group", async () => {
    const api = createRef<CropperApi>();
    const screen = await render(
      <Cropper.Root actionsRef={api} image={{ height: 300, width: 400 }}>
        <Cropper.AspectGroup aria-label="Aspect">
          <Cropper.AspectItem value="free">Free</Cropper.AspectItem>
          <Cropper.AspectItem value={1}>Square</Cropper.AspectItem>
          <Cropper.AspectItem value={16 / 9}>Wide</Cropper.AspectItem>
        </Cropper.AspectGroup>
      </Cropper.Root>
    );
    await frames(2);
    const items = [
      ...screen.container.querySelectorAll<HTMLButtonElement>(
        '[data-zriz-item="aspect-item"]'
      ),
    ];
    items[0]?.focus();
    await userEvent.keyboard("{ArrowLeft}");
    await frames(2);
    expect(document.activeElement).toBe(items[2]);
    expect(api.current?.getValue().aspect).toBeCloseTo(16 / 9, 6);
    await userEvent.keyboard("{Home}");
    await frames(2);
    expect(api.current?.getValue().aspect).toBe("free");
  });

  it("keeps a tab stop when no aspect item is checked", async () => {
    const screen = await render(
      <Cropper.Root image={{ height: 300, width: 400 }}>
        <Cropper.AspectGroup aria-label="Aspect">
          <Cropper.AspectItem value={1}>Square</Cropper.AspectItem>
          <Cropper.AspectItem value={16 / 9}>Wide</Cropper.AspectItem>
        </Cropper.AspectGroup>
      </Cropper.Root>
    );
    await frames(2);
    const items = [
      ...screen.container.querySelectorAll<HTMLButtonElement>(
        '[data-zriz-item="aspect-item"]'
      ),
    ];
    expect(items.map((item) => item.tabIndex)).toStrictEqual([0, -1]);
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

  it("keeps the app mounted with a malformed locale", async () => {
    const screen = await render(
      <Cropper.Root locale="pt_BR">
        <Cropper.Dial aria-label="straighten" />
        <Cropper.Zoom aria-label="zoom" />
      </Cropper.Root>
    );
    expect(
      screen.container.querySelector('[data-zriz-item="dial"]')
    ).not.toBeNull();
  });
});
