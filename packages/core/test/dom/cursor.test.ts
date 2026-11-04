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

  it("holds nothing without an element or adopted sheets", () => {
    page({ value: "grab" });
    expect(holdCursor(null)).toBeNull();
    vi.stubGlobal("document", {});
    expect(holdCursor(element())).toBeNull();
    vi.stubGlobal("document", { adoptedStyleSheets: [] });
    vi.stubGlobal("CSSStyleSheet", undefined);
    expect(holdCursor(element())).toBeNull();
  });

  it("keeps a sheet for each gesture on a cursor until the last lets go", () => {
    const doc = page({ value: "grab" });
    const first = holdCursor(element());
    const second = holdCursor(element());
    expect(doc.adoptedStyleSheets.map((sheet) => sheet.rule)).toStrictEqual([
      "*{cursor:grabbing!important}",
      "*{cursor:grabbing!important}",
    ]);
    first?.();
    expect(doc.adoptedStyleSheets).toHaveLength(1);
    second?.();
    expect(doc.adoptedStyleSheets).toHaveLength(0);
  });

  it("drops only its own sheet when two cursors are held", () => {
    const cursor = { value: "grab" };
    const doc = page(cursor);
    const photo = holdCursor(element());
    cursor.value = "nwse-resize";
    const handle = holdCursor(element());
    expect(doc.adoptedStyleSheets).toHaveLength(2);
    photo?.();
    expect(doc.adoptedStyleSheets.map((sheet) => sheet.rule)).toStrictEqual([
      "*{cursor:nwse-resize!important}",
    ]);
    handle?.();
    expect(doc.adoptedStyleSheets).toHaveLength(0);
  });
});
