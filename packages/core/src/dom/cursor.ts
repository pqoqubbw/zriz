const held = new Map<string, { sheet: CSSStyleSheet; count: number }>();

const swap: Record<string, string> = { grab: "grabbing" };

export const holdCursor = (element: Element | null): (() => void) | null => {
  if (
    !element ||
    typeof CSSStyleSheet !== "function" ||
    !("adoptedStyleSheets" in document)
  ) {
    return null;
  }
  const computed = getComputedStyle(element).cursor;
  if (computed === "" || computed === "auto" || computed === "default") {
    return null;
  }
  const cursor = swap[computed] ?? computed;
  const entry = held.get(cursor) ?? {
    count: 0,
    sheet: new CSSStyleSheet(),
  };
  if (!held.has(cursor)) {
    entry.sheet.replaceSync(`*{cursor:${cursor}!important}`);
    held.set(cursor, entry);
  }
  entry.count += 1;
  if (entry.count === 1) {
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, entry.sheet];
  }
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    entry.count -= 1;
    if (entry.count === 0) {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
        (item) => item !== entry.sheet
      );
    }
  };
};
