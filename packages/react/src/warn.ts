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
      `zriz: <Cropper.${part}> ignores a locale or format the browser refuses, and speaks its default value text instead.`
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

export { warnFormat, warnUnlabelled, warnViewports };
