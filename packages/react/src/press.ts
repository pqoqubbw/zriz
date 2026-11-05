"use client";

import type { CSSProperties, Ref } from "react";

import { keepStyle, useKeptStyle } from "./part";

const PRESS: CSSProperties = {
  WebkitUserSelect: "none",
  touchAction: "manipulation",
  userSelect: "none",
};

const keep = keepStyle(PRESS);

const usePressRef = (ref: Ref<HTMLElement> | undefined): Ref<HTMLElement> =>
  useKeptStyle(keep, ref);

export { PRESS, usePressRef };
