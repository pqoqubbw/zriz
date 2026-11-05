type ZrizErrorCode =
  | "cross-origin"
  | "unsupported-format"
  | "decode"
  | "timeout"
  | "aborted"
  | "blank"
  | "no-image"
  | "too-large";

class ZrizError extends Error {
  readonly code: ZrizErrorCode;

  constructor(code: ZrizErrorCode, message: string) {
    super(message);
    this.name = "ZrizError";
    this.code = code;
  }
}

export type { ZrizErrorCode };
export { ZrizError };
