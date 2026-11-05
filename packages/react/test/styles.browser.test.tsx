import "../../core/src/styles.css";
import type { Cropper as CropperApi } from "@zriz/core";
import { maskGradient } from "@zriz/core/dom";
import { createRef } from "react";
import { hydrateRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { commands, server } from "vitest/browser";

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

type EditorProps = { api: React.Ref<CropperApi> };

const Editor = ({ api }: EditorProps) => (
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

  it("gives a bare viewport and dial a working box", async () => {
    await render(
      <div style={{ width: 361 }}>
        <Cropper.Root image={{ height: 300, width: 400 }}>
          <Cropper.Viewport style={{ height: 200 }}>
            <Cropper.Area aria-label="Crop" />
          </Cropper.Viewport>
          <Cropper.Dial aria-label="Straighten">
            <Cropper.DialTicks />
          </Cropper.Dial>
        </Cropper.Root>
      </div>
    );

    await frames(3);
    const viewport = getComputedStyle(pick('[data-zriz-item="viewport"]'));

    expect(viewport.position).toBe("relative");
    expect(viewport.overflow).toBe("clip");
    const dial = pick('[data-zriz-item="dial"]');

    expect(dial.getBoundingClientRect().height).toBe(40);
    expect(getComputedStyle(dial).overflowX).toBe("clip");
    expect(getComputedStyle(dial).overflowY).toBe("visible");
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

  it("keeps every dial tick under a page-wide percentage max-width", async () => {
    const page = document.createElement("style");

    page.textContent = "* { max-width: 100%; }";
    document.head.append(page);
    const api = createRef<CropperApi>();

    await render(<Editor api={api} />);
    await frames(3);
    const widths = new Set(
      [...pick('[data-zriz-item="dial-ticks"]').children].map(
        (tick) => tick.getBoundingClientRect().width
      )
    );

    page.remove();
    expect(widths).toStrictEqual(new Set([1]));
  });

  it.runIf(
    CSS.supports(
      "clip-path",
      "shape(evenodd from 0 0, hline to 10px, vline to 10px, close, move to 5px 0, arc by 0 10px of 5px 5px, close)"
    )
  )("cuts a round hole the engine accepts", async () => {
    await render(
      <Cropper.Root image={{ height: 300, width: 400 }} shape="circle">
        <Cropper.Viewport
          style={{ height: 300, position: "relative", width: 400 }}
        >
          <Cropper.Mask />
        </Cropper.Viewport>
      </Cropper.Root>
    );

    await frames(2);
    const mask = pick('[data-zriz-item="mask"]');

    expect(mask.style.clipPath).toContain("shape(");
    mask.style.pointerEvents = "auto";
    const { left, top } = mask.getBoundingClientRect();

    expect(document.elementFromPoint(left + 200, top + 150)).not.toBe(mask);
    expect(document.elementFromPoint(left + 55, top + 5)).toBe(mask);
  });

  it("writes a fallback gradient the engine accepts", () => {
    const box = { height: 200, width: 200, x: 10, y: 10 };

    expect(CSS.supports("mask-image", maskGradient(box, 2))).toBeTruthy();
  });

  it("lets a part pin its own scheme inside a themed page", async () => {
    await render(
      <div className="dark">
        <Cropper.Root image={{ height: 300, width: 400 }}>
          <Cropper.Dial aria-label="Straighten" className="light" />
          <Cropper.Zoom aria-label="Zoom" />
        </Cropper.Root>
      </div>
    );

    await frames();

    expect(getComputedStyle(pick('[data-zriz-item="dial"]')).colorScheme).toBe(
      "light"
    );

    expect(getComputedStyle(pick('[data-zriz-item="zoom"]')).colorScheme).toBe(
      "dark"
    );
  });
});

const serve = (tree: React.ReactElement): HTMLElement => {
  const host = document.createElement("div");

  host.innerHTML = renderToString(tree);
  document.body.append(host);

  return host;
};

const hydrate = async (
  tree: (api: React.Ref<CropperApi>) => React.ReactElement
): Promise<{ api: React.RefObject<CropperApi | null>; root: Root }> => {
  const api = createRef<CropperApi>();
  const root = hydrateRoot(serve(tree(api)), tree(api));

  await expect.poll(() => api.current).not.toBeNull();

  return { api, root };
};

const insideViewport = (selector: string): boolean => {
  const bounds = pick('[data-zriz-item="viewport"]').getBoundingClientRect();
  const box = pick(selector).getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;

  return (
    x >= bounds.left &&
    x <= bounds.right &&
    y >= bounds.top &&
    y <= bounds.bottom
  );
};

const painted = (selector: string, pseudo: string): boolean =>
  getComputedStyle(pick(selector), pseudo).content !== "none";

const noPhoto = (api?: React.Ref<CropperApi>) => (
  <Cropper.Root actionsRef={api}>
    <Cropper.Viewport style={{ height: 100, padding: 10, width: 120 }}>
      <Cropper.Mask />
      <Cropper.Area aria-label="Crop">
        <Cropper.Handle position="top-left" />
        <Cropper.Handle position="bottom-right" />
      </Cropper.Area>
    </Cropper.Viewport>
  </Cropper.Root>
);

const userStyled = (api: React.Ref<CropperApi>) => (
  <Cropper.Root actionsRef={api}>
    <Cropper.Viewport>
      <Cropper.Area aria-label="Crop" style={{ position: "fixed" }}>
        <Cropper.Handle
          position="top-left"
          style={{ position: "fixed", touchAction: "manipulation" }}
        />
      </Cropper.Area>
    </Cropper.Viewport>
    <Cropper.Announcer announce={() => null} style={{ overflow: "visible" }} />
  </Cropper.Root>
);

const withPhoto = (ref: React.Ref<CropperApi>) => (
  <Cropper.Root actionsRef={ref} image={{ height: 300, width: 400 }}>
    <Cropper.Viewport style={{ height: 100, padding: 10, width: 120 }}>
      <Cropper.Area aria-label="Crop">
        <Cropper.Handle position="bottom-right" />
      </Cropper.Area>
    </Cropper.Viewport>
  </Cropper.Root>
);

describe("a turn of the whole crop", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("hides the area and its handles until the turn ends", async () => {
    const api = createRef<CropperApi>();

    await render(<Editor api={api} />);
    await frames(2);
    const area = pick('[data-zriz-item="area"]');

    expect(getComputedStyle(area).opacity).toBe("1");
    api.current?.rotate90();
    await expect.poll(() => getComputedStyle(area).opacity).toBe("0");
    await expect.poll(() => getComputedStyle(area).opacity).toBe("1");
  });
});

describe("before the photo is placed", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("keeps the frame off the page and the handles in the viewport on server html", async () => {
    serve(noPhoto());
    await frames();
    const { documentElement: page } = document;

    expect(painted('[data-zriz-item="area"]', "::after")).toBeFalsy();
    expect(painted('[data-edge="top-left"]', "::before")).toBeFalsy();

    expect(
      ['[data-edge="top-left"]', '[data-edge="bottom-right"]'].map(
        insideViewport
      )
    ).toStrictEqual([true, true]);

    expect(page.scrollWidth).toBeLessThanOrEqual(page.clientWidth);
    expect(page.scrollHeight).toBeLessThanOrEqual(page.clientHeight);
  });

  it("leaves a style of the user's on a part after hydration", async () => {
    const { root } = await hydrate(userStyled);
    const handle = getComputedStyle(pick('[data-zriz-item="handle"]'));
    const { position, touchAction } = handle;
    const { overflow } = getComputedStyle(pick('[data-zriz-item="announcer"]'));

    root.unmount();
    expect(position).toBe("fixed");
    expect(touchAction).toBe("manipulation");
    expect(overflow).toBe("visible");
  });

  it("paints no corner marks after hydration while there is no photo", async () => {
    const { root } = await hydrate(noPhoto);

    await frames();
    const marks = painted('[data-edge="top-left"]', "::before");

    root.unmount();
    expect(marks).toBeFalsy();
  });

  it("paints the frame and the corners once a photo is placed, and drops them with the photo", async () => {
    const { api, root } = await hydrate(withPhoto);
    const area = pick('[data-zriz-item="area"]');

    await expect
      .poll(() => area.getBoundingClientRect().width)
      .toBeGreaterThan(10);

    expect(painted('[data-zriz-item="area"]', "::after")).toBeTruthy();
    expect(painted('[data-edge="bottom-right"]', "::before")).toBeTruthy();
    api.current?.setImage(null);

    await expect
      .poll(() => painted('[data-zriz-item="area"]', "::after"))
      .toBeFalsy();

    expect(painted('[data-edge="bottom-right"]', "::before")).toBeFalsy();
    root.unmount();
  });
});

