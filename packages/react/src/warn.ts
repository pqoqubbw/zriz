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
  const named =
    element.hasAttribute("aria-label") ||
    element.hasAttribute("aria-labelledby") ||
    (element.textContent ?? "").trim() !== "";
  if (!named) {
    warned.add(part);
    console.warn(
      `zriz: <Cropper.${part}> needs aria-label, aria-labelledby or text. zriz ships no words, so screen readers get nothing otherwise.`
    );
  }
};
