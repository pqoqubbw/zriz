import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { page } from "vitest/browser";

import { DEMO_LOADERS } from "../../demos/load";
import { DEMO_NAMES } from "../../demos/registry";
import { frameLayout, layoutOf, mountLive, ready } from "./helpers";

vi.mock(import("../../demos/shell/photo"), async () => {
  const { photoMock } = await import("./fixtures");

  return await photoMock();
});

const VIEWPORTS = {
  desktop: [1280, 900],
  phone: [390, 844],
} as const;

const CASES = DEMO_NAMES.flatMap((name) =>
  (["desktop", "phone"] as const).map((width) => ({ name, width }))
);

describe("demo layout", () => {
  afterEach(async () => {
    await cleanup();
  });

  it.each(CASES)(
    "draws the live $name demo where the frame drew it at $width",
    async ({ name, width }) => {
      const [viewWidth, viewHeight] = VIEWPORTS[width];

      await page.viewport(viewWidth, viewHeight);

      const { default: Live } = await DEMO_LOADERS[name]();
      const frame = await frameLayout(name, width);

      await mountLive(Live, name, width);
      await ready();

      expect(layoutOf()).toStrictEqual(frame);
    }
  );
});
