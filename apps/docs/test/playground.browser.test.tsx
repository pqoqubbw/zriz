import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { commands as browser, page, server, userEvent } from "vitest/browser";

import "../app/globals.css";

import { Controls } from "../components/doc/controls";
import { CopyAction } from "../components/doc/copy-button";
import { Demo } from "../components/doc/demo";
import { PLAYGROUND_PAGE } from "../content/playground";
import { codeText, jsonText } from "../demos/playground/code";
import { DownloadAction } from "../demos/playground/download-action";
import { LiveCode } from "../demos/playground/live-code";
import { LiveLog } from "../demos/playground/live-log";
import { PlaygroundCopy } from "../demos/playground/playground-copy";
import { DEFAULT_KNOBS, playground } from "../demos/playground/store";
import { walkBlocks } from "../lib/doc/anchors";
import type { Control } from "../lib/doc/schema";
import START_VALUE from "../snippets/playground/value.json";
import { find, item, ready, settle } from "./demos/helpers";

type Value = {
  center: { x: number; y: number };
  perspective: { horizontal: number; vertical: number };
  rotation: number;
  size: { height: number; width: number };
};

type Path = readonly (readonly [number, number, number?])[];

type Tools = {
  drag: (selector: string, path: Path) => Promise<void>;
  pinch: (
    selector: string,
    a: Path,
    b: Path,
    release: boolean
  ) => Promise<void>;
};

type Tally = {
  canvases: number;
  listeners: number;
  urls: number;
};

vi.mock(import("../demos/shell/photo"), async () => {
  const { photoMock } = await import("./demos/fixtures");

  return await photoMock();
});

const isTools = (value: object): value is Tools =>
  "drag" in value && "pinch" in value;

const toolsOf = (value: object): Tools => {
  if (!isTools(value)) {
    throw new Error("no test commands");
  }

  return value;
};

const commands = toolsOf(browser);

const START_TEXT = jsonText(START_VALUE);

const wait = async (ms: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const turn = async (): Promise<void> => {
  await commands.pinch(
    item("viewport"),
    [
      [196, 190],
      [194, 170, 1],
      [190, 150, 1],
    ],
    [
      [356, 190],
      [358, 210, 1],
      [362, 230, 1],
    ],
    true
  );

  await settle();
};

const CONTROLS: readonly Control[] = walkBlocks(PLAYGROUND_PAGE.blocks).flatMap(
  (block) => (block.kind === "controls" ? block.controls : [])
);

const FAKE_TIMERS: Parameters<typeof vi.useFakeTimers>[0] = {
  shouldAdvanceTime: true,
  toFake: ["setTimeout", "clearTimeout"],
};

const ids = new WeakMap<object, number>();

let nextId = 0;

const idOf = (listener: object): number => {
  const known = ids.get(listener);

  if (known !== undefined) {
    return known;
  }

  nextId += 1;
  ids.set(listener, nextId);

  return nextId;
};

const keyOf = (
  target: unknown,
  type: string,
  listener: EventListenerOrEventListenerObject | null
): string | null => {
  if (listener === null || (target !== window && target !== document)) {
    return null;
  }

  return `${target === window ? "window" : "document"} ${type} ${idOf(listener)}`;
};

const Page = () => (
  <div className="flex w-140 flex-col gap-6">
    <Demo className="" name="playground" />
    <Controls bind="playground" className="" controls={CONTROLS} />
    <section data-copy="">
      <pre data-testid="code">
        <LiveCode feed="code" />
      </pre>
      <CopyAction label="copy code" />
    </section>
    <section data-copy="">
      <pre data-testid="value">
        <LiveCode feed="value" />
      </pre>
      <PlaygroundCopy label="copy value" />
    </section>
    <div data-testid="log">
      <LiveLog />
    </div>
    <DownloadAction label="download png" />
  </div>
);

const mount = async () => await render(<Page />);

const shownCode = (): string => find('[data-testid="code"] code').textContent;

const shownValue = (): string => find('[data-testid="value"] code').textContent;

const isValue = (value: unknown): value is Value =>
  typeof value === "object" &&
  value !== null &&
  ["center", "perspective", "rotation", "size"].every((key) =>
    Object.hasOwn(value, key)
  );

const inputOf = (selector: string): HTMLInputElement => {
  const found = find(selector);

  if (!(found instanceof HTMLInputElement)) {
    throw new TypeError(`${selector} is not an input`);
  }

  return found;
};

const valueNow = (): Value => {
  const text = playground.copyText();

  if (text === null) {
    throw new Error("no cropper");
  }

  const parsed: unknown = JSON.parse(text);

  if (!isValue(parsed)) {
    throw new TypeError("not a crop value");
  }

  return parsed;
};

const labelled = (text: string): HTMLButtonElement => {
  const found = [...document.querySelectorAll("button")].find((each) =>
    each.textContent.startsWith(text)
  );

  if (!found) {
    throw new Error(`no ${text} button`);
  }

  return found;
};

const root = (): HTMLElement => find(item("root"));

const rows = (): string[] =>
  [...document.querySelectorAll('[data-slot="log-row"]')].map(
    (row) => row.lastElementChild?.textContent ?? ""
  );

const choose = async (name: string, option: string): Promise<void> => {
  const input = inputOf(`input[name="${name}"][value="${option}"]`);

  input.click();
  await expect.poll(() => input.checked).toBeTruthy();
};

const flip = (name: string): void => {
  find(`input[role="switch"][aria-label="${name}"]`).click();
};

const slide = async (name: string, value: number): Promise<void> => {
  const input = inputOf(`input[type="range"][aria-label="${name}"]`);

  input.focus();

  while (Number(input.value) !== value) {
    await userEvent.keyboard(
      Number(input.value) < value ? "{ArrowRight}" : "{ArrowLeft}"
    );
  }

  input.blur();
};

const press = async (key: string): Promise<void> => {
  find(item("area")).focus();
  await userEvent.keyboard(key);
  find(item("area")).blur();
  await settle();
};

const wheel = async (deltaY: number): Promise<void> => {
  const viewport = find(item("viewport"));
  const box = viewport.getBoundingClientRect();

  for (let step = 0; step < 6; step += 1) {
    viewport.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        clientX: box.left + box.width / 2,
        clientY: box.top + box.height / 2,
        deltaMode: 0,
        deltaY,
      })
    );
  }

  await settle();
};

