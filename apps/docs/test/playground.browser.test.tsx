import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { commands as browser, page, userEvent } from "vitest/browser";

import "../app/globals.css";

import { CodePanel } from "../components/doc/code-panel";
import { Controls } from "../components/doc/controls";
import { Demo } from "../components/doc/demo";
import { PLAYGROUND_PAGE } from "../content/playground";
import { codeText, jsonText } from "../demos/playground/code";
import { LiveCode } from "../demos/playground/live-code";
import { LiveLog } from "../demos/playground/live-log";
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

const isTools = (value: object): value is Tools => "drag" in value;

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

const CONTROLS: readonly Control[] = walkBlocks(PLAYGROUND_PAGE.blocks).flatMap(
  (block) => (block.kind === "controls" ? block.controls : [])
);

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
    <div data-testid="code">
      <CodePanel className="" label="JSX code">
        <LiveCode feed="code" />
      </CodePanel>
    </div>
    <div data-testid="value">
      <CodePanel className="" label="JSON code">
        <LiveCode feed="value" />
      </CodePanel>
    </div>
    <div data-testid="log">
      <LiveLog />
    </div>
  </div>
);

const mount = async () => await render(<Page />);

const near = (actual: number, expected: number): boolean =>
  Math.abs(actual - expected) < 5e-7;

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
  const parsed: unknown = JSON.parse(shownValue());

  if (!isValue(parsed)) {
    throw new TypeError("not a crop value");
  }

  return parsed;
};

const root = (): HTMLElement => find(item("root"));

const reduced = (): boolean => Object.hasOwn(root().dataset, "reducedMotion");

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
    expect(rows()).toStrictEqual([]);

    const result = await axe.run(document.body, {
      rules: { region: { enabled: false } },
    });

    expect(result.violations.map((each) => each.id)).toStrictEqual([]);
  });

  it("changes the code and the cropper with every knob", async () => {
    await mount();
    await ready();

    const has = (text: string): boolean => shownCode().includes(text);
    const seen: Record<string, unknown> = { motionAtStart: reduced() };

    await choose("motion", "reduce");
    await expect.poll(reduced).toBeTruthy();
    seen.motionReduce = has('motion="reduce"');
    await choose("motion", "always");
    await expect.poll(reduced).toBeFalsy();
    seen.motionAlways = has('motion="always"');

    await wheel(-40);
    seen.wheelAtFit = near(valueNow().size.width, 1);
    await slide("maxZoom", 1);
    await expect.poll(shownCode).toContain("maxZoom={1}");
    await press("+");
    seen.cappedAtOne = near(valueNow().size.width, 1);
    await slide("maxZoom", 15);
    await expect.poll(shownCode).not.toContain("maxZoom");
    await press("+");
    seen.zoomedIn = valueNow().size.width < 0.99;

    const before = valueNow();

    await wheel(-40);

    seen.wheelPans =
      valueNow().center.x !== before.center.x ||
      valueNow().center.y !== before.center.y;

    await choose("wheel", "zoom");
    await expect.poll(shownCode).toContain('wheel="zoom"');

    const zoomed = valueNow().size.width;

    await wheel(-40);
    seen.wheelZooms = valueNow().size.width < zoomed;
    await choose("wheel", "none");

    const still = valueNow();

    await wheel(-40);
    seen.wheelIgnored = JSON.stringify(valueNow()) === JSON.stringify(still);
    seen.wheelNone = has('wheel="none"');

    await slide("vertical", 12);
    await slide("horizontal", -8);

    await expect
      .poll(() => valueNow().perspective)
      .toStrictEqual({ horizontal: -8, vertical: 12 });

    seen.tiltCode = has("perspective: { vertical: 12, horizontal: -8 },");
    await expect.poll(rows).toContain("imperative commit 0°");
    find(item("reset")).click();
    await settle();

    await expect
      .poll(() => inputOf('input[aria-label="vertical"]').value)
      .toBe("0");

    seen.tiltAfterReset = valueNow().perspective;

    seen.tiltCodeAfterReset = has(
      "perspective: { vertical: 0, horizontal: 0 } }}"
    );

    seen.resetRows = rows().slice(0, 2);

    await choose("dir", "rtl");
    await expect.poll(() => root().getAttribute("dir")).toBe("rtl");
    find(item("dial")).focus();
    await userEvent.keyboard("{ArrowRight}");
    find(item("dial")).blur();
    await settle();

    const turned = valueNow().rotation;

    seen.rtlTurnsBack = turned < 0;
    seen.rtlCode = has('dir="rtl"');

    flip("disabled");

    await expect
      .poll(() => Object.hasOwn(root().dataset, "disabled"))
      .toBeTruthy();

    find(item("dial")).focus();
    await userEvent.keyboard("{ArrowRight}");
    find(item("dial")).blur();
    await settle();
    seen.disabledHolds = valueNow().rotation === turned;
    seen.disabledCode = has("\n  disabled\n");

    await choose("shape", "circle");
    await settle();

    const area = find(item("area")).getBoundingClientRect();

    seen.circle = Math.abs(area.width / area.height - 1) < 0.005;
    seen.circleCode = has('\n  shape="circle"\n');

    expect(seen).toStrictEqual({
      cappedAtOne: true,
      circle: true,
      circleCode: true,
      disabledCode: true,
      disabledHolds: true,
      motionAlways: true,
      motionAtStart: false,
      motionReduce: true,
      resetRows: ["reset commit 0°", "reset instant"],
      rtlCode: true,
      rtlTurnsBack: true,
      tiltAfterReset: { horizontal: 0, vertical: 0 },
      tiltCode: true,
      tiltCodeAfterReset: true,
      wheelAtFit: true,
      wheelIgnored: true,
      wheelNone: true,
      wheelPans: true,
      wheelZooms: true,
      zoomedIn: true,
    });
  });

  it("logs a dial gesture and copies the live value and code", async () => {
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

    const writes = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);

    find('[data-testid="value"] button').click();
    await expect.poll(() => writes.mock.calls.length).toBe(1);

    expect(JSON.parse(writes.mock.calls[0]?.[0] ?? "")).toStrictEqual(
      valueNow()
    );

    find('[data-testid="code"] button').click();
    await expect.poll(() => writes.mock.calls.length).toBe(2);

    expect(writes.mock.calls[1]?.[0]).toBe(shownCode());
    expect(valueNow().rotation).not.toBe(0);
  });

  it("leaves no listeners, canvases or object urls after 5 mounts", async () => {
    await mount();
    await ready();
    await cleanup();

    const watched = watch();
    const start = tally(watched);

    for (let round = 0; round < 5; round += 1) {
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
  }, 60_000);
});
