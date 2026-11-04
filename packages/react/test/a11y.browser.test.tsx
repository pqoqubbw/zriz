import type { Cropper as CropperApi, CropValue } from "@zriz/core";
import axe from "axe-core";
import { createRef, useState } from "react";
import { createPortal } from "react-dom";
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

  it("keeps the app mounted with a malformed locale and warns once per slider", async () => {
    const warn = vi.spyOn(console, "warn").mockReturnValue(undefined);
    const screen = await render(
      <Cropper.Root locale="pt_BR">
        <Cropper.Dial aria-label="straighten" />
        <Cropper.Zoom aria-label="zoom" />
      </Cropper.Root>
    );
    expect(
      screen.container.querySelector('[data-zriz-item="dial"]')
    ).not.toBeNull();
    expect(warn.mock.calls.map((call) => String(call[0]))).toStrictEqual([
      expect.stringContaining("Cropper.Dial"),
      expect.stringContaining("Cropper.Zoom"),
    ]);
    warn.mockRestore();
  });
});

const stops = (container: Element): string[] =>
  [...container.querySelectorAll<HTMLElement>('[role="radio"]')]
    .filter((item) => item.tabIndex === 0)
    .map((item) => item.textContent);

const Items = () => {
  const [first, setFirst] = useState(true);
  return (
    <>
      <button
        id="drop-first"
        onClick={() => {
          setFirst(false);
        }}
        type="button"
      >
        drop
      </button>
      {first ? <Cropper.AspectItem value={1}>Square</Cropper.AspectItem> : null}
      <Cropper.AspectItem value={2}>Wide</Cropper.AspectItem>
    </>
  );
};

describe("part states", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("keeps one tab stop when items change inside their own component", async () => {
    const screen = await render(
      <Cropper.Root image={{ height: 300, width: 400 }}>
        <Cropper.AspectGroup aria-label="Aspect">
          <Items />
        </Cropper.AspectGroup>
      </Cropper.Root>
    );
    expect(stops(screen.container)).toStrictEqual(["Square"]);
    document.querySelector<HTMLElement>("#drop-first")?.click();
    await vi.waitFor(() => {
      expect(stops(screen.container)).toStrictEqual(["Wide"]);
    });
  });

  it("does not move focus in a disabled aspect group", async () => {
    const screen = await render(
      <Cropper.Root disabled image={{ height: 300, width: 400 }}>
        <Cropper.AspectGroup aria-label="Aspect">
          <Cropper.AspectItem value={1}>Square</Cropper.AspectItem>
          <Cropper.AspectItem value={2}>Wide</Cropper.AspectItem>
        </Cropper.AspectGroup>
      </Cropper.Root>
    );
    const first = screen.container.querySelector<HTMLElement>('[role="radio"]');
    first?.focus();
    first?.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" })
    );
    expect(document.activeElement).toBe(first);
  });

  it("keeps the instructions link with a custom id", async () => {
    const screen = await render(
      <Cropper.Root>
        <Cropper.Area aria-label="Crop" />
        <Cropper.Instructions id="mine">help</Cropper.Instructions>
      </Cropper.Root>
    );
    const area = screen.container.querySelector('[data-zriz-item="area"]');
    const link = area?.getAttribute("aria-describedby") ?? "";
    expect(document.querySelector(`[id="${link}"]`)?.textContent).toBe("help");
  });

  it("repeats a message that ends in white space", async () => {
    const api = createRef<CropperApi>();
    const screen = await render(
      <Cropper.Root actionsRef={api} image={{ height: 300, width: 400 }}>
        <Cropper.Announcer announce={() => "Saved "} />
      </Cropper.Root>
    );
    const status = screen.container.querySelector('[role="status"]');
    api.current?.setRotation(1);
    await frames(2);
    const said = status?.textContent;
    api.current?.setRotation(2);
    await frames(2);
    expect(status?.textContent).not.toBe(said);
  });

  it("marks a disabled Orientation and disabled sliders", async () => {
    const screen = await render(
      <Cropper.Root disabled image={{ height: 300, width: 400 }}>
        <Cropper.Orientation>turn</Cropper.Orientation>
        <Cropper.Dial aria-label="Dial" />
        <Cropper.Zoom aria-label="Zoom" />
      </Cropper.Root>
    );
    const { container } = screen;
    expect(
      container.querySelector('[data-zriz-item="orientation"]')
    ).toHaveProperty("dataset.disabled", "");
    expect(
      [...container.querySelectorAll('[role="slider"]')].map((slider) =>
        slider.getAttribute("aria-disabled")
      )
    ).toStrictEqual(["true", "true"]);
  });
});

