declare const process: { env: { NODE_ENV?: string } };

const warned = new Set<string>();

const isDev = (): boolean => {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
};

export const warnUnlabelled = (part: string, element: Element | null): void => {
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

export const warnFormat = (
  part: string,
  locale: string | undefined,
  format: Intl.NumberFormatOptions | undefined
): void => {
  const key = `${part} format`;
  if (warned.has(key) || !isDev()) {
    return;
  }
  try {
    new Intl.NumberFormat(locale, format).format(0);
  } catch {
    warned.add(key);
    console.warn(
      `zriz: <Cropper.${part}> ignores a locale or format the browser refuses, and speaks its default value text instead.`
    );
  }
};
