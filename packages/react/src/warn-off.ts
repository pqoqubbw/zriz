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

export { warnFormat, warnUnlabelled, warnViewports };
