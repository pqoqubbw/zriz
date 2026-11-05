"use client";

import { createContext, useContext } from "react";

type DemoPhoto = {
  id: string;
  key: string;
};

type DemoState = {
  dim: boolean;
  photo: DemoPhoto;
};

const DemoContext = createContext<DemoState>({
  dim: false,
  photo: { id: "", key: "" },
});

const useDemoDim = (): boolean => useContext(DemoContext).dim;

const useDemoPhoto = (): DemoPhoto => useContext(DemoContext).photo;

export type { DemoPhoto, DemoState };
export { DemoContext, useDemoDim, useDemoPhoto };
