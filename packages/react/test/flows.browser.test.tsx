import "../../core/src/styles.css";
import { createCropper } from "@zriz/core";
import type { CropValue, Cropper as CropperApi } from "@zriz/core";
import { ZrizError, exportCrop, imageOf } from "@zriz/core/dom";
import type { LoadedImage } from "@zriz/core/dom";
import { createRef, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { commands, userEvent } from "vitest/browser";

import { useCropperFrame } from "../src";
import * as Cropper from "../src/cropper";

const BLUE = "#3344cc";
const RED = "#cc3333";

const photo = async (width = 400, height = 300, fill = RED): Promise<Blob> => {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("no 2d context");
  }

  context.fillStyle = fill;
  context.fillRect(0, 0, width, height);

  return await canvas.convertToBlob({ type: "image/png" });
};

const frames = async (n = 2): Promise<void> => {
  for (let i = 0; i < n; i += 1) {
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }
};

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const settled = async (api: { current: CropperApi | null }): Promise<void> => {
  let calm = 0;
  const until = performance.now() + 6000;

  while (calm < 6 && performance.now() < until) {
    await frames(1);
    const state = api.current?.getState();

    calm = state?.interacting === null && !state.settling ? calm + 1 : 0;
  }

  expect(calm).toBe(6);
};

const isLoaded = (value: unknown): value is LoadedImage =>
  typeof value === "object" && value !== null && "preview" in value;

type EditorProps = {
  src?: string | Blob | null;
  api?: React.Ref<CropperApi> | undefined;
  onLoad?: (image: LoadedImage) => void;
  onError?: (error: ZrizError) => void;
  onValueChange?: (value: CropValue) => void;
  onValueCommit?: (value: CropValue) => void;
  children?: ReactNode;
  rootProps?: Record<string, unknown>;
};

const Editor = ({
  src,
  api,
  onLoad,
  onError,
  onValueChange,
  onValueCommit,
  children,
  rootProps,
}: EditorProps) => (
  <Cropper.Root
    actionsRef={api}
    onError={onError}
    onLoad={onLoad}
    onValueChange={onValueChange}
    onValueCommit={onValueCommit}
    src={src}
    {...rootProps}
  >
    <Cropper.Viewport
      id="viewport"
      style={{ height: 300, padding: 20, position: "relative", width: 400 }}
    >
      <Cropper.Image alt="" />
      <Cropper.Mask />
      <Cropper.Area aria-label="Crop">
        <Cropper.Grid />
        <Cropper.Handle position="top-left" />
      </Cropper.Area>
    </Cropper.Viewport>
    <Cropper.Instructions>Arrows move the photo.</Cropper.Instructions>
    <Cropper.Dial
      aria-label="Straighten"
      id="dial"
      style={{ height: 40, width: 361 }}
    >
      <Cropper.DialTicks />
      <Cropper.DialValue />
    </Cropper.Dial>
    <Cropper.Zoom
      aria-label="Zoom"
      id="zoom"
      style={{ height: 20, width: 200 }}
    >
      <Cropper.ZoomThumb />
    </Cropper.Zoom>
    <Cropper.AspectGroup aria-label="Aspect">
      <Cropper.AspectItem value="free">Free</Cropper.AspectItem>
      <Cropper.AspectItem value={1}>Square</Cropper.AspectItem>
      <Cropper.AspectItem value={16 / 9}>Wide</Cropper.AspectItem>
    </Cropper.AspectGroup>
    <Cropper.Rotate aria-label="Rotate" />
    <Cropper.Flip aria-label="Flip" />
    <Cropper.Reset>Reset</Cropper.Reset>
    <Cropper.Announcer announce={() => "Saved"} />
    {children}
  </Cropper.Root>
);

const q = (selector: string): HTMLElement => {
  const found = document.querySelector<HTMLElement>(selector);

  if (!found) {
    throw new Error(`no ${selector}`);
  }

  return found;
};

