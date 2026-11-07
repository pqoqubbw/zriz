import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { page } from "vitest/browser";

import { find, item, mountDemo, ready } from "./helpers";

vi.mock(import("../../demos/shell/photo"), async () => {
  const { photoMock } = await import("./fixtures");

  return await photoMock();
});

const VARIABLES = [
  "--zriz-accent",
  "--zriz-frame",
  "--zriz-grid",
  "--zriz-line",
  "--zriz-scrim",
  "--zriz-tick",
] as const;

const panel = (): HTMLElement => find('[data-demo="styling"]');

const choice = (label: string): HTMLElement => {
  const found = [
    ...panel().querySelectorAll<HTMLElement>('[data-slot="track"] label'),
  ].find((element) => element.textContent === label);

  if (!found) {
    throw new Error(`no choice ${label}`);
  }

  return found;
};

const radio = (label: string): HTMLElement =>
  find('input[type="radio"]', choice(label));

const variables = (): string[] => {
  const style = getComputedStyle(find(item("root")));

  return VARIABLES.map((name) => style.getPropertyValue(name).trim());
};

const violations = async (): Promise<string[]> => {
  const result = await axe.run(panel(), {
    rules: { region: { enabled: false } },
  });

  return result.violations.map((each) => `${each.id}: ${each.help}`);
};

describe("styling demo", () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  afterEach(async () => {
    await cleanup();
  });

  it("starts on the stylesheet's colours and sets all six variables for each look", async () => {
    await mountDemo("styling");
    await ready();

    expect(variables()).toStrictEqual(["", "", "", "", "", ""]);
    expect(panel().querySelector(item("dial"))).not.toBeNull();
    await expect(violations()).resolves.toStrictEqual([]);

    for (const look of ["Ink", "Soft"]) {
      radio(look).click();

      await expect
        .poll(() => Object.hasOwn(choice(look).dataset, "checked"))
        .toBeTruthy();

      await expect
        .poll(() => variables().every((value) => value !== ""))
        .toBeTruthy();

      await expect(violations()).resolves.toStrictEqual([]);
    }
  });
});
