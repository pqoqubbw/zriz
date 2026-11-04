import type { Cropper as CropperApi } from "@zriz/core";
import { createRef } from "react";
import type { ReactElement, RefObject } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import * as Cropper from "../src/cropper";

const tree = (api: RefObject<CropperApi | null>, run: number): ReactElement => (
  <Cropper.Root
    actionsRef={api}
    data-run={run}
    image={{ height: 300, width: 400 }}
    shape="circle"
  >
    <Cropper.Viewport>
      <Cropper.Area aria-label="Crop">
        <Cropper.Grid />
        <Cropper.Handle position="top-left" />
        <Cropper.Handle position="right" />
      </Cropper.Area>
    </Cropper.Viewport>
    <Cropper.Dial aria-label="Straighten">
      <Cropper.DialTicks />
    </Cropper.Dial>
    <Cropper.Zoom aria-label="Zoom">
      <Cropper.ZoomThumb />
    </Cropper.Zoom>
    <Cropper.Announcer announce={() => "cropped"} />
  </Cropper.Root>
);

const part = (host: Element, selector: string): HTMLElement => {
  const node = host.querySelector<HTMLElement>(selector);

  if (!node) {
    throw new Error(`missing ${selector}`);
  }

  return node;
};

const computed = (host: Element, selector: string): CSSStyleDeclaration =>
  getComputedStyle(part(host, selector));

const refused: string[] = [];
let runs = 0;

const hydrated = async () => {
  runs += 1;
  const api = createRef<CropperApi>();
  const host = document.createElement("div");

  host.innerHTML = renderToString(tree(api, runs));
  document.body.append(host);
  const root = hydrateRoot(host, tree(api, runs));

  await expect.poll(() => api.current).not.toBeNull();

  return { api, host, root };
};

describe("server rendered parts under a strict style-src", () => {
  beforeAll(() => {
    document.addEventListener("securitypolicyviolation", (event) => {
      refused.push(event.effectiveDirective);
    });

    const policy = document.createElement("meta");

    policy.httpEquiv = "Content-Security-Policy";
    policy.content = "style-src 'self'";
    document.head.append(policy);
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("keeps every part's own styles after hydration", async () => {
    const { host, root } = await hydrated();

    await expect
      .poll(() => refused.some((name) => name.startsWith("style-src")))
      .toBeTruthy();

    const handle = computed(host, '[data-zriz-item="handle"]');
    const edge = computed(host, '[data-edge="right"]');
    const dial = computed(host, '[data-zriz-item="dial"]');
    const zoom = computed(host, '[data-zriz-item="zoom"]');

    expect({
      area: computed(host, '[data-zriz-item="area"]').borderTopLeftRadius,
      dial: [dial.position, dial.touchAction],
      edge: [edge.position, edge.translate],
      grid: computed(host, '[data-zriz-item="grid"]').position,
      handle: [handle.position, handle.touchAction, handle.translate],
      line: computed(host, '[data-zriz-item="grid"] > span').position,
      zoom: [zoom.position, zoom.touchAction],
    }).toStrictEqual({
      area: "50%",
      dial: ["relative", "pan-y"],
      edge: ["absolute", "50% -50%"],
      grid: "absolute",
      handle: ["absolute", "none", "-50% -50%"],
      line: "absolute",
      zoom: ["relative", "none"],
    });

    root.unmount();
  });

  it("keeps the announcer visually hidden once it speaks", async () => {
    const { api, host, root } = await hydrated();
    const announcer = part(host, '[data-zriz-item="announcer"]');
    let rotation = 0;

    await expect
      .poll(() => {
        rotation += 1;
        api.current?.setRotation(rotation);

        return announcer.textContent;
      })
      .toBe("cropped");

    const { height, width } = announcer.getBoundingClientRect();

    expect(getComputedStyle(announcer).clipPath).toBe("inset(50%)");
    root.unmount();
    expect(height).toBeLessThanOrEqual(1);
    expect(width).toBeLessThanOrEqual(1);
  });
});