const centerColor = async (blob: Blob): Promise<number[]> => {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("no 2d context");
  }

  context.drawImage(bitmap, 0, 0);
  const { data } = context.getImageData(
    Math.floor(bitmap.width / 2),
    Math.floor(bitmap.height / 2),
    1,
    1
  );

  bitmap.close();

  return [...data];
};

describe("Root src flows", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("fires onLoad once for a photo and a typed onError for bad bytes", async () => {
    const onLoad = vi.fn<(...args: unknown[]) => void>();
    const onError = vi.fn<(...args: unknown[]) => void>();
    const api = createRef<CropperApi>();
    const screen = await render(
      <Editor api={api} onError={onError} onLoad={onLoad} src={await photo()} />
    );

    await expect.poll(() => onLoad.mock.calls.length).toBe(1);

    expect({
      errors: onError.mock.calls.length,
      loaded: onLoad.mock.calls[0]?.[0],
      ready: api.current?.getState().ready,
    }).toMatchObject({
      errors: 0,
      loaded: { height: 300, mime: "image/png", width: 400 },
      ready: true,
    });

    await screen.unmount();

    const badLoad = vi.fn<(...args: unknown[]) => void>();
    const badError = vi.fn<(...args: unknown[]) => void>();

    await render(
      <Editor
        onError={badError}
        onLoad={badLoad}
        src={new Blob(["not an image at all"], { type: "image/png" })}
      />
    );

    await expect.poll(() => badError.mock.calls.length).toBe(1);
    const error = badError.mock.calls[0]?.[0];

    expect({
      loads: badLoad.mock.calls.length,
      zriz: error instanceof ZrizError && error.message.startsWith("zriz:"),
    }).toStrictEqual({ loads: 0, zriz: true });
  });

  it("A then B: B lands, A never reports, and onError stays quiet", async () => {
    const onLoad = vi.fn<(...args: unknown[]) => void>();
    const onError = vi.fn<(...args: unknown[]) => void>();
    const api = createRef<CropperApi>();
    const a = await photo(3000, 2000, RED);
    const b = await photo(200, 100, BLUE);
    const screen = await render(
      <Editor api={api} onError={onError} onLoad={onLoad} src={a} />
    );

    await screen.rerender(
      <Editor api={api} onError={onError} onLoad={onLoad} src={b} />
    );

    await expect.poll(() => onLoad.mock.calls.length).toBeGreaterThan(0);
    await sleep(500);

    expect(
      onLoad.mock.calls.map(([image]) => (isLoaded(image) ? image.width : 0))
    ).toStrictEqual([200]);

    expect(onError).not.toHaveBeenCalled();
    expect(api.current && imageOf(api.current)?.width).toBe(200);
  });

  it("undefined leaves the photo, a failed load keeps it, and null releases it", async () => {
    const onLoad = vi.fn<(...args: unknown[]) => void>();
    const onError = vi.fn<(...args: unknown[]) => void>();
    const api = createRef<CropperApi>();
    const props = { api, onError, onLoad };
    const screen = await render(
      <Editor {...props} src={await photo(800, 600)} />
    );

    await expect.poll(() => onLoad.mock.calls.length).toBe(1);
    const landed = onLoad.mock.calls[0]?.[0];

    await screen.rerender(<Editor {...props} />);
    await frames(3);
    expect(api.current && imageOf(api.current)?.width).toBe(800);

    await screen.rerender(
      <Editor {...props} src={new Blob(["junk"], { type: "image/png" })} />
    );

    await expect.poll(() => onError.mock.calls.length).toBe(1);

    expect({
      ready: api.current?.getState().ready,
      width: api.current && imageOf(api.current)?.width,
    }).toStrictEqual({ ready: true, width: 800 });

    await screen.rerender(<Editor {...props} src={null} />);
    await expect.poll(() => api.current?.getState().ready).toBeFalsy();

    expect({
      image: api.current && imageOf(api.current),
      preview: isLoaded(landed) ? landed.preview.width : -1,
    }).toStrictEqual({ image: null, preview: 0 });
  });

  it("a new object URL for the same photo keeps the crop", async () => {
    const onLoad = vi.fn<(...args: unknown[]) => void>();
    const api = createRef<CropperApi>();
    const blob = await photo();
    const first = URL.createObjectURL(blob);
    const second = URL.createObjectURL(blob);
    const screen = await render(
      <Editor api={api} onLoad={onLoad} src={first} />
    );

    await expect.poll(() => onLoad.mock.calls.length).toBe(1);
    await frames(3);
    api.current?.setAspect(1);
    api.current?.setRotation(7);
    await settled(api);
    const before = api.current?.getValue();

    await screen.rerender(<Editor api={api} onLoad={onLoad} src={second} />);
    await expect.poll(() => onLoad.mock.calls.length).toBe(2);
    await settled(api);
    expect(api.current?.getValue()).toStrictEqual(before);
    URL.revokeObjectURL(first);
    URL.revokeObjectURL(second);
  });

  it("a photo swap during a gesture under a controlled zoom commits a value and crop that agree", async () => {
    const api = createRef<CropperApi>();
    const commits: {
      crop: unknown;
      read: boolean;
      value: CropValue;
    }[] = [];

    const onValueCommit = (
      value: CropValue,
      { pixelCrop }: { pixelCrop: unknown }
    ): void => {
      commits.push({
        crop: pixelCrop,
        read: api.current?.getState().committed === value,
        value,
      });
    };

    await render(
      <Editor
        api={api}
        rootProps={{
          aspect: 1,
          image: { height: 3000, width: 4000 },
          onValueCommit,
          zoom: 2,
        }}
      />
    );

    await expect.poll(() => api.current?.getState().ready).toBeTruthy();
    api.current?.setRotation(12);
    await settled(api);
    commits.length = 0;
    const next = { height: 4000, width: 1000 };

    api.current?.begin("pan");
    api.current?.panBy(30, 20);
    api.current?.setImage(next);
    const [first] = commits;

    expect(first?.read).toBeTruthy();
    const same = createCropper({ defaultValue: first?.value, image: next });

    expect(first?.crop).toStrictEqual(same.getPixelCrop());
    same.destroy();
    api.current?.end();
    await settled(api);
    expect(commits.at(-1)?.value).toStrictEqual(api.current?.getValue());
    expect(commits.at(-1)?.crop).toStrictEqual(api.current?.getPixelCrop());
  });

  it("swapping src during a drag ends the gesture cleanly and exports only B", async () => {
    const api = createRef<CropperApi>();
    const a = await photo(800, 600, RED);
    const b = await photo(600, 800, BLUE);
    const seen: (string | null | undefined)[] = [];
    let setter: ((next: Blob) => void) | null = null;
    let armed = false;

    const onValueChange = (): void => {
      if (armed) {
        armed = false;
        setter?.(b);
      }
    };

    const Swap = () => {
      const [src, setSrc] = useState<Blob>(a);

      useEffect(() => {
        setter = setSrc;
      }, []);

      return (
        <Editor
          api={api}
          onLoad={(image) => {
            seen.push(`${image.width} ${api.current?.getState().interacting}`);
          }}
          onValueChange={onValueChange}
          src={src}
        />
      );
    };

    const errors: unknown[] = [];

    const onWindowError = (event: ErrorEvent): void => {
      errors.push(event.message);
    };

    const onRejection = (event: PromiseRejectionEvent): void => {
      errors.push(event.reason);
    };

    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onRejection);
    await render(<Swap />);
    await expect.poll(() => seen.length).toBe(1);
    await frames(3);
    api.current?.setZoom(2);
    await settled(api);
    armed = true;

    await commands.drag("#viewport", [
      [200, 150],
      [210, 150],
      [220, 150, 300],
      [230, 150, 300],
      [240, 150, 300],
      [250, 150, 300],
      [260, 150, 300],
      [270, 150, 300],
      [280, 150, 300],
    ]);

    await expect.poll(() => seen.length, { timeout: 5000 }).toBe(2);
    await settled(api);
    window.removeEventListener("error", onWindowError);
    window.removeEventListener("unhandledrejection", onRejection);
    const value = api.current?.getValue();

    expect({
      errors,
      finite: Number.isFinite(value?.center.x),
      landed: seen[1],
    }).toStrictEqual({ errors: [], finite: true, landed: "600 pan" });

    expect(value?.size.width).toBeGreaterThan(0);

    if (!api.current) {
      throw new Error("no api");
    }

    const result = await exportCrop(api.current, { type: "image/png" });
    const [r, , blue] = await centerColor(result.blob);
    const before = api.current.getValue().center.x;

    await commands.drag("#viewport", [
      [200, 150],
      [190, 150],
      [170, 150, 30],
      [150, 150, 30],
    ]);

    await settled(api);
    expect(blue ?? 0).toBeGreaterThan(r ?? 0);
    expect(api.current.getValue().center.x).not.toBe(before);
  });
});

