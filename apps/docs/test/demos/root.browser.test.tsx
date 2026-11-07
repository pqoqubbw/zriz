import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { page } from "vitest/browser";

import { button, find, item, mountDemo, ready } from "./helpers";

vi.mock(import("../../demos/shell/photo"), async () => {
  const { photoMock } = await import("./fixtures");

  return await photoMock();
});

const panel = (): HTMLElement => find('[data-demo="root"]');

const disabled = (): boolean =>
  Object.hasOwn(find(item("root")).dataset, "disabled");

const violations = async (): Promise<string[]> => {
  const result = await axe.run(panel(), {
    rules: { region: { enabled: false } },
  });

  return result.violations.map((each) => `${each.id}: ${each.help}`);
};

describe("root demo", () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await cleanup();
  });

  it("has nothing under the stage and locks the cropper while the download runs", async () => {
    await mountDemo("root");
    await ready();

    expect([
      panel().querySelector('[data-slot="zone"]'),
      disabled(),
    ]).toStrictEqual([null, false]);

    await expect(violations()).resolves.toStrictEqual([]);

    const seen: boolean[] = [];

    vi.spyOn(HTMLAnchorElement.prototype, "click").mockReturnValue(undefined);

    const observer = new MutationObserver(() => {
      seen.push(disabled());
    });

    observer.observe(find(item("root")), { attributes: true });
    button("Download").click();

    await expect.poll(() => seen.includes(true) && !disabled()).toBeTruthy();

    observer.disconnect();
  });
});
