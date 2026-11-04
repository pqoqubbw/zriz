import "../../core/src/styles.css";
import { createCropper } from "@zriz/core";
import type { CropValue, Cropper as CropperApi } from "@zriz/core";
import {
  ZrizError,
  attachImage,
  exportCrop,
  imageOf,
  loadImage,
} from "@zriz/core/dom";
import type { LoadedImage } from "@zriz/core/dom";
import { StrictMode, createRef, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { server, commands, userEvent } from "vitest/browser";

import { useCropperFrame } from "../src";
import * as Cropper from "../src/cropper";

const BLUE_WEBM =
  "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAOxEU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHWTbuMU6uEElTDZ1OsggEzTbuMU6uEHFO7a1OsggOb7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsCrXsYMPQkBNgIxMYXZmNjMuMS4xMDJXQYxMYXZmNjMuMS4xMDJEiYhAj0AAAAAAABZUrmvYrgEAAAAAAABP14EBc8WI/XjdG9fj+bucgQAitZyDdW5kiIEAhoVWX1ZQOIOBASPjg4QF9eEA4JGwggFAuoHwmoECVbCEVbmBAVXugQDsAQAAAAAAAAIAABJUw2f6c3OfY8CAZ8iZRaOHRU5DT0RFUkSHjExhdmY2My4xLjEwMnNz1WPAi2PFiP143RvX4/m7Z8igRaOHRU5DT0RFUkSHk0xhdmM2My4xLjEwMiBsaWJ2cHhnyKFFo4hEVVJBVElPTkSHkzAwOjAwOjAxLjAwMDAwMDAwMAAfQ7Z1QePngQCjQL2BAACA0BIAnQEqQAHwAABHCIWFiIWEiAICAnWqA/gCBoaE9waBZJ9r25snOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHsnOHr0AP7/TRL//FhX8WFfxYV/8WFf/PzO7cX85gCjnoEAZADRAgABEBAAGAAYWC/0AAiABDNfrXJPnHMAAKOegQDIANECAAEQEAAYABhYL/QACIAEM1+tck+ccwAAo56BASwA0QIAARAQABgAGFgv9AAIgAQzX61yT5xzAACjnoEBkADRAgABEBAAGAAYWC/0AAiABDNfrXJPnHMAAKOegQH0ANECAAEQEAAYABhYL/QACIAEM1+tck+ccwAAo56BAlgA0QIAARAQABgAGFgv9AAIgAQzX61yT5xzAACjnoECvADRAgABEBAUYABhYL/QACIAEM1+tck+ccwAAKOegQMgANECAAEQEAAYABhYL/QACIAEM1+tck+ccwAAo56BA4QA0QIAARAQABgAGFgv9AAIgAQzX61yT5xzAAAcU7trkbuPs4EAt4r3gQHxggGy8IED";
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

const realAdd: unknown = Reflect.get(EventTarget.prototype, "addEventListener");
const realRemove: unknown = Reflect.get(
  EventTarget.prototype,
  "removeEventListener"
);
const realFrame = requestAnimationFrame.bind(globalThis);
const realCancelFrame = cancelAnimationFrame.bind(globalThis);
const realTimeout = setTimeout.bind(globalThis);
const realClearTimeout = clearTimeout.bind(globalThis);
const realCreateUrl = URL.createObjectURL.bind(URL);
const realRevokeUrl = URL.revokeObjectURL.bind(URL);
const realBitmap = createImageBitmap.bind(globalThis);
const realObserve: unknown = Reflect.get(ResizeObserver.prototype, "observe");
const realDisconnect: unknown = Reflect.get(
  ResizeObserver.prototype,
  "disconnect"
);

const applyReal = (real: unknown, self: object, args: readonly unknown[]) => {
  if (typeof real === "function") {
    Reflect.apply(real, self, args);
  }
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

  it("fires onLoad once with the size and mime, and never onError", async () => {
    const onLoad = vi.fn<(...args: unknown[]) => void>();
    const onError = vi.fn<(...args: unknown[]) => void>();
    const api = createRef<CropperApi>();

    await render(
      <Editor api={api} onError={onError} onLoad={onLoad} src={await photo()} />
    );

    await expect.poll(() => onLoad.mock.calls.length).toBe(1);

    expect(onLoad.mock.calls[0]?.[0]).toMatchObject({
      height: 300,
      mime: "image/png",
      width: 400,
    });

    expect(onError).not.toHaveBeenCalled();
    expect(api.current?.getState().ready).toBeTruthy();
  });

  it("fires onError with a typed error for bad bytes, a bad status and a refused host", async () => {
    for (const src of [
      new Blob(["not an image at all"], { type: "image/png" }),
      "/__zriz_does_not_exist__.png",
      "http://127.0.0.1:1/x.png",
    ]) {
      const onLoad = vi.fn<(...args: unknown[]) => void>();
      const onError = vi.fn<(...args: unknown[]) => void>();
      const screen = await render(
        <Editor onError={onError} onLoad={onLoad} src={src} />
      );

      await expect
        .poll(() => onError.mock.calls.length, { timeout: 8000 })
        .toBe(1);

      const error = onError.mock.calls[0]?.[0];

      expect(error).toBeInstanceOf(ZrizError);

      expect(error instanceof ZrizError ? error.message : "").toMatch(
        /^zriz:/u
      );

      expect(onLoad).not.toHaveBeenCalled();
      await screen.unmount();
    }
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

  it("src null releases the photo", async () => {
    const onLoad = vi.fn<(...args: unknown[]) => void>();
    const api = createRef<CropperApi>();
    const screen = await render(
      <Editor api={api} onLoad={onLoad} src={await photo(800, 600)} />
    );

    await expect.poll(() => onLoad.mock.calls.length).toBe(1);
    const landed = onLoad.mock.calls[0]?.[0];

    await screen.rerender(<Editor api={api} onLoad={onLoad} src={null} />);
    await expect.poll(() => api.current?.getState().ready).toBeFalsy();
    expect(isLoaded(landed) ? landed.preview.width : -1).toBe(0);
    expect(api.current && imageOf(api.current)).toBeNull();
  });

  it("undefined leaves the photo, and a failed load keeps the previous photo", async () => {
    const onLoad = vi.fn<(...args: unknown[]) => void>();
    const onError = vi.fn<(...args: unknown[]) => void>();
    const api = createRef<CropperApi>();
    const props = { api, onError, onLoad };
    const screen = await render(<Editor {...props} src={await photo()} />);

    await expect.poll(() => onLoad.mock.calls.length).toBe(1);
    await screen.rerender(<Editor {...props} />);
    await frames(3);
    expect(api.current && imageOf(api.current)?.width).toBe(400);

    await screen.rerender(
      <Editor {...props} src={new Blob(["junk"], { type: "image/png" })} />
    );

    await expect.poll(() => onError.mock.calls.length).toBe(1);
    expect(api.current && imageOf(api.current)?.width).toBe(400);
    expect(api.current?.getState().ready).toBeTruthy();
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
  const screen = await render(
    <Editor api={api} rootProps={{ dir, image: { height: 300, width: 400 } }} />
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

describe("rtl through Root", () => {
  afterEach(async () => {
    await cleanup();
  });

  const rtl = { dir: "rtl", image: { height: 300, width: 400 } };

  it("AspectGroup arrows run the other way", async () => {
    const api = createRef<CropperApi>();

    await render(<Editor api={api} rootProps={rtl} />);
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

    await render(<Editor api={api} rootProps={rtl} />);
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

const sizeOf = (image: LoadedImage) => [image.width, image.height];

describe("element sources with real decode", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("img, canvas, OffscreenCanvas and ImageBitmap", async () => {
    const blob = await photo(320, 200, BLUE);
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");

    canvas.width = 320;
    canvas.height = 200;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("no 2d");
    }

    context.fillStyle = BLUE;
    context.fillRect(0, 0, 320, 200);
    const off = new OffscreenCanvas(320, 200);
    const offContext = off.getContext("2d");

    if (!offContext) {
      throw new Error("no 2d");
    }

    offContext.fillStyle = BLUE;
    offContext.fillRect(0, 0, 320, 200);
    const bitmap = await createImageBitmap(blob);

    for (const source of [img, canvas, off, bitmap]) {
      const image = await loadImage(source);

      expect(sizeOf(image)).toStrictEqual([320, 200]);
      const cropper = createCropper({ image });

      attachImage(cropper, image);
      const result = await exportCrop(cropper, { type: "image/png" });
      const [r, , b] = await centerColor(result.blob);

      expect(b ?? 0).toBeGreaterThan(r ?? 0);
      attachImage(cropper, null);
      expect(image.preview.width).toBe(0);
      cropper.destroy();
    }

    URL.revokeObjectURL(url);
  });

  it.skipIf(server.browser === "webkit" && server.platform === "linux")(
    "a video frame",
    async () => {
      const bytes = Uint8Array.from(
        atob(BLUE_WEBM),
        (c) => c.codePointAt(0) ?? 0
      );
      const url = URL.createObjectURL(
        new Blob([bytes], { type: "video/webm" })
      );
      const video = document.createElement("video");

      video.muted = true;
      video.preload = "auto";

      await new Promise((resolve, reject) => {
        video.addEventListener("loadeddata", resolve, { once: true });
        video.addEventListener("error", reject, { once: true });
        video.src = url;
        video.load();
      });

      const image = await loadImage(video);

      expect(sizeOf(image)).toStrictEqual([320, 240]);
      image.preview.close();
      URL.revokeObjectURL(url);
    }
  );

  it("the decode hook opens bytes the browser cannot, and a throw rejects with the caller's own error", async () => {
    const junk = new Blob(["this is not an image"], { type: "image/x-custom" });
    const decode = vi.fn<() => Promise<ImageBitmap>>(
      async () => await createImageBitmap(await photo(320, 200, BLUE))
    );
    const image = await loadImage(junk, { decode });

    expect(decode).toHaveBeenCalledOnce();
    expect(sizeOf(image)).toStrictEqual([320, 200]);
    const cropper = createCropper({ image });

    attachImage(cropper, image);
    const result = await exportCrop(cropper, { type: "image/png" });

    expect(result.blob.size).toBeGreaterThan(0);
    attachImage(cropper, null);
    expect(image.preview.width).toBe(0);
    cropper.destroy();
    const mine = new Error("mine");

    await expect(
      loadImage(junk, {
        decode: async () => {
          await Promise.resolve();
          throw mine;
        },
      })
    ).rejects.toBe(mine);
  });
});

const STACK = /packages\/(?:core\/dist|core\/src|react\/src)\//u;

const fromZriz = (): boolean => STACK.test(new Error("stack").stack ?? "");

type Leftovers = {
  bitmaps: number;
  frames: number;
  listeners: string[];
  observers: number;
  timers: number;
  urls: number;
};

const CLEAN: Leftovers = {
  bitmaps: 0,
  frames: 0,
  listeners: [],
  observers: 0,
  timers: 0,
  urls: 0,
};

const listenerKey = (
  target: EventTarget,
  ids: WeakMap<object, number>,
  [type, listener, options]: Parameters<EventTarget["addEventListener"]>
): string => {
  const idOf = (value: object): number => {
    const known = ids.get(value);

    if (known !== undefined) {
      return known;
    }

    const next = Math.random();

    ids.set(value, next);

    return next;
  };

  const capture =
    typeof options === "boolean" ? options : options?.capture === true;

  return `${idOf(target)} ${type} ${listener ? idOf(listener) : 0} ${capture}`;
};

const track = () => {
  const ids = new WeakMap<object, number>();
  const listeners = new Map<string, string>();
  const frameIds = new Set<number>();
  const urls = new Set<string>();
  const bitmaps: ImageBitmap[] = [];
  const timers = new Set<unknown>();
  const observers = new Set<ResizeObserver>();
  const spies = [
    vi
      .spyOn(EventTarget.prototype, "addEventListener")
      .mockImplementation(function add(this: EventTarget, ...args) {
        const [_type, _listener, options] = args;
        const once = typeof options === "object" && options.once === true;

        if (fromZriz() && !once) {
          listeners.set(
            listenerKey(this, ids, args),
            `${this.constructor.name}:${args[0]}`
          );
        }

        applyReal(realAdd, this, args);
      }),
    vi
      .spyOn(EventTarget.prototype, "removeEventListener")
      .mockImplementation(function remove(this: EventTarget, ...args) {
        listeners.delete(listenerKey(this, ids, args));
        applyReal(realRemove, this, args);
      }),
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((run) => {
      const id = realFrame((time) => {
        frameIds.delete(id);
        run(time);
      });

      if (fromZriz()) {
        frameIds.add(id);
      }

      return id;
    }),
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
      frameIds.delete(id);
      realCancelFrame(id);
    }),
    vi.spyOn(globalThis, "setTimeout").mockImplementation((run, ms) => {
      const mine = fromZriz();
      const id = realTimeout(() => {
        timers.delete(id);

        if (typeof run === "function") {
          run();
        }
      }, ms);

      if (mine) {
        timers.add(id);
      }

      return id;
    }),
    vi.spyOn(globalThis, "clearTimeout").mockImplementation((id) => {
      timers.delete(id);
      realClearTimeout(id);
    }),
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      const url = realCreateUrl(blob);

      if (fromZriz()) {
        urls.add(url);
      }

      return url;
    }),
    vi.spyOn(URL, "revokeObjectURL").mockImplementation((url) => {
      urls.delete(url);
      realRevokeUrl(url);
    }),
    vi
      .spyOn(globalThis, "createImageBitmap")
      .mockImplementation(async (...args: unknown[]): Promise<ImageBitmap> => {
        const made: unknown = await Reflect.apply(realBitmap, globalThis, args);

        if (!(made instanceof ImageBitmap)) {
          throw new TypeError("no bitmap");
        }

        bitmaps.push(made);

        return made;
      }),
    vi
      .spyOn(ResizeObserver.prototype, "observe")
      .mockImplementation(function observe(this: ResizeObserver, ...args) {
        if (fromZriz()) {
          observers.add(this);
        }

        applyReal(realObserve, this, args);
      }),
    vi
      .spyOn(ResizeObserver.prototype, "disconnect")
      .mockImplementation(function disconnect(this: ResizeObserver) {
        observers.delete(this);
        applyReal(realDisconnect, this, []);
      }),
  ];

  return {
    read: async (): Promise<Leftovers> => {
      await sleep(1200);

      return {
        bitmaps: bitmaps.filter((bitmap) => bitmap.width > 0).length,
        frames: frameIds.size,
        listeners: [...listeners.values()],
        observers: observers.size,
        timers: timers.size,
        urls: urls.size,
      };
    },
    restore: () => {
      for (const spy of spies) {
        spy.mockRestore();
      }
    },
  };
};

const unmountDuring = async (
  run: (api: { current: CropperApi | null }) => Promise<void>,
  waitForPhoto = true
): Promise<Leftovers> => {
  const tracker = track();

  try {
    const onLoad = vi.fn<(...args: unknown[]) => void>();
    const api = createRef<CropperApi>();
    const src = await photo(800, 600);
    const screen = await render(
      <StrictMode>
        <Editor api={api} onLoad={onLoad} src={src} />
      </StrictMode>
    );

    if (waitForPhoto) {
      await expect.poll(() => onLoad.mock.calls.length).toBe(1);
      await frames(3);
    }

    await run(api);
    await screen.unmount();

    return await tracker.read();
  } finally {
    tracker.restore();
  }
};

describe("unmount parity under StrictMode", () => {
  beforeAll(async () => {
    await loadImage(await photo(8, 8));
  });

  afterEach(async () => {
    await cleanup();
  });

  it("leaves nothing when idle", async () => {
    await expect(
      unmountDuring(async () => {
        await frames(2);
      })
    ).resolves.toStrictEqual(CLEAN);
  });

  it("leaves nothing during an animation", async () => {
    await expect(
      unmountDuring(async (api) => {
        api.current?.rotate90();
        await frames(2);
      })
    ).resolves.toStrictEqual(CLEAN);
  });

  it("leaves nothing in the middle of a drag", async () => {
    const result = await unmountDuring(async () => {
      await commands.hold("#viewport", 200, 150);
      await frames(2);
    });

    await commands.release();
    expect(result).toStrictEqual(CLEAN);
  });

  it("leaves nothing while the load is still running", async () => {
    await expect(
      unmountDuring(async () => {
        await Promise.resolve();
      }, false)
    ).resolves.toStrictEqual(CLEAN);
  });

  it("leaves nothing after the sharp canvas settled", async () => {
    await expect(
      unmountDuring(async () => {
        await expect
          .poll(() => document.querySelector("[data-sharp]"), {
            timeout: 3000,
          })
          .not.toBeNull();
      })
    ).resolves.toStrictEqual(CLEAN);
  });
});

type FullProps = { api?: React.Ref<CropperApi> };

const Full = ({ api }: FullProps) => (
  <Editor api={api} rootProps={{ image: { height: 300, width: 400 } }}>
    <Cropper.Orientation aria-label="Orientation" />
    <Cropper.ZoomStep aria-label="Zoom in" factor={2} />
  </Editor>
);

describe("hydration", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("hydrates every part with no mismatch and stays interactive", async () => {
    const html = renderToString(<Full />);
    const host = document.createElement("div");

    host.innerHTML = html;
    document.body.append(host);
    const spy = vi.spyOn(console, "error");
    const recoverable: unknown[] = [];
    const api = createRef<CropperApi>();
    const root = hydrateRoot(host, <Full api={api} />, {
      onRecoverableError: (error) => {
        recoverable.push(error);
      },
    });

    await expect.poll(() => api.current !== null).toBeTruthy();
    await frames(3);
    const errors = spy.mock.calls.map((call) => String(call[0]).slice(0, 200));

    spy.mockRestore();
    expect(recoverable).toStrictEqual([]);
    expect(errors).toStrictEqual([]);
    const zoom = host.querySelector<HTMLElement>('[data-zriz-item="zoom"]');

    zoom?.focus();
    await userEvent.keyboard("{End}");
    await frames(3);
    expect(api.current?.getZoom()).toBeGreaterThan(1);
    root.unmount();
    host.remove();
  });
});