describe("hooks in a real render", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("useCropperFrame keeps the latest listener and stops at unmount", async () => {
    const cropper = createCropper({ image: { height: 300, width: 400 } });
    const calls: string[] = [];

    type ProbeProps = { tag: string };

    const Probe = ({ tag }: ProbeProps) => {
      useCropperFrame(() => {
        calls.push(tag);
      }, cropper);

      return null;
    };

    const screen = await render(<Probe tag="one" />);

    cropper.setRotation(3);
    await frames(3);
    await screen.rerender(<Probe tag="two" />);
    calls.length = 0;
    cropper.setRotation(6);
    await frames(3);
    expect(calls.length).toBeGreaterThan(0);
    expect(new Set(calls)).toStrictEqual(new Set(["two"]));
    await screen.unmount();
    calls.length = 0;
    cropper.setRotation(9);
    await frames(3);
    expect(calls).toStrictEqual([]);
    cropper.destroy();
  });
});

const measureDial = async (dir: "ltr" | "rtl") => {
  const api = createRef<CropperApi>();
  const image = { height: 300, width: 400 };
  const screen = await render(
    <div dir={dir}>
      <Editor api={api} rootProps={{ image }} />
    </div>
  );

  await frames(3);
  const dial = q("#dial");

  dial.focus();
  await userEvent.keyboard("{ArrowRight}");
  await settled(api);
  const key = api.current?.getValue().rotation ?? 0;

  await userEvent.keyboard("0");
  await settled(api);
  const strip = q('[data-zriz-item="dial-ticks"]');
  const x = (): number =>
    new DOMMatrixReadOnly(getComputedStyle(strip).transform).m41;
  const start = x();

  await commands.drag("#dial", [
    [180, 20],
    [200, 20],
    [220, 20, 50],
    [230, 20, 50],
  ]);

  await settled(api);
  const moved = x() - start;
  const rotation = api.current?.getValue().rotation ?? 0;

  await screen.unmount();

  return { key, moved, rotation };
};