const dragDial = async (by: number): Promise<void> => {
  await commands.drag(item("dial"), [
    [180, 16],
    [180 + by / 3, 16, 16],
    [180 + (by * 2) / 3, 16, 16],
    [180 + by, 16, 16],
  ]);

  await settle();
};

const areaOffset = (): number => {
  const area = find(item("area")).getBoundingClientRect();
  const stage = find('[data-slot="stage"]').getBoundingClientRect();

  return Math.abs(area.left + area.width / 2 - (stage.left + stage.width / 2));
};

const shrinkCorner = async (): Promise<void> => {
  await commands.drag(`${item("handle")}[data-edge="bottom-right"]`, [
    [22, 22],
    [-20, -10, 16],
    [-60, -40, 16],
    [-100, -70, 16],
  ]);
};

type Watch = {
  add: MockInstance<EventTarget["addEventListener"]>;
  create: MockInstance<(typeof URL)["createObjectURL"]>;
  remove: MockInstance<EventTarget["removeEventListener"]>;
  revoke: MockInstance<(typeof URL)["revokeObjectURL"]>;
};

const watch = (): Watch => ({
  add: vi.spyOn(EventTarget.prototype, "addEventListener"),
  create: vi.spyOn(URL, "createObjectURL"),
  remove: vi.spyOn(EventTarget.prototype, "removeEventListener"),
  revoke: vi.spyOn(URL, "revokeObjectURL"),
});

const tally = ({ add, create, remove, revoke }: Watch): Tally => {
  const listening = new Map<string, number>();

  for (const [i, [type, listener]] of add.mock.calls.entries()) {
    const key = keyOf(add.mock.contexts[i], type, listener);

    if (key !== null) {
      listening.set(key, (listening.get(key) ?? 0) + 1);
    }
  }

  for (const [i, [type, listener]] of remove.mock.calls.entries()) {
    const key = keyOf(remove.mock.contexts[i], type, listener);
    const count = key === null ? undefined : listening.get(key);

    if (key !== null && count !== undefined) {
      listening.set(key, count - 1);
    }
  }

  const made = create.mock.results.flatMap((result) =>
    result.type === "return" ? [result.value] : []
  );
  const freed = new Set(revoke.mock.calls.map(([url]) => url));

  return {
    canvases: document.querySelectorAll("canvas").length,
    listeners: [...listening.values()].filter((count) => count > 0).length,
    urls: made.filter((url) => !freed.has(url)).length,
  };
};

