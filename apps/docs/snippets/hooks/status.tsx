"use client";

import { useCropperState } from "@zriz/react";

export const Status = () => {
  const pristine = useCropperState((s) => s.pristine);
  return <span>{pristine ? "original" : "edited"}</span>;
};
