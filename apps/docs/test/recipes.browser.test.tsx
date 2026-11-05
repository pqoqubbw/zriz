import { createCropper, parse, serialize } from "@zriz/core";
import type { Cropper as CropperApi } from "@zriz/core";
import { imageOf } from "@zriz/core/dom";
import * as Cropper from "@zriz/react/cropper";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { commands as browser } from "vitest/browser";

import { AvatarPicker } from "../snippets/avatar/avatar-picker";
import { SaveCrop } from "../snippets/exporting/save-crop";
import { Editor } from "../snippets/full-editor/editor";
import { Heic } from "../snippets/loading-images/heic";
import { SavedCrop } from "../snippets/saving-state/saved-crop";
import { CropUpload } from "../snippets/server-crop/crop-upload";
import { UndoEditor } from "../snippets/undo/undo-editor";
import markup from "../snippets/vanilla-js/markup.html?raw";
import zoomMarkup from "../snippets/vanilla-js/zoom.html?raw";
import { ZoomSteps } from "../snippets/zoom/steps";

import thumbCss from "../snippets/zoom/thumb.css?inline";

const decoder = vi.hoisted(() => ({ signals: [] as AbortSignal[] }));

vi.mock(import("../snippets/loading-images/decoder"), () => ({
  open: async (_, __, signal) => {
    decoder.signals.push(signal);

    await Promise.withResolvers<null>().promise;
  },
}));

type Pending = {
  answer: (response: Response) => void;
};

type Tools = {
  choose: (selector: string, file: string) => Promise<void>;
  forcedColors: (mode: "active" | "none") => Promise<void>;
};

const isTools = (value: object): value is Tools =>
  "choose" in value && "forcedColors" in value;

const toolsOf = (value: object): Tools => {
  if (!isTools(value)) {
    throw new Error("no test commands");
  }

  return value;
};

const commands = toolsOf(browser);

const noop = (): void => undefined;

const item = (name: string): string => `[data-zriz-item="${name}"]`;

const find = (selector: string): HTMLElement => {
  const found = document.querySelector<HTMLElement>(selector);

  if (!found) {
    throw new Error(`no ${selector}`);
  }

  return found;
};

const button = (name: string): HTMLButtonElement => {
  const found = [...document.querySelectorAll("button")].find(
    (each) => each.textContent === name
  );

  if (!found) {
    throw new Error(`no ${name} button`);
  }

  return found;
};

const fileInput = (selector = 'input[type="file"]'): HTMLInputElement => {
  const found = find(selector);

  if (!(found instanceof HTMLInputElement)) {
    throw new TypeError(`${selector} is no input`);
  }

  return found;
};

const isOff = (element: HTMLButtonElement): boolean =>
  element.disabled || element.getAttribute("aria-disabled") === "true";

const frames = async (n = 2): Promise<void> => {
  for (let i = 0; i < n; i += 1) {
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }
};

const flat = async (width: number, height: number): Promise<File> => {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("no 2d context");
  }

  context.fillStyle = "#c33";
  context.fillRect(0, 0, width, height);

  const blob = await canvas.convertToBlob({ type: "image/png" });

  return new File([blob], "photo.png", { type: "image/png" });
};

const broken = (): File =>
  new File(["nope"], "broken.jpg", { type: "image/jpeg" });

const held = (file: File): { file: File; open: () => void } => {
  const gate = Promise.withResolvers<null>();
  const slice = file.slice.bind(file);

  file.slice = (...args) => {
    const part = slice(...args);
    const read = part.arrayBuffer.bind(part);

    part.arrayBuffer = async () => {
      await gate.promise;

      return await read();
    };

    return part;
  };

  return {
    file,
    open: () => {
      gate.resolve(null);
    },
  };
};

const pick = (input: HTMLInputElement, file: File): void => {
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [file],
  });

  input.dispatchEvent(new Event("change", { bubbles: true }));
};

const whenPhoto = async (): Promise<void> => {
  await expect
    .poll(() => document.querySelector(`${item("image")}[data-ready]`), {
      timeout: 15_000,
    })
    .not.toBeNull();
};

const settled = async (): Promise<void> => {
  await frames();

  await expect
    .poll(() => document.querySelector(`${item("area")}[data-interacting]`))
    .toBeNull();

  await frames(4);
};

const photoTransform = (): string =>
  find(`${item("image")} img`).style.transform;

const whenOn = async (name: string): Promise<void> => {
  await expect.poll(() => isOff(button(name)), { timeout: 15_000 }).toBeFalsy();
};