const system = (name: string): string => {
  const probe = document.createElement("div");

  probe.style.background = name;
  document.body.append(probe);
  const colour = getComputedStyle(probe).backgroundColor;

  probe.remove();

  return colour;
};

const background = (selector: string, pseudo?: string): string =>
  getComputedStyle(pick(selector), pseudo).backgroundColor;

const placeRotated = async (): Promise<void> => {
  const api = createRef<CropperApi>();

  await render(<Editor api={api} />);
  api.current?.setRotation(5);
  await frames(3);
};

const everyPart = (colour: string): string[] => [
  colour,
  colour,
  colour,
  colour,
  colour,
  colour,
];

const paintedColours = (): string[] => [
  background('[data-zriz-item="dial"]', "::after"),
  background('[data-edge="top-left"]', "::before"),
  background('[data-zriz-item="grid"] > *'),
  background('[data-zriz-item="dial-ticks"] > *'),
  background("[data-zero]", "::before"),
  getComputedStyle(pick('[data-zriz-item="area"]'), "::after").outlineColor,
];

describe.runIf(server.browser !== "webkit")("forced colours", () => {
  const page = document.createElement("style");

  afterEach(async () => {
    page.remove();
    await cleanup();
    await commands.forcedColors("none");
  });

  it("paints system colours with no override", async () => {
    await commands.forcedColors("active");
    expect(matchMedia("(forced-colors)").matches).toBeTruthy();
    await placeRotated();
    expect(paintedColours()).toStrictEqual(everyPart(system("CanvasText")));
  });

  it("keeps a part visible when a colour variable is set on it", async () => {
    page.textContent = `
      [data-zriz-item="handle"], [data-zriz-item="grid"], [data-zriz-item="area"],
      [data-zriz-item="dial"], [data-zriz-item="dial-ticks"],
      [data-zriz-item="grid"] > *, [data-zriz-item="dial-ticks"] > * {
        --zriz-line: #0a84ff; --zriz-grid: #0a84ff; --zriz-tick: #0a84ff; --zriz-accent: #0a84ff;
      }`;

    document.head.append(page);
    await commands.forcedColors("active");
    await placeRotated();
    expect(paintedColours()).toStrictEqual(everyPart(system("CanvasText")));
  });

  it("keeps the dial line on Highlight during a drag with a custom accent", async () => {
    page.textContent = '[data-zriz-item="dial"] { --zriz-accent: #0a84ff; }';
    document.head.append(page);
    await commands.forcedColors("active");
    await placeRotated();
    const dial = pick('[data-zriz-item="dial"]');
    const { left, top } = dial.getBoundingClientRect();
    const hold = (type: string, x: number): boolean =>
      dial.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          button: 0,
          buttons: 1,
          clientX: left + x,
          clientY: top + 10,
          pointerId: 1,
          pointerType: "mouse",
        })
      );

    hold("pointerdown", 50);
    hold("pointermove", 80);

    await expect
      .poll(() => Object.hasOwn(dial.dataset, "dragging"))
      .toBeTruthy();

    const colour = background('[data-zriz-item="dial"]', "::after");

    hold("pointerup", 80);
    expect(colour).toBe(system("Highlight"));
  });

  it("leaves a page element with data-zero alone", async () => {
    page.textContent = '.mine::before { content: "label"; }';
    document.head.append(page);
    const mine = document.createElement("div");
    const plain = document.createElement("div");

    mine.className = "mine";
    plain.className = "mine";
    mine.dataset.zero = "";
    document.body.append(mine, plain);
    await commands.forcedColors("active");
    const colours = [mine, plain].map(
      (element) => getComputedStyle(element, "::before").backgroundColor
    );

    mine.remove();
    plain.remove();
    expect(colours[0]).toBe(colours[1]);
  });

  it("loses to a class that paints a system colour directly", async () => {
    page.textContent = ".user-tick > * { background: Highlight; }";
    document.head.append(page);
    await commands.forcedColors("active");
    await placeRotated();

    expect(background('[data-zriz-item="dial-ticks"] > *')).toBe(
      system("Highlight")
    );
  });
});