const PHOTO = { height: 300, width: 400 };

const item = (container: Element, name: string): HTMLElement => {
  const node = container.querySelector<HTMLElement>(
    `[data-zriz-item="${name}"]`
  );
  if (!node) {
    throw new Error(`no ${name}`);
  }
  return node;
};

const Group = ({ api }: { api: React.Ref<CropperApi> }) => (
  <Cropper.Root actionsRef={api} defaultValue={{ aspect: 1 }} image={PHOTO}>
    <Cropper.AspectGroup aria-label="Aspect">
      <Cropper.AspectItem render={<div />} value={1}>
        Square
      </Cropper.AspectItem>
      <Cropper.AspectItem disabled render={<div />} value={2}>
        Wide
      </Cropper.AspectItem>
      <Cropper.AspectItem render={<div />} value={3}>
        Wider
      </Cropper.AspectItem>
    </Cropper.AspectGroup>
  </Cropper.Root>
);

const Parts = ({ disabled }: { disabled: boolean }) => (
  <Cropper.Root disabled={disabled} image={PHOTO}>
    <Cropper.Area aria-label="Crop" />
    <Cropper.Dial aria-label="Dial" />
    <Cropper.Zoom aria-label="Zoom" />
    <Cropper.Rotate>Rotate</Cropper.Rotate>
    <Cropper.Flip>Flip</Cropper.Flip>
    <Cropper.Orientation>Turn</Cropper.Orientation>
    <Cropper.AspectItem value={1}>Square</Cropper.AspectItem>
    <Cropper.ZoomStep factor={2}>In</Cropper.ZoomStep>
    <Cropper.Reset hidden={false}>Reset</Cropper.Reset>
  </Cropper.Root>
);
const NAMES = [
  "area",
  "dial",
  "zoom",
  "rotate",
  "flip",
  "orientation",
  "aspect-item",
  "zoom-step",
  "reset",
];

const Sliders = ({
  api,
  ...props
}: { api?: React.Ref<CropperApi> } & React.ComponentProps<
  typeof Cropper.Root
>) => (
  <Cropper.Root actionsRef={api} image={PHOTO} {...props}>
    <Cropper.Dial aria-label="Dial" />
    <Cropper.Zoom aria-label="Zoom">
      <Cropper.ZoomThumb />
    </Cropper.Zoom>
  </Cropper.Root>
);

const value = (rotation: number): CropValue => ({
  aspect: "free",
  center: { x: 0.5, y: 0.5 },
  mirrored: false,
  perspective: { horizontal: 0, vertical: 0 },
  quarterTurns: 0,
  rotation,
  size: { height: 1, width: 1 },
});

describe("what the warnings count", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("warns for a slider with text inside and no name, and accepts title", async () => {
    const warn = vi.spyOn(console, "warn").mockReturnValue(undefined);
    await render(
      <Cropper.Root image={PHOTO}>
        <Cropper.Area title="Crop" />
      </Cropper.Root>
    );
    expect(warn).not.toHaveBeenCalled();
    await render(
      <Cropper.Root image={PHOTO}>
        <Cropper.Zoom>
          <span>150%</span>
        </Cropper.Zoom>
      </Cropper.Root>
    );
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toContain("Cropper.Zoom");
    warn.mockRestore();
  });

  it("speaks the default text with a format the browser refuses", async () => {
    const screen = await render(
      <Cropper.Root image={PHOTO} locale="de">
        <Cropper.Dial aria-label="Dial" format={{ style: "currency" }} />
        <Cropper.Zoom
          aria-label="Zoom"
          format={{ maximumFractionDigits: 200 }}
        />
      </Cropper.Root>
    );
    expect(item(screen.container, "dial").getAttribute("aria-valuetext")).toBe(
      "0 Grad"
    );
    expect(
      item(screen.container, "zoom").getAttribute("aria-valuetext")
    ).toMatch(/^100\s%$/u);
  });

  it("keeps a valid format when only the locale is bad", async () => {
    const screen = await render(
      <Cropper.Root image={PHOTO} locale="en_US">
        <Cropper.Zoom aria-label="Zoom" format={{ style: "decimal" }} />
      </Cropper.Root>
    );
    expect(item(screen.container, "zoom").getAttribute("aria-valuetext")).toBe(
      "1"
    );
  });
});