const press = (element: Element, key: string): void => {
  element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key }));
  element.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key }));
};

const objectUrl = async (width: number, height: number): Promise<string> =>
  URL.createObjectURL(await flat(width, height));

const undoSteps = async (): Promise<number> => {
  const undo = button("undo");
  let steps = 0;

  while (!isOff(undo) && steps < 10) {
    undo.click();
    steps += 1;
    await frames(4);
  }

  return steps;
};

const commit = async (key: string): Promise<void> => {
  press(find(item("area")), key);
  await settled();
};

const savedCrop = (): string =>
  serialize(
    createCropper({
      defaultValue: { aspect: 16 / 9, rotation: 10 },
      image: { height: 1200, width: 1600 },
    }).getValue()
  );

const backend = (): Pending[] => {
  const pending: Pending[] = [];

  vi.spyOn(globalThis, "fetch").mockImplementation(
    async (_, init) =>
      await new Promise<Response>((resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("gone", "AbortError"));
        });

        pending.push({ answer: resolve });
      })
  );

  return pending;
};

const resultUrls = (): { live: () => number } => {
  const made = new Set<string>();
  const create = URL.createObjectURL.bind(URL);
  const revoke = URL.revokeObjectURL.bind(URL);

  vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
    const url = create(blob);

    if (blob instanceof Blob && blob.type === "image/x-answer") {
      made.add(url);
    }

    return url;
  });

  vi.spyOn(URL, "revokeObjectURL").mockImplementation((url) => {
    made.delete(url);
    revoke(url);
  });

  return { live: () => made.size };
};

const downloads = () =>
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockReturnValue(undefined);

const answer = (): Response =>
  new Response(new Blob(["x"], { type: "image/x-answer" }));

const mountUpload = async () => {
  const screen = await render(<CropUpload />);

  pick(fileInput(), await flat(400, 300));
  await whenOn("upload");

  return screen;
};

const shownResult = (): Element | null =>
  document.querySelector('img[alt="Crop from the server"]');

const alertText = (): string | null | undefined =>
  document.querySelector('[role="alert"]')?.textContent;

const canvasColour = (): string => {
  const probe = document.createElement("div");

  probe.style.background = "Canvas";
  document.body.append(probe);

  const colour = getComputedStyle(probe).backgroundColor;

  probe.remove();

  return colour;
};

const thumbColour = (): string =>
  getComputedStyle(find(item("zoom-thumb"))).backgroundColor;

const FIXTURE = "packages/core/test/fixtures/orient-1.jpg";

