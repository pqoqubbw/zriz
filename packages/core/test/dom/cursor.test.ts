import { afterEach, describe, expect, it, vi } from "vitest";

import { holdCursor } from "../../src/dom/cursor";

class FakeSheet {
  rule = "";

  replaceSync(rule: string): void {
    this.rule = rule;
  }
}

const isElement = (value: unknown): value is Element =>
  typeof value === "object" && value !== null;

const element = (): Element => {
  const fake: unknown = { getRootNode: () => ({}), ownerDocument: {} };

  if (!isElement(fake)) {
    throw new Error("no element");
  }

  return fake;
};

const page = (cursor: {
  value: string;
}): { adoptedStyleSheets: FakeSheet[] } => {
  const adoptedStyleSheets: FakeSheet[] = [];
  const doc = { adoptedStyleSheets };

  vi.stubGlobal("CSSStyleSheet", FakeSheet);
  vi.stubGlobal("document", doc);
  vi.stubGlobal("getComputedStyle", () => ({ cursor: cursor.value }));

  return doc;
};

describe("cursor hold", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps a sheet per hold and drops only its own on release", () => {
    const cursor = { value: "grab" };
    const doc = page(cursor);
    const rules = (): string[] =>
      doc.adoptedStyleSheets.map((sheet) => sheet.rule);
    const first = holdCursor(element());
    const second = holdCursor(element());
    const same = rules();

    first?.();
    const afterFirst = rules().length;

    second?.();
    const afterSecond = rules().length;
    const photo = holdCursor(element());

    cursor.value = "nwse-resize";
    const handle = holdCursor(element());
    const both = rules().length;

    photo?.();
    const left = rules();

    handle?.();

    expect({ afterFirst, afterSecond, both, left, same }).toStrictEqual({
      afterFirst: 1,
      afterSecond: 0,
      both: 2,
      left: ["*{cursor:nwse-resize!important}"],
      same: ["*{cursor:grabbing!important}", "*{cursor:grabbing!important}"],
    });

    expect(rules()).toStrictEqual([]);
  });
});