describe("rtl from the page", () => {
  afterEach(async () => {
    await cleanup();
  });

  const image = { height: 300, width: 400 };
  const mountRtl = async (api: React.Ref<CropperApi>) =>
    await render(
      <div dir="rtl">
        <Editor api={api} rootProps={{ image }} />
      </div>
    );

  it("AspectGroup arrows run the other way", async () => {
    const api = createRef<CropperApi>();

    await mountRtl(api);
    await frames(3);
    const items = [
      ...document.querySelectorAll<HTMLButtonElement>(
        '[data-zriz-item="aspect-item"]'
      ),
    ];

    items[0]?.focus();
    await userEvent.keyboard("{ArrowLeft}");
    await frames(3);
    expect(document.activeElement).toBe(items[1]);
    await userEvent.keyboard("{ArrowRight}");
    await frames(3);
    expect(document.activeElement).toBe(items[0]);
  });

  it("Zoom keys, pointer and thumb follow rtl", async () => {
    const api = createRef<CropperApi>();

    await mountRtl(api);
    await frames(3);
    api.current?.setZoom(4);
    await settled(api);
    const zoom = q("#zoom");
    const before = api.current?.getZoom() ?? 0;

    zoom.focus();
    await userEvent.keyboard("{ArrowRight}");
    await frames(3);
    const afterRight = api.current?.getZoom() ?? 0;

    expect(afterRight).toBeLessThan(before);
    await userEvent.keyboard("{ArrowLeft}");
    await userEvent.keyboard("{ArrowLeft}");
    await frames(3);
    expect(api.current?.getZoom() ?? 0).toBeGreaterThan(afterRight);

    await commands.drag("#zoom", [
      [2, 10],
      [2, 10],
    ]);

    await settled(api);
    expect(api.current?.getZoom() ?? 0).toBeGreaterThan(10);
    const thumb = q('[data-zriz-item="zoom-thumb"]');
    const box = zoom.getBoundingClientRect();
    const atMost = thumb.getBoundingClientRect().left - box.left;

    await commands.drag("#zoom", [
      [198, 10],
      [198, 10],
    ]);

    await settled(api);
    expect(api.current?.getZoom() ?? 0).toBeLessThan(1.5);

    expect([
      atMost < box.width / 4,
      thumb.getBoundingClientRect().left - box.left > (box.width * 3) / 4,
    ]).toStrictEqual([true, true]);
  });

  it("Dial keys flip and the strip follows the finger in both directions", async () => {
    const ltr = await measureDial("ltr");
    const rtl2 = await measureDial("rtl");

    expect(Math.sign(ltr.key)).toBe(-Math.sign(rtl2.key));
    expect(ltr.moved).toBeGreaterThan(0);
    expect(rtl2.moved).toBeGreaterThan(0);
    expect(Math.sign(ltr.rotation)).toBe(-Math.sign(rtl2.rotation));
  });
});