describe("docs recipes", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await commands.forcedColors("none");
    await cleanup();
  });

  describe("undo", () => {
    it("loses no step when undo is pressed during a gesture", async () => {
      await render(<UndoEditor src={await objectUrl(1600, 1200)} />);
      await whenPhoto();
      await commit("+");
      await commit("+");

      const area = find(item("area"));

      area.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "+" })
      );

      await expect
        .poll(() => document.querySelector(`${item("area")}[data-interacting]`))
        .not.toBeNull();

      button("undo").click();
      await frames();

      area.dispatchEvent(
        new KeyboardEvent("keyup", { bubbles: true, key: "+" })
      );

      await settled();

      await expect(undoSteps()).resolves.toBe(3);
    });

    it("opens a new photo at the full frame with an empty stack", async () => {
      const tall = await objectUrl(800, 1600);
      const fresh = await render(<UndoEditor src={tall} />);

      await whenPhoto();

      await settled();

      await expect
        .poll(() => find(item("area")).getBoundingClientRect().height)
        .toBeGreaterThan(0);

      const area = find(item("area")).getBoundingClientRect();

      const full = {
        height: area.height,
        transform: photoTransform(),
        width: area.width,
      };

      await fresh.unmount();

      const screen = await render(
        <UndoEditor src={await objectUrl(1600, 1200)} />
      );

      await whenPhoto();
      await commit("+");
      await screen.rerender(<UndoEditor src={tall} />);
      await whenPhoto();

      await expect
        .poll(() => {
          const now = find(item("area")).getBoundingClientRect();

          return {
            height: now.height,
            transform: photoTransform(),
            width: now.width,
          };
        })
        .toStrictEqual(full);

      expect(isOff(button("undo"))).toBeTruthy();
    });

    it("dims the button only while the stack is empty", async () => {
      await render(<UndoEditor src={await objectUrl(1600, 1200)} />);
      await whenPhoto();

      expect(getComputedStyle(button("undo")).opacity).toBe("0.4");

      await commit("+");

      expect(getComputedStyle(button("undo")).opacity).toBe("1");
    });

    it("keeps focus on the button when the stack empties", async () => {
      await render(<UndoEditor src={await objectUrl(1600, 1200)} />);
      await whenPhoto();
      await commit("+");

      const undo = button("undo");

      undo.focus();
      undo.click();
      await frames(10);

      expect(isOff(undo)).toBeTruthy();
      expect(document.activeElement).toBe(undo);
    });
  });

  describe("saved crop", () => {
    it("writes no crop nobody touched when a new src refits it", async () => {
      const stored = savedCrop();

      localStorage.setItem("zriz-crop:refit", stored);

      const writes = vi.spyOn(Storage.prototype, "setItem");
      const screen = await render(
        <SavedCrop id="refit" src={await objectUrl(1600, 1200)} />
      );

      await whenPhoto();

      const before = photoTransform();

      await screen.rerender(
        <SavedCrop id="refit" src={await objectUrl(800, 1600)} />
      );

      await expect.poll(photoTransform, { timeout: 15_000 }).not.toBe(before);

      await settled();

      expect(writes).not.toHaveBeenCalled();
      expect(localStorage.getItem("zriz-crop:refit")).toBe(stored);

      press(find(item("area")), "+");
      await expect.poll(() => writes.mock.calls.length).toBe(1);

      expect(parse(localStorage.getItem("zriz-crop:refit"))).not.toBeNull();

      localStorage.removeItem("zriz-crop:refit");
    });

    it("keeps the app when storage refuses the read", async () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new DOMException("denied", "SecurityError");
      });

      await render(<SavedCrop id="blocked" src={await objectUrl(400, 300)} />);
      await whenPhoto();

      expect(document.querySelector(item("area"))).not.toBeNull();
    });

    it("keeps the gesture running when storage refuses the write", async () => {
      const refused = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(() => {
          throw new DOMException("full", "QuotaExceededError");
        });
      const warned = vi.spyOn(console, "warn").mockReturnValue(undefined);
      const errors: unknown[] = [];

      const seen = (event: ErrorEvent): void => {
        errors.push(event.error);
        event.preventDefault();
      };

      window.addEventListener("error", seen);
      await render(<SavedCrop id="full" src={await objectUrl(400, 300)} />);
      await whenPhoto();
      press(find(item("area")), "+");
      await expect.poll(() => refused.mock.calls.length).toBe(1);
      await settled();
      window.removeEventListener("error", seen);

      expect(errors).toStrictEqual([]);
      expect(warned).toHaveBeenCalledOnce();
    });
  });

  describe("save buttons", () => {
    it.each([
      {
        mount: async (onSave: (blob: Blob) => void) => {
          await render(<AvatarPicker onSave={onSave} />);
          pick(fileInput(), await flat(800, 600));
        },
        save: "save",
      },
      {
        mount: async (onSave: (blob: Blob) => void) => {
          await render(
            <Editor onSave={onSave} src={await objectUrl(800, 600)} />
          );
        },
        save: "export",
      },
    ])("$save runs once on a double click and keeps focus", async (recipe) => {
      const onSave = vi.fn<(blob: Blob) => void>();

      await recipe.mount(onSave);
      await whenOn(recipe.save);

      const save = button(recipe.save);

      save.focus();
      save.click();
      save.click();
      await expect.poll(() => onSave.mock.calls.length).toBeGreaterThan(0);
      await frames(30);

      expect(onSave).toHaveBeenCalledOnce();
      expect(document.activeElement).toBe(save);
    });

    it("save crop downloads once on a double click and keeps focus", async () => {
      const clicked = downloads();

      await render(<SaveCrop file={await flat(800, 600)} />);
      await whenOn("save");

      const save = button("save");

      save.focus();
      save.click();
      save.click();
      await expect.poll(() => clicked.mock.calls.length).toBeGreaterThan(0);
      await frames(30);

      expect(clicked).toHaveBeenCalledOnce();
      expect(document.activeElement).toBe(save);
    });

    it("drops a save crop export still running when the file changes", async () => {
      const clicked = downloads();
      const screen = await render(<SaveCrop file={await flat(800, 600)} />);

      await whenOn("save");

      const next = await flat(640, 640);

      button("save").click();
      await screen.rerender(<SaveCrop file={next} />);
      await whenOn("save");
      await frames(30);

      expect(clicked).not.toHaveBeenCalled();

      button("save").click();
      await expect.poll(() => clicked.mock.calls.length).toBe(1);
    });

    it("drops an avatar save still running when another photo is picked", async () => {
      const onSave = vi.fn<(blob: Blob) => void>();

      await render(<AvatarPicker onSave={onSave} />);
      pick(fileInput(), await flat(800, 600));
      await whenOn("save");

      const next = await flat(640, 640);

      button("save").click();
      pick(fileInput(), next);
      await whenOn("save");
      await frames(30);

      expect(onSave).not.toHaveBeenCalled();
      expect(alertText()).toBeUndefined();

      button("save").click();
      await expect.poll(() => onSave.mock.calls.length).toBe(1);
    });

    it("drops a full editor export still running when src changes", async () => {
      const onSave = vi.fn<(blob: Blob) => void>();
      const screen = await render(
        <Editor onSave={onSave} src={await objectUrl(800, 600)} />
      );

      await whenOn("export");

      const next = await objectUrl(640, 640);

      button("export").click();
      await screen.rerender(<Editor onSave={onSave} src={next} />);
      await whenOn("export");
      await frames(30);

      expect(onSave).not.toHaveBeenCalled();
      expect(alertText()).toBeUndefined();
    });
  });

  describe("choosing the same file again", () => {
    it.each([
      { Recipe: () => <AvatarPicker onSave={noop} />, name: "avatar" },
      { Recipe: CropUpload, name: "crop upload" },
    ])("starts $name over and keeps the file name", async ({ Recipe }) => {
      await render(<Recipe />);
      await commands.choose('input[type="file"]', FIXTURE);
      await whenPhoto();

      const first = find(item("viewport"));

      await commands.choose('input[type="file"]', FIXTURE);
      await expect.poll(() => find(item("viewport")) === first).toBeFalsy();

      expect(fileInput().files).toHaveLength(1);
    });
  });

  describe("crop upload", () => {
    it("drops an answer for the photo before a new pick", async () => {
      const pending = backend();

      await mountUpload();
      button("upload").click();
      await expect.poll(() => pending.length).toBe(1);
      pick(fileInput(), await flat(200, 400));
      await whenOn("upload");
      pending[0]?.answer(answer());
      await frames(4);

      expect(shownResult()).toBeNull();
      expect(alertText()).toBeUndefined();
    });

    it("holds one result url however many uploads overlap", async () => {
      const pending = backend();
      const urls = resultUrls();

      await mountUpload();
      button("upload").click();
      await expect.poll(() => pending.length).toBe(1);
      button("upload").click();
      await expect.poll(() => pending.length).toBe(2);
      pending[0]?.answer(answer());
      pending[1]?.answer(answer());
      await expect.poll(shownResult).not.toBeNull();
      await frames(4);

      expect(urls.live()).toBe(1);
    });

    it("frees the result url on unmount and makes none after it", async () => {
      const pending = backend();
      const urls = resultUrls();
      const screen = await mountUpload();

      button("upload").click();
      await expect.poll(() => pending.length).toBe(1);
      pending[0]?.answer(answer());
      await expect.poll(() => urls.live()).toBe(1);
      button("upload").click();
      await expect.poll(() => pending.length).toBe(2);
      await screen.unmount();
      pending[1]?.answer(answer());
      await frames(4);

      expect(urls.live()).toBe(0);
    });

    it("clears the old result and error when an upload starts", async () => {
      const pending = backend();

      await mountUpload();
      button("upload").click();
      await expect.poll(() => pending.length).toBe(1);
      pending[0]?.answer(answer());
      await expect.poll(shownResult).not.toBeNull();
      button("upload").click();
      await expect.poll(() => pending.length).toBe(2);
      await frames();

      expect(shownResult()).toBeNull();

      pending[1]?.answer(new Response("refused", { status: 422 }));
      await expect.poll(alertText).toBe("refused");
      button("upload").click();
      await expect.poll(() => pending.length).toBe(3);
      await frames();

      expect(alertText()).toBeUndefined();
    });

    it("reports a body that fails while it reads", async () => {
      const pending = backend();

      await mountUpload();
      button("upload").click();
      await expect.poll(() => pending.length).toBe(1);

      pending[0]?.answer(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new Error("cut"));
            },
          })
        )
      );

      await expect.poll(alertText).toBe("the upload did not reach the server.");
    });
  });

  describe("heic", () => {
    it("aborts the load still running on unmount", async () => {
      const screen = await render(<Heic onSave={noop} />);

      pick(fileInput(), await flat(400, 300));

      const signal = decoder.signals.at(-1);

      expect(signal?.aborted).toBeFalsy();

      await screen.unmount();

      expect(signal?.aborted).toBeTruthy();
    });
  });

  describe("zoom steps", () => {
    it("keeps focus on a step at the limit", async () => {
      await render(
        <Cropper.Root image={{ height: 300, width: 400 }}>
          <ZoomSteps />
        </Cropper.Root>
      );

      const zoomIn = button("+");

      zoomIn.focus();

      for (let i = 0; i < 14; i += 1) {
        zoomIn.click();
        await frames();
      }

      expect(isOff(zoomIn)).toBeTruthy();
      expect(zoomIn.disabled).toBeFalsy();
      expect(document.activeElement).toBe(zoomIn);
    });
  });

  describe("zoom steps under a disabled root", () => {
    it("reports both steps as off", async () => {
      await render(
        <Cropper.Root disabled image={{ height: 300, width: 400 }}>
          <ZoomSteps />
        </Cropper.Root>
      );

      expect(button("\u2212").getAttribute("aria-disabled")).toBe("true");
      expect(button("+").getAttribute("aria-disabled")).toBe("true");
    });
  });

  describe("zoom sliders in forced colours", () => {
    it("paints the thumb of the stylesheet recipe", async () => {
      const style = document.createElement("style");

      style.textContent = thumbCss;
      document.head.append(style);

      await render(
        <Cropper.Root image={{ height: 300, width: 400 }}>
          <Cropper.Zoom aria-label="Zoom">
            <Cropper.ZoomThumb />
          </Cropper.Zoom>
        </Cropper.Root>
      );

      await commands.forcedColors("active");
      const colour = thumbColour();

      style.remove();

      expect(colour).not.toBe(canvasColour());
    });

    it("paints the thumb and the track of the full editor", async () => {
      await render(<Editor onSave={noop} src={await objectUrl(400, 300)} />);

      await commands.forcedColors("active");

      expect(thumbColour()).not.toBe(canvasColour());

      expect(getComputedStyle(find(item("zoom"))).backgroundImage).toContain(
        "gradient"
      );
    });

    it("paints the thumb of the vanilla recipe", async () => {
      const host = document.createElement("div");

      host.innerHTML = zoomMarkup;
      document.body.append(host);
      await commands.forcedColors("active");
      const colour = thumbColour();

      host.remove();

      expect(colour).not.toBe(canvasColour());
    });
  });

  describe("vanilla", () => {
    let cropper: CropperApi;
    let host: HTMLElement;
    let input: HTMLInputElement;
    let status: HTMLElement;

    const whenShowing = async (width: number): Promise<void> => {
      await expect
        .poll(() => imageOf(cropper)?.width, { timeout: 15_000 })
        .toBe(width);
    };

    beforeAll(async () => {
      host = document.createElement("div");
      host.innerHTML = markup;
      document.body.append(host);
      ({ cropper } = await import("../snippets/vanilla-js/cropper"));
      input = fileInput("#file");
      status = find("#status");
    });

    it("clears the failure text on the next pick", async () => {
      pick(input, broken());
      await expect.poll(() => status.textContent).not.toBe("");
      pick(input, await flat(320, 240));

      expect(status.textContent).toBe("");

      await whenShowing(320);
    });

    it("keeps the newer photo when an older pick finishes last", async () => {
      const slow = held(await flat(400, 300));

      pick(input, slow.file);
      pick(input, await flat(640, 480));
      await whenShowing(640);
      slow.open();
      await frames(10);

      expect(imageOf(cropper)?.width).toBe(640);
      expect(imageOf(cropper)?.preview.width).toBeGreaterThan(0);
    });

    it("keeps quiet when an older pick fails last", async () => {
      const failing = held(broken());

      pick(input, failing.file);
      pick(input, await flat(500, 400));
      await whenShowing(500);
      failing.open();
      await frames(10);

      expect(status.textContent).toBe("");
    });

    it("lets go of the picker and the last load on teardown, with the page section gone", async () => {
      const removed = vi.spyOn(input, "removeEventListener");
      const destroyed = vi.spyOn(cropper, "destroy");
      const late = held(await flat(700, 500));

      pick(input, late.file);
      host.remove();
      await import("../snippets/vanilla-js/teardown");

      expect(removed).toHaveBeenCalledWith("change", expect.any(Function));
      expect(destroyed).toHaveBeenCalledOnce();

      late.open();
      await frames(10);

      expect(imageOf(cropper)).toBeNull();

      pick(input, await flat(300, 200));
      await frames(30);

      expect(imageOf(cropper)).toBeNull();
    });
  });
});
