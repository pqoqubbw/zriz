import { afterEach, describe, expect, it, vi } from "vitest";

import { warnUnlabelled, warnViewports } from "../src/warn";
import { warnViewports as warnViewportsOff } from "../src/warn-off";

const isElement = (value: unknown): value is Element =>
  typeof value === "object" && value !== null;

const element = (name: string | null, value = "named"): Element => {
  const node: unknown = {
    getAttribute: (asked: string) => (asked === name ? value : null),
  };

  if (!isElement(node)) {
    throw new Error("unreachable");
  }

  return node;
};

describe(warnUnlabelled, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(["aria-label", "aria-labelledby", "title"])(
    "stays quiet for a part named by %s",
    (name) => {
      const warn = vi.spyOn(console, "warn").mockReturnValue(undefined);

      warnUnlabelled(`Named ${name}`, element(name));
      expect(warn).not.toHaveBeenCalled();
    }
  );

  it("warns once per part, and not for a missing element", () => {
    const warn = vi.spyOn(console, "warn").mockReturnValue(undefined);

    warnUnlabelled("Once", null);
    expect(warn).not.toHaveBeenCalled();
    warnUnlabelled("Once", element("aria-label", "  "));
    warnUnlabelled("Once", element(null));
    expect(warn).toHaveBeenCalledOnce();
    warnUnlabelled("Other", element(null));
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

const box = (clientWidth: number): Element => {
  const node: unknown = { clientWidth };

  if (!isElement(node)) {
    throw new Error("unreachable");
  }

  return node;
};

describe(warnViewports, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("warns once, only when a second sized viewport joins one cropper", () => {
    const warn = vi.spyOn(console, "warn").mockReturnValue(undefined);
    const cropper = {};
    const leave = warnViewports(cropper, box(640));

    warnViewports(cropper, box(0));
    leave();
    warnViewports(cropper, box(640));
    expect(warn).not.toHaveBeenCalled();
    const other = {};

    warnViewports({}, box(640));
    warnViewports(other, box(640));
    warnViewports(other, box(160));
    warnViewports(other, box(80));
    expect(warn).toHaveBeenCalledOnce();
  });

  it("does nothing in production", () => {
    const warn = vi.spyOn(console, "warn").mockReturnValue(undefined);
    const cropper = {};

    warnViewportsOff(cropper, box(640))();
    warnViewportsOff(cropper, box(640))();
    expect(warn).not.toHaveBeenCalled();
  });
});
