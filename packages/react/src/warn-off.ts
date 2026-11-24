const warnUnlabelled = (_part: string, _element: Element | null): void =>
  undefined;

const warnFormat = (
  _part: string,
  _locale: string | undefined,
  _format: Intl.NumberFormatOptions | undefined
): void => undefined;

const stay = (): void => undefined;

const warnViewports = (_cropper: object, _element: Element): (() => void) =>
  stay;

const warnFlips = (
  _cropper: object,
  _entry: { axis: "x" | "y"; toggle: boolean }
): (() => void) => stay;

export { warnFlips, warnFormat, warnUnlabelled, warnViewports };
