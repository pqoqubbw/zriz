import "../../core/src/styles.css";
import type { Cropper as CropperApi, CropValue } from "@zriz/core";
import axe from "axe-core";
import { createRef, useState } from "react";
import type { ReactNode } from "react";
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

type EditorProps = { api: React.Ref<CropperApi> };

const Editor = ({ api }: EditorProps) => (
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

describe("accessibility", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("gets the application role so arrow keys reach it in browse mode, and takes another role from the caller", async () => {
    const screen = await render(
      <Cropper.Root image={{ height: 300, width: 400 }}>
        <Cropper.Viewport style={{ height: 300, width: 400 }}>
          <Cropper.Area aria-label="Crop" />
        </Cropper.Viewport>
      </Cropper.Root>
    );
    const area = screen.container.querySelector('[data-zriz-item="area"]');

    expect(area?.getAttribute("role")).toBe("application");

    await screen.rerender(
      <Cropper.Root image={{ height: 300, width: 400 }}>
        <Cropper.Viewport style={{ height: 300, width: 400 }}>
          <Cropper.Area aria-label="Crop" role="toolbar" />
        </Cropper.Viewport>
      </Cropper.Root>
    );

    expect(area?.getAttribute("role")).toBe("toolbar");
  });

  it("has no axe violations", async () => {
    const api = createRef<CropperApi>();
    const screen = await render(<Editor api={api} />);

    await frames(3);
    const result = await axe.run(screen.container);

    expect(result.violations.map((v) => v.id)).toStrictEqual([]);
  });

  it.each(["Saved", "Saved "])(
    "speaks %j again after every later commit",
    async (message) => {
      const api = createRef<CropperApi>();
      const screen = await render(
        <Cropper.Root actionsRef={api} image={PHOTO}>
          <Cropper.Announcer announce={() => message} />
        </Cropper.Root>
      );
      const region = (): string =>
        screen.container.querySelector('[role="status"]')?.textContent ?? "";
      const said: string[] = [];

      for (const quarter of [1, 2, 3]) {
        api.current?.setRotation(quarter);
        await frames(4);
        said.push(region());
      }

      expect(said.map((text) => text.trim())).toStrictEqual([
        "Saved",
        "Saved",
        "Saved",
      ]);

      expect(said[1]).not.toBe(said[0]);
      expect(said[2]).not.toBe(said[1]);
    }
  );

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

  it("moves through the aspect group with arrows, wraps, jumps to the ends and keeps one tab stop", async () => {
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

    const press = async (key: string) => {
      await userEvent.keyboard(key);
      await frames(2);
      const aspect = api.current?.getValue().aspect;

      return {
        aspect: typeof aspect === "number" ? Number(aspect.toFixed(6)) : aspect,
        focused: items
          .map((each) => each === document.activeElement)
          .indexOf(true),
        stops: items.map((each) => each.tabIndex),
      };
    };

    const wide = Number((16 / 9).toFixed(6));

    expect(items.map((each) => each.tabIndex)).toStrictEqual([0, -1, -1]);
    items[0]?.focus();

    expect([
      await press("{ArrowRight}"),
      await press("{Home}"),
      await press("{ArrowLeft}"),
      await press("{Home}"),
      await press("{End}"),
    ]).toStrictEqual([
      { aspect: 1, focused: 1, stops: [-1, 0, -1] },
      { aspect: "free", focused: 0, stops: [0, -1, -1] },
      { aspect: wide, focused: 2, stops: [-1, -1, 0] },
      { aspect: "free", focused: 0, stops: [0, -1, -1] },
      { aspect: wide, focused: 2, stops: [-1, -1, 0] },
    ]);
  });

  it("pressing the checked aspect again keeps the zoom and sends no commit", async () => {
    const api = createRef<CropperApi>();
    const commit = vi.fn<() => void>();
    const screen = await render(
      <Cropper.Root
        actionsRef={api}
        defaultValue={{ aspect: 1 }}
        image={{ height: 300, width: 400 }}
        onValueCommit={commit}
      >
        <Cropper.AspectGroup aria-label="Aspect">
          <Cropper.AspectItem value={1}>Square</Cropper.AspectItem>
          <Cropper.AspectItem value={16 / 9}>Wide</Cropper.AspectItem>
        </Cropper.AspectGroup>
      </Cropper.Root>
    );

    await frames(2);
    api.current?.setZoom(3);
    await frames(3);
    commit.mockClear();
    const square = screen.container.querySelector<HTMLButtonElement>(
      '[data-zriz-item="aspect-item"]'
    );

    square?.click();
    square?.focus();
    await userEvent.keyboard("{Home}");
    await frames(3);
    expect(api.current?.getZoom()).toBeCloseTo(3, 6);
    expect(commit).not.toHaveBeenCalled();
  });

  it("the wrap on a circle's only enabled aspect keeps the zoom", async () => {
    const api = createRef<CropperApi>();
    const commit = vi.fn<() => void>();
    const screen = await render(
      <Cropper.Root
        actionsRef={api}
        image={{ height: 300, width: 400 }}
        onValueCommit={commit}
        shape="circle"
      >
        <Cropper.AspectGroup aria-label="Aspect">
          <Cropper.AspectItem value="free">Free</Cropper.AspectItem>
          <Cropper.AspectItem value={1}>Square</Cropper.AspectItem>
        </Cropper.AspectGroup>
      </Cropper.Root>
    );

    await frames(2);
    api.current?.setZoom(3);
    await frames(3);
    commit.mockClear();

    screen.container
      .querySelector<HTMLButtonElement>('[aria-checked="true"]')
      ?.focus();

    await userEvent.keyboard("{ArrowRight}");
    await frames(3);
    expect(api.current?.getZoom()).toBeCloseTo(3, 6);
    expect(commit).not.toHaveBeenCalled();
  });

  it("keeps one tab stop with no item checked, also when items change inside their own component", async () => {
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

  it("warns once for an unnamed part, accepts title, and warns once per slider for a malformed locale", async () => {
    const warn = vi.spyOn(console, "warn").mockReturnValue(undefined);
    const said = (): string[] => warn.mock.calls.map((call) => String(call[0]));

    await render(
      <Cropper.Root image={PHOTO}>
        <Cropper.Dial />
        <Cropper.Dial />
        <Cropper.Area title="Crop" />
      </Cropper.Root>
    );

    expect(said()).toStrictEqual([expect.stringContaining("Cropper.Dial")]);

    await render(
      <Cropper.Root image={PHOTO}>
        <Cropper.Zoom>
          <span>150%</span>
        </Cropper.Zoom>
      </Cropper.Root>
    );

    expect(said().slice(1)).toStrictEqual([
      expect.stringContaining("Cropper.Zoom"),
    ]);

    const screen = await render(
      <Cropper.Root locale="pt_BR">
        <Cropper.Dial aria-label="straighten" />
        <Cropper.Zoom aria-label="zoom" />
      </Cropper.Root>
    );

    expect(
      screen.container.querySelector('[data-zriz-item="dial"]')
    ).not.toBeNull();

    expect(said().slice(2)).toStrictEqual([
      expect.stringContaining("Cropper.Dial"),
      expect.stringContaining("Cropper.Zoom"),
    ]);

    warn.mockRestore();
  });

  it.each<{
    dial?: Intl.NumberFormatOptions;
    locale: string;
    name: string;
    zoom: Intl.NumberFormatOptions;
    texts: unknown[];
  }>([
    {
      dial: { style: "currency" },
      locale: "de",
      name: "a format the browser refuses",
      texts: ["0 Grad", expect.stringMatching(/^100\s%$/u)],
      zoom: { maximumFractionDigits: 200 },
    },
    {
      dial: { minimumFractionDigits: 2 },
      locale: "en",
      name: "more digits than the default allows",
      texts: ["0.00 degrees", "100.0%"],
      zoom: { minimumFractionDigits: 1 },
    },
    {
      locale: "en",
      name: "conflicting digits",
      texts: ["100%"],
      zoom: { maximumFractionDigits: 1, minimumFractionDigits: 2 },
    },
    {
      locale: "en_US",
      name: "a bad locale with a valid format",
      texts: ["1"],
      zoom: { style: "decimal" },
    },
  ])(
    "speaks the value text with $name",
    async ({ dial, locale, texts, zoom }) => {
      const screen = await render(
        <Cropper.Root image={PHOTO} locale={locale}>
          {dial ? <Cropper.Dial aria-label="Dial" format={dial} /> : null}
          <Cropper.Zoom aria-label="Zoom" format={zoom} />
        </Cropper.Root>
      );

      expect(
        [...screen.container.querySelectorAll('[role="slider"]')].map(
          (slider) => slider.getAttribute("aria-valuetext")
        )
      ).toStrictEqual(texts);
    }
  );
});

describe("an Area with no photo", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("leaves the tab order until a photo is placed, and keeps a tabIndex of the caller", async () => {
    const api = createRef<CropperApi>();
    const screen = await render(
      <Cropper.Root actionsRef={api}>
        <button id="before" type="button">
          before
        </button>
        <Cropper.Viewport style={{ height: 300, width: 400 }}>
          <Cropper.Area aria-label="Crop" />
        </Cropper.Viewport>
        <Cropper.Dial
          aria-label="Straighten"
          style={{ height: 40, width: 361 }}
        />
      </Cropper.Root>
    );
    const area = screen.container.querySelector<HTMLElement>(
      '[data-zriz-item="area"]'
    );
    const dial = screen.container.querySelector('[data-zriz-item="dial"]');
    const before = screen.container.querySelector<HTMLElement>("#before");

    before?.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(dial);

    api.current?.setImage({ height: 300, width: 400 });
    await expect.poll(() => area?.tabIndex).toBe(0);
    before?.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(area);

    api.current?.setImage(null);
    await expect.poll(() => area?.tabIndex).toBe(-1);

    const own = await render(
      <Cropper.Root>
        <Cropper.Viewport style={{ height: 300, width: 400 }}>
          <Cropper.Area aria-label="Crop" tabIndex={0} />
        </Cropper.Viewport>
      </Cropper.Root>
    );

    expect(item(own.container, "area").tabIndex).toBe(0);
  });
});

describe("part states", () => {
  afterEach(async () => {
    await cleanup();
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
});

type GroupProps = { api: React.Ref<CropperApi> };

const Group = ({ api }: GroupProps) => (
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

type PartsProps = { disabled: boolean };

const Parts = ({ disabled }: PartsProps) => (
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

type CallerDisabledProps = { off: boolean };

const CallerDisabled = ({ off }: CallerDisabledProps) => (
  <Cropper.Root disabled={off} image={PHOTO}>
    <Cropper.Area aria-disabled aria-label="Crop" />
    <Cropper.Dial aria-disabled aria-label="Dial" />
    <Cropper.Zoom aria-disabled aria-label="Zoom" />
    <Cropper.Rotate aria-disabled>Rotate</Cropper.Rotate>
  </Cropper.Root>
);

type QuietItemProps = { off: boolean };

const QuietItem = ({ off }: QuietItemProps) => (
  <Cropper.Root defaultValue={{ aspect: 1 }} image={PHOTO}>
    <Cropper.AspectGroup aria-label="Aspect">
      <Cropper.AspectItem
        disabled={off}
        render={({ disabled: _native, ...rest }) => <div {...rest} />}
        value={1}
      >
        Square
      </Cropper.AspectItem>
      <Cropper.AspectItem render={<div />} value={2}>
        Wide
      </Cropper.AspectItem>
    </Cropper.AspectGroup>
  </Cropper.Root>
);

type SlidersProps = { api?: React.Ref<CropperApi> } & React.ComponentProps<
  typeof Cropper.Root
>;

const Sliders = ({ api, ...props }: SlidersProps) => (
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

const turned = async (api: { current: CropperApi | null }): Promise<void> => {
  await frames();
  api.current?.setRotation(10);
  await frames(3);
};

describe("focus when Reset hides", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("moves focus to Area when a press hides the focused button, and on a reset from outside through a portal", async () => {
    const api = createRef<CropperApi>();
    const away = document.createElement("div");

    document.body.append(away);
    const screen = await render(
      <Cropper.Root actionsRef={api} image={PHOTO}>
        <Cropper.Viewport style={{ height: 300, width: 400 }}>
          <Cropper.Area aria-label="Crop" />
        </Cropper.Viewport>
        <Cropper.Reset id="here">Reset</Cropper.Reset>
        {createPortal(<Cropper.Reset id="away">Reset</Cropper.Reset>, away)}
      </Cropper.Root>
    );

    await turned(api);
    const here = screen.container.querySelector<HTMLElement>("#here");

    here?.focus();
    await userEvent.keyboard("{Enter}");

    await vi.waitFor(() => {
      expect(here?.hidden).toBeTruthy();
    });

    expect(document.activeElement).toBe(item(screen.container, "area"));

    await turned(api);
    const there = away.querySelector<HTMLElement>("#away");

    there?.focus();
    expect(document.activeElement).toBe(there);
    api.current?.reset();

    await vi.waitFor(() => {
      expect(there?.hidden).toBeTruthy();
    });

    expect(document.activeElement).toBe(item(screen.container, "area"));
    await cleanup();
    away.remove();
  });

  it.each<{ name: string; parts: ReactNode; target: string }>([
    {
      name: "to the next control without an Area",
      parts: (
        <>
          <Cropper.Reset>Reset</Cropper.Reset>
          <Cropper.Rotate>Rotate</Cropper.Rotate>
        </>
      ),
      target: '[data-zriz-item="rotate"]',
    },
    {
      name: "to a native input before a later button",
      parts: (
        <>
          <Cropper.Reset>Reset</Cropper.Reset>
          <input aria-label="Zoom" id="slider" type="range" />
          <Cropper.Rotate>Rotate</Cropper.Rotate>
        </>
      ),
      target: "#slider",
    },
    {
      name: "past an Area that cannot take focus",
      parts: (
        <>
          <Cropper.Viewport style={{ display: "none" }}>
            <Cropper.Area aria-label="Crop" />
          </Cropper.Viewport>
          <Cropper.Reset>Reset</Cropper.Reset>
          <Cropper.Rotate>Rotate</Cropper.Rotate>
        </>
      ),
      target: '[data-zriz-item="rotate"]',
    },
    {
      name: "past itself when it has its own tabIndex",
      parts: (
        <>
          <Cropper.Reset tabIndex={0}>Reset</Cropper.Reset>
          <Cropper.Rotate>Rotate</Cropper.Rotate>
        </>
      ),
      target: '[data-zriz-item="rotate"]',
    },
  ])("falls back $name", async ({ parts, target }) => {
    const api = createRef<CropperApi>();
    const screen = await render(
      <Cropper.Root actionsRef={api} image={PHOTO}>
        {parts}
      </Cropper.Root>
    );

    await turned(api);
    const reset = item(screen.container, "reset");

    reset.focus();
    reset.click();

    await vi.waitFor(() => {
      expect(reset.hidden).toBeTruthy();
    });

    expect(document.activeElement).toBe(screen.container.querySelector(target));
  });

  it("leaves focus alone on another part, and on a button that stays visible", async () => {
    const api = createRef<CropperApi>();
    const screen = await render(
      <Cropper.Root actionsRef={api} image={PHOTO}>
        <Cropper.Viewport style={{ height: 300, width: 400 }}>
          <Cropper.Area aria-label="Crop" />
        </Cropper.Viewport>
        <Cropper.Reset>Reset</Cropper.Reset>
        <Cropper.Rotate>Rotate</Cropper.Rotate>
      </Cropper.Root>
    );

    await turned(api);
    const rotate = item(screen.container, "rotate");

    rotate.focus();
    api.current?.reset();

    await vi.waitFor(() => {
      expect(item(screen.container, "reset").hidden).toBeTruthy();
    });

    await frames();
    expect(document.activeElement).toBe(rotate);
    await cleanup();

    const kept = await render(
      <Cropper.Root actionsRef={api} image={PHOTO}>
        <Cropper.Viewport style={{ height: 300, width: 400 }}>
          <Cropper.Area aria-label="Crop" />
        </Cropper.Viewport>
        <Cropper.Reset hidden={false}>Keep</Cropper.Reset>
        <Cropper.Rotate>Rotate</Cropper.Rotate>
      </Cropper.Root>
    );

    await turned(api);
    const reset = item(kept.container, "reset");

    reset.focus();
    reset.click();

    await vi.waitFor(() => {
      expect(reset.dataset.pristine).toBe("");
    });

    expect(document.activeElement).toBe(reset);
  });
});

describe("aspect items that are not buttons", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("tells assistive tech which items are disabled, a circle-locked one included", async () => {
    const api = createRef<CropperApi>();
    const screen = await render(<Group api={api} />);

    expect(
      [...screen.container.querySelectorAll<HTMLElement>('[role="radio"]')].map(
        (radio) => radio.getAttribute("aria-disabled")
      )
    ).toStrictEqual([null, "true", null]);

    const circle = await render(
      <Cropper.Root image={PHOTO} shape="circle">
        <Cropper.AspectItem render={<div />} value={2}>
          Wide
        </Cropper.AspectItem>
      </Cropper.Root>
    );

    expect(
      item(circle.container, "aspect-item").getAttribute("aria-disabled")
    ).toBe("true");
  });

  it("moves the tab stop when an item that hides the attribute turns disabled", async () => {
    const screen = await render(<QuietItem off={false} />);

    await frames();
    const radios = [
      ...screen.container.querySelectorAll<HTMLElement>('[role="radio"]'),
    ];

    expect(radios[1]?.tabIndex).toBe(-1);
    await screen.rerender(<QuietItem off />);

    await vi.waitFor(() => {
      expect(radios[1]?.tabIndex).toBe(0);
    });
  });

  it("skips a disabled item with arrows and ignores a click on it", async () => {
    const api = createRef<CropperApi>();
    const screen = await render(<Group api={api} />);

    await frames();
    const radios = [
      ...screen.container.querySelectorAll<HTMLElement>('[role="radio"]'),
    ];

    radios[1]?.click();
    await frames();
    expect(api.current?.getValue().aspect).toBe(1);
    radios[0]?.focus();
    await userEvent.keyboard("{ArrowRight}");
    await frames();
    expect(api.current?.getValue().aspect).toBe(3);
    expect(document.activeElement).toBe(radios[2]);
    expect(radios.map((radio) => radio.tabIndex)).toStrictEqual([-1, -1, 0]);
  });
});

describe("a disabled AspectItem", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("reports its disabled prop in the attribute and the state, ignores presses, and stays locked on a circle with disabled false", async () => {
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
    await cleanup();

    const circle = await render(
      <Cropper.Root actionsRef={api} image={PHOTO} shape="circle">
        <Cropper.AspectItem disabled={false} value={4 / 3}>
          Wide
        </Cropper.AspectItem>
      </Cropper.Root>
    );
    const locked = item(circle.container, "aspect-item");

    locked.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await frames();

    expect({
      aspect: api.current?.getValue().aspect,
      disabled: locked.hasAttribute("disabled"),
      marked: locked.dataset.disabled,
    }).toStrictEqual({ aspect: 1, disabled: true, marked: "" });
  });
});

describe("a disabled Root", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("tells assistive tech on every control, and takes it back", async () => {
    const marks = (container: Element): (string | null)[] =>
      NAMES.map((name) => item(container, name).getAttribute("aria-disabled"));
    const screen = await render(<Parts disabled />);

    expect(marks(screen.container)).toStrictEqual(NAMES.map(() => "true"));
    await screen.rerender(<Parts disabled={false} />);
    await frames();
    expect(marks(screen.container)).toStrictEqual(NAMES.map(() => null));
    await screen.rerender(<Parts disabled />);
    await frames();
    expect(marks(screen.container)).toStrictEqual(NAMES.map(() => "true"));
    await screen.rerender(<Parts disabled={false} />);
    await frames();
    expect(marks(screen.container)).toStrictEqual(NAMES.map(() => null));
  });

  it("lets the caller's aria-disabled win while disabled and survive Root leaving disabled", async () => {
    const own = await render(
      <Cropper.Root disabled image={PHOTO}>
        <Cropper.Rotate aria-disabled={false}>Rotate</Cropper.Rotate>
      </Cropper.Root>
    );

    expect(item(own.container, "rotate").getAttribute("aria-disabled")).toBe(
      "false"
    );

    await cleanup();
    const screen = await render(<CallerDisabled off />);

    await frames();
    await screen.rerender(<CallerDisabled off={false} />);
    await frames();

    for (const name of ["area", "dial", "zoom", "rotate"]) {
      expect(item(screen.container, name).getAttribute("aria-disabled")).toBe(
        "true"
      );
    }
  });
});

type TextSlidersProps = {
  api: React.Ref<CropperApi>;
  text: string | undefined;
};

const TextSliders = ({ api, text }: TextSlidersProps) => (
  <Cropper.Root actionsRef={api} image={{ height: 300, width: 400 }}>
    <Cropper.Viewport style={{ height: 300, width: 400 }} />
    <Cropper.Dial
      aria-label="Straighten"
      aria-valuetext={text}
      format={{ maximumFractionDigits: 0 }}
      style={{ height: 40, width: 361 }}
    />
    <Cropper.Zoom
      aria-label="Zoom"
      aria-valuetext={text}
      format={{ maximumFractionDigits: 0 }}
      style={{ height: 20, width: 200 }}
    />
  </Cropper.Root>
);

const spokenTexts = (container: Element): (string | null)[] =>
  [...container.querySelectorAll('[role="slider"]')].map((slider) =>
    slider.getAttribute("aria-valuetext")
  );

describe("an aria-valuetext from the caller", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("wins over format through moves and changes of its own, and hands back to format when it goes away", async () => {
    const api = createRef<CropperApi>();
    const screen = await render(<TextSliders api={api} text="tilted" />);

    await frames(2);
    expect(spokenTexts(screen.container)).toStrictEqual(["tilted", "tilted"]);

    api.current?.setRotation(7);
    api.current?.setZoom(2);
    await frames(3);
    expect(spokenTexts(screen.container)).toStrictEqual(["tilted", "tilted"]);

    await screen.rerender(<TextSliders api={api} text="steep" />);
    await frames(2);
    expect(spokenTexts(screen.container)).toStrictEqual(["steep", "steep"]);

    await screen.rerender(<TextSliders api={api} text={undefined} />);
    await frames(2);
    const [dial, zoom] = spokenTexts(screen.container);

    expect(dial).toMatch(/\d/u);
    expect(zoom).toMatch(/\d/u);
  });
});

describe("slider values follow every move", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("reads a new value prop and marks the zero again, and reads a saved zoom after the first fit", async () => {
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
    await cleanup();

    const saved = await render(
      <Sliders defaultValue={{ size: { height: 0.25, width: 0.25 } }} />
    );

    await vi.waitFor(() => {
      expect(item(saved.container, "zoom").getAttribute("aria-valuenow")).toBe(
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
    const before = api.current?.getValue();

    await screen.rerender(<Sliders api={api} maxZoom={5} />);

    await vi.waitFor(() => {
      expect(item(screen.container, "zoom").getAttribute("aria-valuemax")).toBe(
        "5"
      );
    });

    expect(api.current?.getValue()).toStrictEqual(before);

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