describe("playground demo and page blocks", () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    await cleanup();
  });

  it("starts as the bare cropper, the default value and no events", async () => {
    await mount();
    await ready();

    expect(shownCode()).toBe(codeText(DEFAULT_KNOBS));
    expect(shownValue()).toBe(START_TEXT);
    expect(playground.copyText()).toBe(START_TEXT);
    expect(rows()).toStrictEqual([]);

    const result = await axe.run(document.body, {
      rules: { region: { enabled: false } },
    });

    expect(result.violations.map((each) => each.id)).toStrictEqual([]);
  });

  it("turns the crop round with shape", async () => {
    await mount();
    await ready();
    await choose("shape", "circle");
    await settle();

    const area = find(item("area")).getBoundingClientRect();

    expect(area.width / area.height).toBeCloseTo(1, 2);
    expect(shownCode()).toContain('<Cropper.Root src={photo} shape="circle">');
  });

  it("forces short motion with motion reduce", async () => {
    await mount();
    await ready();

    expect(Object.hasOwn(root().dataset, "reducedMotion")).toBeFalsy();

    await choose("motion", "reduce");

    await expect
      .poll(() => Object.hasOwn(root().dataset, "reducedMotion"))
      .toBeTruthy();

    expect(shownCode()).toContain('motion="reduce"');

    await choose("motion", "always");

    await expect
      .poll(() => Object.hasOwn(root().dataset, "reducedMotion"))
      .toBeFalsy();

    expect(shownCode()).toContain('motion="always"');
  });

  it("turns the dial the other way with dir rtl", async () => {
    await mount();
    await ready();
    await choose("dir", "rtl");
    await expect.poll(() => root().getAttribute("dir")).toBe("rtl");

    find(item("dial")).focus();
    await userEvent.keyboard("{ArrowRight}");
    find(item("dial")).blur();
    await settle();

    expect(valueNow().rotation).toBeLessThan(0);
    expect(shownCode()).toContain('dir="rtl"');
  });

  it("caps the zoom with maxZoom", async () => {
    await mount();
    await ready();
    await slide("maxZoom", 1);
    await expect.poll(shownCode).toContain("maxZoom={1}");
    await press("+");

    expect(valueNow().size.width).toBeCloseTo(1, 6);

    await slide("maxZoom", 15);
    await expect.poll(shownCode).not.toContain("maxZoom");
    await press("+");

    expect(valueNow().size.width).toBeLessThan(0.99);
  });

  it("waits recenterDelay before it recentres", async () => {
    await mount();
    await ready();
    await slide("recenterDelay", 2000);
    await expect.poll(shownCode).toContain("recenterDelay={2000}");
    await shrinkCorner();
    await wait(900);

    expect(areaOffset()).toBeGreaterThan(10);

    await slide("recenterDelay", 0);
    await expect.poll(shownCode).toContain("recenterDelay={0}");
    await shrinkCorner();
    await expect.poll(areaOffset, { timeout: 4000 }).toBeLessThan(1);
  });

  it("locks the cropper with disabled", async () => {
    await mount();
    await ready();
    flip("disabled");

    await expect
      .poll(() => Object.hasOwn(root().dataset, "disabled"))
      .toBeTruthy();

    find(item("dial")).focus();
    await userEvent.keyboard("{ArrowRight}");
    find(item("dial")).blur();
    await settle();

    expect(valueNow().rotation).toBe(0);
    expect(shownCode()).toContain("<Cropper.Root src={photo} disabled>");
  });

  it("zooms, pans or ignores the wheel", async () => {
    await mount();
    await ready();
    await wheel(-40);

    expect(valueNow().size.width).toBeCloseTo(1, 6);

    await press("+");

    const before = valueNow();

    await wheel(-40);

    expect(valueNow().center).not.toStrictEqual(before.center);

    await choose("wheel", "zoom");
    await expect.poll(shownCode).toContain('wheel="zoom"');

    const zoomed = valueNow().size.width;

    await wheel(-40);

    expect(valueNow().size.width).toBeLessThan(zoomed);

    await choose("wheel", "none");

    const still = valueNow();

    await wheel(-40);

    expect(valueNow()).toStrictEqual(still);
    expect(shownCode()).toContain('wheel="none"');
  });

  it.skipIf(server.browser !== "chromium")(
    "turns the photo with two fingers only while rotateGesture is on",
    async () => {
      await mount();
      await ready();

      await turn();

      expect(Math.abs(valueNow().rotation)).toBeGreaterThan(1);

      find(item("reset")).click();
      await settle();
      flip("rotateGesture");
      await expect.poll(shownCode).toContain("rotateGesture={false}");
      await turn();

      expect(valueNow().rotation).toBe(0);
    }
  );

  it("tilts the photo and gives the tilt back after reset", async () => {
    await mount();
    await ready();
    await slide("vertical", 12);
    await slide("horizontal", -8);

    await expect
      .poll(() => valueNow().perspective)
      .toStrictEqual({ horizontal: -8, vertical: 12 });

    expect(shownCode()).toContain(
      "perspective: { vertical: 12, horizontal: -8 },"
    );

    await expect.poll(rows).toContain("imperative commit 0°");
    find(item("reset")).click();
    await settle();

    await expect
      .poll(() => inputOf('input[aria-label="vertical"]').value)
      .toBe("0");

    expect(valueNow().perspective).toStrictEqual({
      horizontal: 0,
      vertical: 0,
    });

    expect(shownCode()).not.toContain("defaultValue");

    expect(rows().slice(0, 2)).toStrictEqual([
      "reset commit 0°",
      "reset instant",
    ]);
  });

  it("logs a dial gesture as start, one move, end and a commit", async () => {
    await mount();
    await ready();
    await dragDial(-60);

    await expect
      .poll(() => rows().at(0) ?? "")
      .toMatch(/^dial commit -?\d+°$/u);

    expect(rows().slice(1, 4)).toStrictEqual([
      "dial end",
      "dial move",
      "dial start",
    ]);
  });

  it("shows the live value and copies it as a CropValue", async () => {
    await mount();
    await ready();
    await dragDial(-60);

    const writes = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);

    await expect.poll(shownValue).toBe(playground.copyText());

    labelled("copy value").click();
    await expect.poll(() => writes.mock.calls.length).toBe(1);

    await expect
      .poll(
        () => labelled("copy value").querySelector(".invisible")?.textContent
      )
      .toBe("copy value");

    expect(JSON.parse(writes.mock.calls[0]?.[0] ?? "")).toStrictEqual(
      valueNow()
    );

    labelled("copy code").click();
    await expect.poll(() => writes.mock.calls.length).toBe(2);

    expect(writes.mock.calls[1]?.[0]).toBe(shownCode());

    expect(valueNow().rotation).not.toBe(0);
  });

  it("downloads a round png with clear corners", async () => {
    await mount();

    const action = labelled("download png");

    await ready();
    await expect.poll(() => action.disabled).toBeFalsy();
    await choose("shape", "circle");
    await settle();

    const links: string[] = [];

    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function capture(this: HTMLAnchorElement) {
        links.push(this.href);
      }
    );

    vi.useFakeTimers(FAKE_TIMERS);
    action.click();
    await expect.poll(() => links.length, { timeout: 10_000 }).toBe(1);

    const response = await fetch(links[0] ?? "");
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");

    context?.drawImage(bitmap, 0, 0);

    expect(blob.type).toBe("image/png");
    expect(bitmap.width).toBe(bitmap.height);
    expect(context?.getImageData(1, 1, 1, 1).data[3]).toBe(0);

    expect(
      context?.getImageData(bitmap.width / 2, bitmap.height / 2, 1, 1).data[3]
    ).toBe(255);
  });

  it("leaves no listeners, canvases or object urls after 20 mounts", async () => {
    await mount();
    await ready();
    await cleanup();

    const watched = watch();
    const start = tally(watched);

    for (let round = 0; round < 20; round += 1) {
      const screen = await mount();

      await ready();
      await choose("shape", round % 2 === 0 ? "circle" : "rect");
      await dragDial(30);
      await screen.unmount();
    }

    await cleanup();
    await wait(1200);

    expect(tally(watched)).toStrictEqual(start);
    expect(playground.watchers()).toBe(0);
    expect(playground.getState()).toStrictEqual(playground.getServerState());
  }, 180_000);
});
