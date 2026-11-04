import { afterEach, describe, expect, it, vi } from "vitest";

import { warnUnlabelled } from "../src/warn";

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
