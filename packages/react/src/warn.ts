declare const process: { env: { NODE_ENV?: string } };

const warned = new Set<string>();

const SPOKEN: Partial<Record<string, Intl.NumberFormatOptions>> = {
  Dial: { style: "unit", unit: "degree" },
  Zoom: { style: "percent" },
};

const isDev = (): boolean => {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
};

const warnUnlabelled = (part: string, element: Element | null): void => {
  if (!element || warned.has(part) || !isDev()) {
    return;
  }

  const named = ["aria-label", "aria-labelledby", "title"].some(
    (name) => (element.getAttribute(name) ?? "").trim() !== ""
  );

  if (!named) {
    warned.add(part);

    console.warn(
      `zriz: <Cropper.${part}> needs aria-label or aria-labelledby. zriz ships no words, so screen readers get nothing otherwise.`
    );
  }
};

const warnFormat = (
  part: string,
  locale: string | undefined,
  format: Intl.NumberFormatOptions | undefined
): void => {
  const key = `${part} format`;

  if (warned.has(key) || !isDev()) {
    return;
  }

  try {
    new Intl.NumberFormat(locale, { ...SPOKEN[part], ...format }).format(0);
  } catch {
    warned.add(key);

    console.warn(
      `zriz: <Cropper.${part}> ignores a locale or format the browser refuses. A refused locale falls back to the browser's, and a refused format to the default value text.`
    );
  }
};

const viewports = new WeakMap<object, Set<Element>>();

const warnViewports = (cropper: object, element: Element): (() => void) => {
  const live = viewports.get(cropper) ?? new Set();

  viewports.set(cropper, live);

  if (element.clientWidth > 0) {
    live.add(element);
  }

  if (live.size > 1 && !warned.has("Viewport") && isDev()) {
    warned.add("Viewport");

    console.warn(
      "zriz: one <Cropper.Viewport> per cropper. A second one takes over the layout. Draw a live preview with useCropperFrame."
    );
  }

  return () => {
    live.delete(element);
  };
};

type FlipEntry = { axis: "x" | "y"; toggle: boolean };

const flips = new WeakMap<object, Set<FlipEntry>>();

const warnFlips = (cropper: object, entry: FlipEntry): (() => void) => {
  const live = flips.get(cropper) ?? new Set();

  flips.set(cropper, live);
  live.add(entry);

  const all = [...live];
  const mixed =
    all.some((flip) => flip.toggle && flip.axis === "x") &&
    all.some((flip) => flip.axis === "y");

  if (mixed && !warned.has("Flip") && isDev()) {
    warned.add("Flip");

    console.warn(
      'zriz: <Cropper.Flip toggle> sits next to <Cropper.Flip axis="y">. A vertical flip also mirrors the photo, so the toggle reads as pressed after it. Leave both flips plain and say the result with <Cropper.Announcer>.'
    );
  }

  return () => {
    live.delete(entry);
  };
};

export { warnFlips, warnFormat, warnUnlabelled, warnViewports };
