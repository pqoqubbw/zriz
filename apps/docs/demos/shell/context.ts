"use client";

import { createContext, useContext } from "react";

type DemoState = {
  dim: boolean;
};

const DemoContext = createContext<DemoState>({ dim: false });

const useDemoDim = (): boolean => useContext(DemoContext).dim;

export type { DemoState };
export { DemoContext, useDemoDim };
