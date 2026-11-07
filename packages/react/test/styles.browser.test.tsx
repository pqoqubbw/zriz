import "../../core/src/styles.css";
import type { Cropper as CropperApi } from "@zriz/core";
import { createRef } from "react";
import { hydrateRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { commands, server, userEvent } from "vitest/browser";

import { maskGradient } from "../../core/src/dom/parts";
import * as Cropper from "../src/cropper";

import stylesheet from "../../core/src/styles.css?raw";

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

const grey = (colour: string): number => {
  const [first = 0] = (colour.match(/[\d.]+/gu) ?? []).map(Number);

  return colour.startsWith("color(") ? first * 255 : first;
};

const background = (selector: string, pseudo?: string): string =>
  getComputedStyle(pick(selector), pseudo).backgroundColor;

const luminance = (colour: string): number => {
  const channel = grey(colour) / 255;

  return channel <= 0.04 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
};

const contrast = (a: number, b: number): number =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

describe("default styles", () => {
  afterEach(async () => {
    await cleanup();
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

    expect(dial.getBoundingClientRect().height).toBeGreaterThan(0);
    expect(getComputedStyle(dial).overflowX).toBe("clip");
    expect(getComputedStyle(dial).overflowY).toBe("visible");
  });

  it("gives minor ticks 3:1 contrast on the page in light and dark mode", async () => {
    const api = createRef<CropperApi>();

    for (const [theme, page] of [
      ["light", 1],
      ["dark", 0],
    ] as const) {
      const screen = await render(
        <div data-theme={theme}>
          <Editor api={api} />
        </div>
      );

      await frames(2);

      expect(
        contrast(
          luminance(
            background('[data-zriz-item="dial-ticks"] > :not([data-major])')
          ),
          page
        )
      ).toBeGreaterThanOrEqual(3);

      await screen.unmount();
    }
  });

  it("hides the corner handles of a circle and keeps the edge ones", async () => {
    await render(
      <Cropper.Root
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
      </Cropper.Root>
    );

    await frames(2);

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

  it("lets every point of a handle's box reach the handle", async () => {
    const api = createRef<CropperApi>();

    await render(<Editor api={api} />);
    await frames(3);
    const handles = [
      ...document.querySelectorAll<HTMLElement>('[data-zriz-item="handle"]'),
    ];
    const view = pick('[data-zriz-item="viewport"]').getBoundingClientRect();
    const missed: string[] = [];

    for (const handle of handles) {
      const box = handle.getBoundingClientRect();
      const left = Math.max(box.left, view.left);
      const top = Math.max(box.top, view.top);
      const right = Math.min(box.right, view.right);
      const bottom = Math.min(box.bottom, view.bottom);

      for (let x = left + 1; x < right - 1; x += 4) {
        for (let y = top + 1; y < bottom - 1; y += 4) {
          const hit = document.elementFromPoint(x, y);

          if (!hit || !handle.contains(hit)) {
            missed.push(
              `${handle.dataset.edge} ${x - box.left},${y - box.top}`
            );
          }
        }
      }
    }

    expect(handles).toHaveLength(3);
    expect(missed).toStrictEqual([]);
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

const running = (selector: string): string[] =>
  pick(selector)
    .getAnimations()
    .map((animation) =>
      animation instanceof CSSTransition ? animation.transitionProperty : ""
    );

const Moving = ({ api }: EditorProps) => (
  <Cropper.Root actionsRef={api} image={{ height: 300, width: 400 }}>
    <Cropper.Viewport
      style={{ height: 300, padding: 20, position: "relative", width: 400 }}
    >
      <Cropper.Mask />
      <Cropper.Area aria-label="Crop" />
    </Cropper.Viewport>
    <Cropper.Dial aria-label="Straighten" style={{ height: 40, width: 361 }}>
      <Cropper.DialTicks />
    </Cropper.Dial>
    <Cropper.Zoom aria-label="Zoom" style={{ height: 20, width: 200 }}>
      <Cropper.ZoomThumb />
    </Cropper.Zoom>
  </Cropper.Root>
);

const ring = () => {
  const area = pick('[data-zriz-item="area"]');
  const own = getComputedStyle(area);
  const line = getComputedStyle(area, "::after");

  return {
    inner: [line.outlineStyle, line.outlineWidth, line.top, line.left],
    outer: [own.outlineStyle, own.outlineWidth, own.outlineOffset],
  };
};

describe("a page-wide transition", () => {
  const rule = document.createElement("style");

  rule.textContent = "*,*::before,*::after{transition:all .2s}";

  afterEach(async () => {
    rule.remove();
    await cleanup();
  });

  it("leaves every per-frame write on the crop, the ruler and the thumb instant, and keeps the fade of the scrim", async () => {
    document.head.append(rule);
    const api = createRef<CropperApi>();

    await render(<Moving api={api} />);
    await frames(2);
    await expect.poll(() => document.getAnimations().length).toBe(0);
    api.current?.setRotation(9);
    api.current?.setZoom(2);
    const state = api.current?.getCropState();

    if (state) {
      api.current?.setCropState({
        ...state,
        crop: { ...state.crop, width: state.crop.width - 40 },
      });
    }

    await frames(2);
    const area = pick('[data-zriz-item="area"]');

    expect(running('[data-zriz-item="area"]')).toStrictEqual([]);
    expect(running('[data-zriz-item="dial-ticks"]')).toStrictEqual([]);
    expect(running('[data-zriz-item="zoom-thumb"]')).toStrictEqual([]);
    expect(running('[data-zriz-item="mask"]')).not.toContain("clip-path");

    expect(area.getBoundingClientRect().width).toBeCloseTo(
      Number(area.style.width.replace("px", "")),
      1
    );

    api.current?.begin("pan");

    await expect
      .poll(() => running('[data-zriz-item="mask"]'))
      .toContain("opacity");

    api.current?.end();
  });

  it("keeps the area in view, still, opaque and focused through a turn", async () => {
    document.head.append(rule);
    const api = createRef<CropperApi>();

    await render(<Editor api={api} />);
    await frames(2);
    await userEvent.tab();
    const area = pick('[data-zriz-item="area"]');
    const root = pick('[data-zriz-item="root"]');

    await expect.poll(() => area.matches(":focus-visible")).toBeTruthy();
    await expect.poll(() => document.getAnimations().length).toBe(0);
    const focused = ring().outer;

    api.current?.rotate90();
    await expect.poll(() => root.dataset.transition).toBe("rotate");
    expect(getComputedStyle(area).opacity).toBe("1");
    expect(area.getAnimations()).toStrictEqual([]);
    expect(area.matches(":focus-visible")).toBeTruthy();
    expect(ring().outer).toStrictEqual(focused);
    await expect.poll(() => root.dataset.transition).toBeUndefined();
  });
});

describe("layer order on the page", () => {
  const held: HTMLIFrameElement[] = [];

  afterEach(async () => {
    user.remove();
    await cleanup();

    for (const frame of held.splice(0)) {
      frame.remove();
    }
  });

  const SCRIM = "@layer app { .my-scrim { background: rgb(255 0 0); } }";
  const SITE =
    "@layer reset { .site { color: rgb(0 0 255); } } @layer utilities { .site { color: rgb(0 128 0); } }";
  const RED = "rgb(255, 0, 0)";
  const GREEN = "rgb(0, 128, 0)";
  const BLUE = "rgb(0, 0, 255)";
  const file = URL.createObjectURL(
    new Blob([stylesheet], { type: "text/css" })
  );

  const pageWith = (...css: string[]): (() => [string, string]) => {
    const frame = document.createElement("iframe");

    frame.srcdoc = `<!doctype html>${css.map((text) => `<style>${text}</style>`).join("")}<p class="site"></p><div class="my-scrim" data-zriz-item="mask"></div>`;
    document.body.append(frame);
    held.push(frame);

    return () => {
      const win = frame.contentWindow;
      const doc = frame.contentDocument;
      const site = doc?.querySelector(".site");
      const mask = doc?.querySelector(".my-scrim");

      return win && site && mask
        ? [
            win.getComputedStyle(site).color,
            win.getComputedStyle(mask).backgroundColor,
          ]
        : ["", ""];
    };
  };

  it("lets a class with no layer win in either order, on the page and in a frame", async () => {
    document.head.append(user);
    const api = createRef<CropperApi>();

    await render(<Editor api={api} />);
    await frames(2);

    expect(
      getComputedStyle(pick('[data-zriz-item="mask"]')).backgroundColor
    ).toBe(RED);

    expect(
      getComputedStyle(pick('[data-zriz-item="dial-ticks"] > [data-major]'))
        .backgroundColor
    ).toBe(GREEN);

    const plain = ".my-scrim { background: rgb(255 0 0); }";
    const first = pageWith(plain, stylesheet);
    const last = pageWith(stylesheet, plain);

    await expect.poll(() => first()[1]).toBe(RED);
    await expect.poll(() => last()[1]).toBe(RED);
  });

  it("sets the order of the usual layers, loses to a later layer, and loses to every page layer when imported into one", async () => {
    const usual = pageWith(stylesheet, `@layer reset, utilities; ${SITE}`);
    const after = pageWith(stylesheet, SCRIM);
    const before = pageWith(SCRIM, stylesheet);
    const vendor = pageWith(
      `@layer vendor, reset, app, utilities; @import url("${file}") layer(vendor); ${SCRIM} ${SITE}`
    );

    await expect.poll(() => usual()[0]).toBe(BLUE);
    await expect.poll(() => after()[1]).toBe(RED);
    await expect.poll(() => before()[1]).not.toBe("");
    await expect.poll(() => before()[1]).not.toBe(RED);
    await expect.poll(() => vendor()).toStrictEqual([GREEN, RED]);
  });
});

describe("the focus ring on the crop", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("draws the ring inside the crop on keyboard focus at padding 0, and keeps the plain frame on a mouse press", async () => {
    await render(
      <Cropper.Root image={{ height: 300, width: 400 }}>
        <Cropper.Viewport
          style={{ height: 300, padding: 0, position: "relative", width: 400 }}
        >
          <Cropper.Area aria-label="Crop" />
        </Cropper.Viewport>
      </Cropper.Root>
    );

    await frames(2);
    const area = pick('[data-zriz-item="area"]');
    const plain = ring();

    await userEvent.tab();
    await expect.poll(() => area.matches(":focus-visible")).toBeTruthy();
    const keyboard = ring();

    expect({
      inner: keyboard.inner.join(" ") === plain.inner.join(" "),
      inset: Number(keyboard.inner[2]?.replace("px", "")) > 0,
      outer: keyboard.outer.join(" ") === plain.outer.join(" "),
      style: keyboard.outer[0],
    }).toStrictEqual({
      inner: false,
      inset: true,
      outer: false,
      style: "solid",
    });

    area.blur();
    await userEvent.click(area);
    await expect.poll(() => document.activeElement).toBe(area);
    expect(area.matches(":focus-visible")).toBeFalsy();
    expect(ring()).toStrictEqual(plain);
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

  it("paints the corner marks only while a photo is placed after hydration", async () => {
    const empty = await hydrate(noPhoto);

    await frames();
    const marks = painted('[data-edge="top-left"]', "::before");

    empty.root.unmount();
    document.body.replaceChildren();
    expect(marks).toBeFalsy();
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

  it("paints system colours with no override, through colour variables, and loses to a class that paints a system colour", async () => {
    await commands.forcedColors("active");
    expect(matchMedia("(forced-colors)").matches).toBeTruthy();
    await placeRotated();
    expect(paintedColours()).toStrictEqual(everyPart(system("CanvasText")));
    await cleanup();

    page.textContent = `
      [data-zriz-item="handle"], [data-zriz-item="grid"], [data-zriz-item="area"],
      [data-zriz-item="dial"], [data-zriz-item="dial-ticks"],
      [data-zriz-item="grid"] > *, [data-zriz-item="dial-ticks"] > * {
        --zriz-line: #0a84ff; --zriz-grid: #0a84ff; --zriz-tick: #0a84ff; --zriz-accent: #0a84ff;
      }`;

    document.head.append(page);
    await placeRotated();
    expect(paintedColours()).toStrictEqual(everyPart(system("CanvasText")));
    await cleanup();

    page.textContent = ".user-tick > * { background: Highlight; }";
    await placeRotated();

    expect(background('[data-zriz-item="dial-ticks"] > *')).toBe(
      system("Highlight")
    );
  });

  it("puts the scrim on the forced palette, whatever a theme wrapper says", async () => {
    await commands.forcedColors("active");

    for (const theme of ["light", "dark"]) {
      const api = createRef<CropperApi>();
      const screen = await render(
        <div data-theme={theme}>
          <Editor api={api} />
        </div>
      );

      await frames(2);
      const scrim = background('[data-zriz-item="mask"]');
      const canvas = system("Canvas");

      expect(scrim.match(/\d+/gu)?.slice(0, 3)).toStrictEqual(
        canvas.match(/\d+/gu)?.slice(0, 3)
      );

      await screen.unmount();
    }
  });

  it("keeps the dial line on Highlight during a drag with a custom accent, and leaves a page element with data-zero alone", async () => {
    page.textContent =
      '[data-zriz-item="dial"] { --zriz-accent: #0a84ff; } .mine::before { content: "label"; }';

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
});
