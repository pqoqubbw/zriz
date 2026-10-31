export type ZrizErrorCode =
  | "cross-origin"
  | "unsupported-format"
  | "decode"
  | "timeout"
  | "aborted"
  | "blank"
  | "no-image";

export class ZrizError extends Error {
  readonly code: ZrizErrorCode;

  constructor(code: ZrizErrorCode, message: string) {
    super(message);
    this.name = "ZrizError";
    this.code = code;
  }
}