describe("aspect items that are not buttons", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("moves with arrows and skips a disabled item", async () => {
    const api = createRef<CropperApi>();
    const screen = await render(<Group api={api} />);
    await frames();
    const radios = [
      ...screen.container.querySelectorAll<HTMLElement>('[role="radio"]'),
    ];
    radios[0]?.focus();
    await userEvent.keyboard("{ArrowRight}");
    await frames();
    expect(api.current?.getValue().aspect).toBe(3);
    expect(document.activeElement).toBe(radios[2]);
    expect(radios.map((radio) => radio.tabIndex)).toStrictEqual([-1, -1, 0]);
  });

  it("ignores a click on a disabled item", async () => {
    const api = createRef<CropperApi>();
    const screen = await render(<Group api={api} />);
    await frames();
    screen.container
      .querySelectorAll<HTMLElement>('[role="radio"]')[1]
      ?.click();
    await frames();
    expect(api.current?.getValue().aspect).toBe(1);
  });
});

describe("a disabled AspectItem", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("reports its disabled prop in the attribute and the state, and ignores presses", async () => {
    const api = createRef<CropperApi>();
    const seen: boolean[] = [];
    const screen = await render(
      <Cropper.Root actionsRef={api} image={PHOTO}>
        <Cropper.AspectItem
          className={(state) => {
            seen.push(state.disabled);
            return "";
          }}
          disabled
          value={2}
        >
          Wide
        </Cropper.AspectItem>
      </Cropper.Root>
    );
    const button = item(screen.container, "aspect-item");
    expect(button.dataset.disabled).toBe("");
    expect(seen.at(-1)).toBeTruthy();
    button.click();
    await frames();
    expect(api.current?.getValue().aspect).toBe("free");
  });

  it("stays locked on a circle with disabled false", async () => {
    const api = createRef<CropperApi>();
    const screen = await render(
      <Cropper.Root actionsRef={api} image={PHOTO} shape="circle">
        <Cropper.AspectItem disabled={false} value={4 / 3}>
          Wide
        </Cropper.AspectItem>
      </Cropper.Root>
    );
    const button = item(screen.container, "aspect-item");
    expect(button.hasAttribute("disabled")).toBeTruthy();
    expect(button.dataset.disabled).toBe("");
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await frames();
    expect(api.current?.getValue().aspect).toBe(1);
  });
});

describe("slider values follow every move", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("reads a new value prop and marks the zero again", async () => {
    const screen = await render(<Sliders value={value(0)} />);
    const dial = item(screen.container, "dial");
    await screen.rerender(<Sliders value={value(12)} />);
    await vi.waitFor(() => {
      expect(dial.getAttribute("aria-valuenow")).toBe("12");
    });
    expect("snapped" in dial.dataset).toBeFalsy();
    await screen.rerender(<Sliders value={value(0)} />);
    await vi.waitFor(() => {
      expect(dial.getAttribute("aria-valuenow")).toBe("0");
    });
    expect("snapped" in dial.dataset).toBeTruthy();
  });

  it("reads a saved zoom after the first fit", async () => {
    const screen = await render(
      <Sliders defaultValue={{ size: { height: 0.25, width: 0.25 } }} />
    );
    await vi.waitFor(() => {
      expect(item(screen.container, "zoom").getAttribute("aria-valuenow")).toBe(
        "4"
      );
    });
  });

  it("follows a new limit with no change to the crop", async () => {
    const api = createRef<CropperApi>();
    const screen = await render(<Sliders api={api} maxZoom={15} />);
    await frames();
    api.current?.setZoom(3);
    await frames(3);
    await screen.rerender(<Sliders api={api} maxZoom={5} />);
    await vi.waitFor(() => {
      expect(item(screen.container, "zoom").getAttribute("aria-valuemax")).toBe(
        "5"
      );
    });
    expect(
      Number(
        item(screen.container, "zoom-thumb").style.insetInlineStart.replace(
          "%",
          ""
        )
      )
    ).toBeCloseTo(68.26, 1);
    await screen.rerender(
      <Sliders api={api} maxZoom={5} minSize={{ height: 290, width: 290 }} />
    );
    await vi.waitFor(() => {
      expect(
        Number(item(screen.container, "dial").getAttribute("aria-valuemax"))
      ).toBeLessThan(45);
    });
  });

  it("leaves the marks alone through a dial gesture until it ends", async () => {
    const api = createRef<CropperApi>();
    const screen = await render(<Sliders api={api} />);
    await frames();
    const dial = item(screen.container, "dial");
    api.current?.begin("dial");
    api.current?.setRotation(5);
    await frames(3);
    expect("snapped" in dial.dataset).toBeTruthy();
    api.current?.end();
    await vi.waitFor(() => {
      expect("snapped" in dial.dataset).toBeFalsy();
    });
  });
});
