import { ZrizError } from "./error";

type Cost = {
  nodes: number;
  points: number;
  glyphs: number;
  filtered: number;
  depth: number;
};

const MAX_BYTES = 10_000_000;
const MAX_NODES = 50_000;
const MAX_POINTS = 100_000;
const MAX_GLYPHS = 500_000;
const MAX_FILTERED = 1000;
const MAX_DEPTH = 12;
const MAX_PRIMITIVES = 40;
const MAX_ORDER = 7;
const MAX_NESTING = 2;

const ZERO: Cost = { depth: 0, filtered: 0, glyphs: 0, nodes: 0, points: 0 };

const MARKERS = ["marker-start", "marker-mid", "marker-end"];

const refuse = (why: string): never => {
  throw new ZrizError(
    "too-large",
    `zriz: the SVG ${why}, so it would freeze the page`
  );
};

const add = (a: Cost, b: Cost, times = 1): Cost => ({
  depth: Math.max(a.depth, b.depth),
  filtered: a.filtered + b.filtered * times,
  glyphs: a.glyphs + b.glyphs * times,
  nodes: a.nodes + b.nodes * times,
  points: a.points + b.points * times,
});

const over = (cost: Cost): boolean =>
  cost.nodes >= MAX_NODES ||
  cost.points >= MAX_POINTS ||
  cost.glyphs >= MAX_GLYPHS ||
  cost.filtered >= MAX_FILTERED ||
  cost.depth >= MAX_DEPTH;

const hrefOf = (element: Element): string =>
  element.getAttribute("href") ??
  element.getAttributeNS("http://www.w3.org/1999/xlink", "href") ??
  "";

const idIn = (value: string): string | null =>
  /^#(?<id>.+)$/u.exec(value.trim())?.groups?.id ??
  /url\(\s*["']?#(?<id>[^"')]+)/u.exec(value)?.groups?.id ??
  null;

const pointsOf = (element: Element): number => {
  const name = element.localName;

  if (name === "path") {
    return (element.getAttribute("d") ?? "").replaceAll(/[^a-df-z]/giu, "")
      .length;
  }

  if (name === "polyline" || name === "polygon") {
    const values = (element.getAttribute("points") ?? "").match(/[\d.]+/gu);

    return (values?.length ?? 0) / 2;
  }

  return 0;
};

const markerOf = (element: Element, name: string): string | null => {
  const style = element.getAttribute("style") ?? "";
  const inline = new RegExp(`${name}\\s*:\\s*([^;]+)`, "u").exec(style)?.[1];

  return idIn(element.getAttribute(name) ?? inline ?? "");
};

const checkFilter = (element: Element): void => {
  if (element.localName === "filter") {
    const primitives = [...element.children].filter((child) =>
      child.localName.startsWith("fe")
    ).length;

    if (primitives >= MAX_PRIMITIVES) {
      refuse("chains too many filter steps");
    }
  }

  if (element.localName === "feConvolveMatrix") {
    const order = (element.getAttribute("order") ?? "3")
      .split(/[\s,]+/u)
      .map(Number);

    if (Math.max(...order) >= MAX_ORDER) {
      refuse("has a filter matrix that is too large");
    }
  }
};

const dataText = (url: string): string | null => {
  const comma = url.indexOf(",");
  const body = url.slice(comma + 1);

  try {
    return /;base64$/iu.test(url.slice(0, comma))
      ? atob(body)
      : decodeURIComponent(body);
  } catch {
    return null;
  }
};

const measure = (doc: Document, nestedSvg: (svg: string) => Cost): Cost => {
  const byId = new Map<string, Element>();

  for (const element of doc.querySelectorAll("[id]")) {
    byId.set(element.id, element);
  }

  const done = new Map<Element, Cost>();
  const open = new Set<Element>();

  const costOf = (element: Element): Cost => {
    const known = done.get(element);

    if (known) {
      return known;
    }

    if (open.has(element)) {
      refuse("refers to itself");
    }

    open.add(element);
    checkFilter(element);
    const style = element.getAttribute("style") ?? "";
    const glyphs = [...element.childNodes].reduce(
      (sum, node) =>
        sum + (node.nodeType === 3 ? (node.textContent?.length ?? 0) : 0),
      0
    );
    let cost: Cost = {
      depth: 0,
      filtered:
        element.hasAttribute("filter") || /filter\s*:/u.test(style) ? 1 : 0,
      glyphs,
      nodes: 1,
      points: pointsOf(element),
    };

    for (const child of element.children) {
      cost = add(cost, costOf(child));

      if (over(cost)) {
        refuse("draws too much");
      }
    }

    const target = element.localName === "use" ? idIn(hrefOf(element)) : null;
    const used = target === null ? undefined : byId.get(target);

    if (used) {
      const inner = costOf(used);

      cost = add(cost, { ...inner, depth: inner.depth + 1 });
    }

    for (const name of MARKERS) {
      const marker = byId.get(markerOf(element, name) ?? "");

      if (marker) {
        cost = add(cost, costOf(marker), Math.max(1, cost.points));
      }
    }

    const image =
      element.localName === "image" || element.localName === "feImage";
    const source = image ? hrefOf(element) : "";

    const text = /^data:image\/svg\+xml/iu.test(source)
      ? dataText(source)
      : null;

    if (text !== null) {
      cost = add(cost, nestedSvg(text));
    }

    if (over(cost)) {
      refuse("draws too much");
    }

    open.delete(element);
    done.set(element, cost);

    return cost;
  };

  const root = doc.documentElement;
  let total = costOf(root);
  const css = [...doc.querySelectorAll("style")]
    .map((sheet) => sheet.textContent)
    .join("");

  if (/filter\s*:/u.test(css)) {
    total = { ...total, filtered: Math.max(total.filtered, total.nodes) };
  }

  if (/marker/u.test(css)) {
    let markers = ZERO;

    for (const marker of doc.querySelectorAll("marker")) {
      markers = add(markers, costOf(marker));
    }

    total = add(total, markers, Math.max(1, total.points));
  }

  if (over(total)) {
    refuse("draws too much");
  }

  return total;
};

const parse = (text: string, nested: number): Cost => {
  if (nested > MAX_NESTING) {
    refuse("nests too many SVG images");
  }

  const doc = new DOMParser().parseFromString(text, "image/svg+xml");

  if (doc.querySelectorAll("parsererror").length > 0) {
    return ZERO;
  }

  try {
    return measure(doc, (svg) => parse(svg, nested + 1));
  } catch (error) {
    if (error instanceof RangeError) {
      refuse("is nested too deeply");
    }

    throw error;
  }
};

const guardSvg = (text: string, bytes: number): void => {
  if (bytes > MAX_BYTES) {
    refuse("is over 10 MB");
  }

  if (typeof DOMParser === "function") {
    parse(text, 0);
  }
};

export { guardSvg };
