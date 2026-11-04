import { windowOf } from "./input";

const isShadow = (node: Node): node is ShadowRoot => "host" in node;

const swap: Record<string, string> = { grab: "grabbing" };

export const holdCursor = (element: Element | null): (() => void) | null => {
  const win = windowOf(element);
  if (
    !element ||
    typeof win.CSSStyleSheet !== "function" ||
    !("adoptedStyleSheets" in win.document)
  ) {
    return null;
  }
  const computed = getComputedStyle(element).cursor;
  if (computed === "" || computed === "auto" || computed === "default") {
    return null;
  }
  const sheet = new win.CSSStyleSheet();
  sheet.replaceSync(`*{cursor:${swap[computed] ?? computed}!important}`);
  const holders: DocumentOrShadowRoot[] = [win.document];
  let root = element.getRootNode();
  while (isShadow(root)) {
    holders.push(root);
    root = root.host.getRootNode();
  }
  for (const holder of holders) {
    holder.adoptedStyleSheets = [...holder.adoptedStyleSheets, sheet];
  }
  return () => {
    for (const holder of holders) {
      holder.adoptedStyleSheets = holder.adoptedStyleSheets.filter(
        (item) => item !== sheet
      );
    }
  };
};