describe("the page's direction", () => {
  afterEach(async () => {
    await cleanup();
  });

  const image = { height: 300, width: 400 };

  it("is left alone with no dir on Root, and gives way to dir on Root", async () => {
    const api = createRef<CropperApi>();
    const screen = await render(
      <div dir="rtl">
        <Editor api={api} rootProps={{ image }} />
      </div>
    );

    const root = q('[data-zriz-item="root"]');

    expect(root.hasAttribute("dir")).toBeFalsy();
    expect(getComputedStyle(root).direction).toBe("rtl");

    await screen.rerender(
      <div dir="rtl">
        <Editor api={api} rootProps={{ dir: "ltr", image }} />
      </div>
    );

    await frames(3);
    q("#dial").focus();
    await userEvent.keyboard("{ArrowRight}");
    await settled(api);
    expect(api.current?.getValue().rotation).toBeGreaterThan(0);
  });

  it("is read at each key press, so a later change takes effect", async () => {
    const api = createRef<CropperApi>();
    const screen = await render(
      <div data-testid="page" dir="ltr">
        <Editor api={api} rootProps={{ image }} />
      </div>
    );

    await frames(3);
    const dial = q("#dial");

    dial.focus();
    await userEvent.keyboard("{ArrowRight}");
    await settled(api);
    expect(api.current?.getValue().rotation).toBeGreaterThan(0);

    screen.container.querySelector("[data-testid]")?.setAttribute("dir", "rtl");
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    await settled(api);
    expect(api.current?.getValue().rotation).toBeLessThan(0);
  });

  it("keeps the minus of the dial value on the left", async () => {
    await render(
      <div dir="rtl">
        <Cropper.Root image={image}>
          <Cropper.DialValue format={() => "-5"} />
        </Cropper.Root>
      </div>
    );

    const value = q('[data-zriz-item="dial-value"]');

    await expect.poll(() => value.textContent).toBe("-5");

    const place = (index: number): number => {
      const range = document.createRange();
      const text = value.firstChild;

      if (!text) {
        throw new Error("no text");
      }

      range.setStart(text, index);
      range.setEnd(text, index + 1);

      return range.getBoundingClientRect().left;
    };

    expect(place(0)).toBeLessThan(place(1));
  });
});
